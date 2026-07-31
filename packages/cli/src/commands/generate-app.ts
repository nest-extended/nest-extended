import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { generateAuthServices } from '../lib/generate-auth-services';
import { generatePrismaAuthServices } from '../lib/generate-prisma-auth-services';
import { generateTypeOrmAuthServices } from '../lib/generate-typeorm-auth-services';
import { getPrismaServiceFile, getPrismaModuleFile, getPrismaAdapterPackage } from '../templates/prisma-setup.template';
import { getDataSourceFile, getDatabaseModuleFile, getTypeOrmDriverPackage } from '../templates/typeorm-setup.template';
import { configurePrismaGenerator, ignoreGeneratedPrismaClient } from '../lib/configure-prisma-generator';
import { injectPrismaScripts } from '../lib/inject-prisma-scripts';
import { resolveDatabaseAndOrm } from '../lib/resolve-orm';
import { nestExtendedDep } from '../lib/local-packages';

const PM_CHOICES = ['npm', 'yarn', 'pnpm'];
const VALIDATOR_CHOICES = ['zod', 'class-validator'];

interface AppOptions {
    pkgManager?: string; pm?: string;
    database?: string; db?: string;
    orm?: string;
    validator?: string;
    auth?: boolean; skipAuth?: boolean;
}

export const generateAppAction = async (appName: string, options: AppOptions = {}) => {
    // Resolve --pkg-manager / --pm / -p
    let pkgManager: string = options.pkgManager || options.pm || '';
    if (pkgManager && !PM_CHOICES.includes(pkgManager)) {
        console.error(chalk.red(`Invalid --pkg-manager "${pkgManager}". Valid options: ${PM_CHOICES.join(', ')}`));
        process.exit(1);
    }
    if (!pkgManager) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const answer = await inquirer.prompt([{
            type: 'list',
            name: 'pkgManager',
            message: 'Which package manager would you like to use?',
            choices: PM_CHOICES,
            default: 'yarn',
        }]);
        pkgManager = answer.pkgManager;
    }

    // Resolve --database / --db and --orm (two-step prompt when not supplied).
    const { database, orm, sqlProvider } = await resolveDatabaseAndOrm(options);

    // Resolve --validator / -v
    let validatorType: string = options.validator || '';
    if (validatorType && !VALIDATOR_CHOICES.includes(validatorType)) {
        console.error(chalk.red(`Invalid --validator "${validatorType}". Valid options: ${VALIDATOR_CHOICES.join(', ')}`));
        process.exit(1);
    }
    if (!validatorType) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const answer = await inquirer.prompt([{
            type: 'list',
            name: 'validatorType',
            message: 'Which validation library would you like to use?',
            choices: VALIDATOR_CHOICES,
            default: 'zod',
        }]);
        validatorType = answer.validatorType;
    }

    // Resolve --auth / --skip-auth
    let generateAuth: boolean;
    if (options.auth) {
        generateAuth = true;
    } else if (options.skipAuth) {
        generateAuth = false;
    } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const answer = await inquirer.prompt([{
            type: 'confirm',
            name: 'generateAuth',
            message: 'Would you like to generate authentication (Users and Auth services)?',
            default: true,
        }]);
        generateAuth = answer.generateAuth;
    }

    console.log(chalk.blue(`Generating NestJS app: ${appName} with ${database} (${orm})`));

    const appDir = path.join(process.cwd(), appName);

    // 1. Run nest new
    await new Promise<void>((resolve, reject) => {
        const child = spawn('npx', ['@nestjs/cli', 'new', appName, '--package-manager', pkgManager], {
            stdio: 'inherit',
            shell: true,
        });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`nest new failed with code ${code}`));
        });
    });

    const pkg = require('../../package.json');
    const nestExtendedVersion = pkg.version;

    console.log(chalk.blue('Installing additional dependencies...'));

    // 2. Install dependencies
    await new Promise<void>((resolve, reject) => {
        const installArgs = pkgManager === 'npm' ? ['install'] : ['add'];
        const baseDeps = [
            '@nestjs/config',
            'nestjs-cls',
            'qs',
            nestExtendedDep('core', nestExtendedVersion),
            nestExtendedDep('decorators', nestExtendedVersion),
        ];

        if (orm === 'prisma') {
            baseDeps.push(
                '@prisma/client',
                getPrismaAdapterPackage(database),
                nestExtendedDep('prisma', nestExtendedVersion),
            );
        } else if (orm === 'typeorm') {
            baseDeps.push(
                '@nestjs/typeorm',
                'typeorm',
                'dotenv',
                getTypeOrmDriverPackage(sqlProvider as string),
                nestExtendedDep('typeorm', nestExtendedVersion),
            );
        } else {
            baseDeps.push(
                '@nestjs/mongoose',
                'mongoose',
                nestExtendedDep('mongoose', nestExtendedVersion),
            );
        }

        if (validatorType === 'zod') {
            baseDeps.push('zod');
        } else {
            baseDeps.push('class-validator', 'class-transformer');
        }
        if (generateAuth) {
            baseDeps.push('@nestjs/jwt', 'bcrypt');
        }

        const child = spawn(
            pkgManager,
            [
                ...installArgs,
                ...baseDeps
            ],
            {
                stdio: 'inherit',
                cwd: appDir,
                shell: true,
            },
        );
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${pkgManager} install failed with code ${code}`));
        });
    });

    // 3. Install Dev dependencies
    const devDeps: string[] = ['@types/qs'];
    if (generateAuth) devDeps.push('@types/bcrypt');
    if (orm === 'prisma') devDeps.push('prisma');
    if (orm === 'typeorm') devDeps.push('ts-node');

    if (devDeps.length > 0) {
        await new Promise<void>((resolve, reject) => {
            const devArgs = pkgManager === 'npm' ? ['install', '-D'] : ['add', '-D'];
            const child = spawn(pkgManager, [...devArgs, ...devDeps], {
                stdio: 'inherit',
                cwd: appDir,
                shell: true,
            });
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`${pkgManager} dev install failed with code ${code}`));
            });
        });
    }

    console.log(chalk.blue('Configuring project...'));

    if (orm === 'prisma') {
        // --- Prisma-based app setup ---

        // Initialize Prisma
        let datasourceProvider = 'postgresql';
        if (database === 'MySQL') datasourceProvider = 'mysql';
        else if (database === 'SQLite') datasourceProvider = 'sqlite';

        await new Promise<void>((resolve, reject) => {
            const child = spawn('npx', ['prisma', 'init', '--datasource-provider', datasourceProvider], {
                stdio: 'inherit',
                cwd: appDir,
                shell: true,
            });
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`prisma init failed with code ${code}`));
            });
        });

        // Normalize the Prisma 7 client generator block for NestJS and keep the
        // generated client out of version control.
        configurePrismaGenerator(appDir);
        ignoreGeneratedPrismaClient(appDir);

        // Inject `prisma:migrate` / `prisma:push` / etc. scripts that chain
        // `prisma generate` so the client is never stale after a migration.
        // (Prisma 7 removed the implicit generate-after-migrate behaviour.)
        injectPrismaScripts(appDir);

        // Create PrismaService and PrismaModule
        const prismaDir = path.join(appDir, 'src/prisma');
        fs.ensureDirSync(prismaDir);
        fs.writeFileSync(path.join(prismaDir, 'prisma.service.ts'), getPrismaServiceFile(database));
        fs.writeFileSync(path.join(prismaDir, 'prisma.module.ts'), getPrismaModuleFile());

        // Update app.module.ts for Prisma
        const appModulePath = path.join(appDir, 'src/app.module.ts');
        let appModuleContent = fs.readFileSync(appModulePath, 'utf8');

        const authImports = generateAuth ? `
import { AuthModule } from './services/auth/auth.module';
import { UsersModule } from './services/users/users.module';` : '';
        const importsToAdd = `
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from '@nest-extended/prisma';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { NestExtendedModule, NullResponseInterceptor } from '@nest-extended/core';
import { PrismaModule } from './prisma/prisma.module';${authImports}
`;
        appModuleContent = importsToAdd + appModuleContent;

        const deletedByProp = generateAuth ? `
          deletedBy: user?.id,` : '';
        const authModuleImports = generateAuth ? `
    AuthModule,
    UsersModule,` : '';

        const nestImports = `
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    NestExtendedModule.forRoot({
      softDelete: {
        getQuery: () => ({ deleted: { not: true } }),
        getData: (user: { id?: string } | null) => ({
          deleted: true,${deletedByProp}
          deletedAt: new Date(),
        }),
      },
      filters: [],
    }),
    PrismaModule,${authModuleImports}`;

        appModuleContent = appModuleContent.replace(/imports:\s*\[/, `imports: [\n${nestImports}`);

        const appProviders = `providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: NullResponseInterceptor,
    },
  ],`;
        appModuleContent = appModuleContent.replace(/providers:\s*\[AppService\],?/, appProviders);

        fs.writeFileSync(appModulePath, appModuleContent);

        // Write .env file
        let databaseUrl = 'postgresql://user:password@localhost:5432/mydb?schema=public';
        if (database === 'MySQL') databaseUrl = 'mysql://user:password@localhost:3306/mydb';
        else if (database === 'SQLite') databaseUrl = 'file:./dev.db';

        fs.writeFileSync(path.join(appDir, '.env'), `DATABASE_URL="${databaseUrl}"
JWT_SECRET=super-secret-jwt-key
`);

        if (generateAuth) {
            generatePrismaAuthServices(appDir);
        }

    } else if (orm === 'typeorm') {
        // --- TypeORM-based app setup ---

        const provider = sqlProvider as string;

        // Create the shared DataSource + DatabaseModule.
        const dbDir = path.join(appDir, 'src/database');
        fs.ensureDirSync(dbDir);
        fs.writeFileSync(path.join(dbDir, 'data-source.ts'), getDataSourceFile(provider as 'postgresql' | 'mysql' | 'sqlite'));
        fs.writeFileSync(path.join(dbDir, 'database.module.ts'), getDatabaseModuleFile());

        // Update app.module.ts for TypeORM
        const appModulePath = path.join(appDir, 'src/app.module.ts');
        let appModuleContent = fs.readFileSync(appModulePath, 'utf8');

        const authImports = generateAuth ? `
import { AuthModule } from './services/auth/auth.module';
import { UsersModule } from './services/users/users.module';` : '';
        const importsToAdd = `
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from '@nest-extended/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { NestExtendedModule, NullResponseInterceptor } from '@nest-extended/core';
import { DatabaseModule } from './database/database.module';${authImports}
`;
        appModuleContent = importsToAdd + appModuleContent;

        const deletedByProp = generateAuth ? `
          deletedBy: user?.id,` : '';
        const authModuleImports = generateAuth ? `
    AuthModule,
    UsersModule,` : '';

        const nestImports = `
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    NestExtendedModule.forRoot({
      softDelete: {
        getQuery: () => ({ deleted: { $ne: true } }),
        getData: (user: { id?: string } | null) => ({
          deleted: true,${deletedByProp}
          deletedAt: new Date(),
        }),
      },
      filters: [],
    }),
    DatabaseModule,${authModuleImports}`;

        appModuleContent = appModuleContent.replace(/imports:\s*\[/, `imports: [\n${nestImports}`);

        const appProviders = `providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: NullResponseInterceptor,
    },
  ],`;
        appModuleContent = appModuleContent.replace(/providers:\s*\[AppService\],?/, appProviders);

        fs.writeFileSync(appModulePath, appModuleContent);

        // Write .env file
        let envContent: string;
        if (provider === 'sqlite') {
            envContent = `DATABASE_PATH=dev.db
DB_SYNCHRONIZE=false
JWT_SECRET=super-secret-jwt-key
`;
        } else {
            const databaseUrl = provider === 'mysql'
                ? 'mysql://user:password@localhost:3306/mydb'
                : 'postgresql://user:password@localhost:5432/mydb';
            envContent = `DATABASE_URL="${databaseUrl}"
DB_SYNCHRONIZE=false
JWT_SECRET=super-secret-jwt-key
`;
        }
        fs.writeFileSync(path.join(appDir, '.env'), envContent);

        // Keep the SQLite database file out of version control.
        if (provider === 'sqlite') {
            const gitignorePath = path.join(appDir, '.gitignore');
            let gi = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
            if (!gi.split('\n').map((l) => l.trim()).includes('dev.db')) {
                const prefix = gi.length > 0 && !gi.endsWith('\n') ? '\n' : '';
                fs.appendFileSync(gitignorePath, `${prefix}\n# SQLite database\ndev.db\n`);
            }
        }

        // Add TypeORM CLI scripts (manual schema sync / migrations).
        const pkgJsonPath = path.join(appDir, 'package.json');
        const appPkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        appPkg.scripts = appPkg.scripts || {};
        appPkg.scripts['db:sync'] = 'typeorm-ts-node-commonjs schema:sync -d src/database/data-source.ts';
        appPkg.scripts['migration:generate'] = 'typeorm-ts-node-commonjs migration:generate -d src/database/data-source.ts';
        appPkg.scripts['migration:run'] = 'typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts';
        appPkg.scripts['migration:revert'] = 'typeorm-ts-node-commonjs migration:revert -d src/database/data-source.ts';
        fs.writeFileSync(pkgJsonPath, JSON.stringify(appPkg, null, 2) + '\n');

        if (generateAuth) {
            generateTypeOrmAuthServices(appDir);
        }

    } else {
        // --- Mongoose-based app setup (existing behavior) ---

        // 4. Update app.module.ts
        const appModulePath = path.join(appDir, 'src/app.module.ts');
        let appModuleContent = fs.readFileSync(appModulePath, 'utf8');

        const authImports = generateAuth ? `
import { AuthModule } from './services/auth/auth.module';
import { UsersModule } from './services/users/users.module';` : '';
        const importsToAdd = `
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from '@nest-extended/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { NestExtendedModule, NullResponseInterceptor } from '@nest-extended/core';
import { MongooseModule } from '@nestjs/mongoose';${authImports}
`;
        appModuleContent = importsToAdd + appModuleContent;

        const deletedByProp = generateAuth ? `
          deletedBy: user?._id,` : '';
        const authModuleImports = generateAuth ? `
    AuthModule,
    UsersModule,` : '';

        const nestImports = `
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    NestExtendedModule.forRoot({
      softDelete: {
        getQuery: () => ({ deleted: { $ne: true } }),
        getData: (user: { _id?: string } | null) => ({
          deleted: true,${deletedByProp}
          deletedAt: new Date(),
        }),
      },
      filters: [],
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/test'),${authModuleImports}`;

        appModuleContent = appModuleContent.replace(/imports:\s*\[/, `imports: [\n${nestImports}`);

        const appProviders = `providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: NullResponseInterceptor,
    },
  ],`;
        appModuleContent = appModuleContent.replace(/providers:\s*\[AppService\],?/, appProviders);

        fs.writeFileSync(appModulePath, appModuleContent);

        // Write .env file
        fs.writeFileSync(path.join(appDir, '.env'), `MONGODB_URI=mongodb://localhost:27017/test
JWT_SECRET=super-secret-jwt-key
`);

        if (generateAuth) {
            generateAuthServices(appDir);
        }
    }

    console.log(chalk.blue('Running lint...'));
    await new Promise<void>((resolve) => {
        const lintChild = spawn(pkgManager, ['run', 'lint'], {
            stdio: 'inherit',
            cwd: appDir,
            shell: true,
        });
        lintChild.on('close', () => resolve());
    });

    console.log(chalk.green('App generated successfully!'));
};
