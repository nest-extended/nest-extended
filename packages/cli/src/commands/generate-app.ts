import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { getModule } from '../templates/module.template';
import { getController } from '../templates/controller.template';
import { getDto } from '../templates/dto.template';
import { generateAuthServices } from '../lib/generate-auth-services';
import { generatePrismaAuthServices } from '../lib/generate-prisma-auth-services';
import { getPrismaServiceFile, getPrismaModuleFile, getPrismaAdapterPackage } from '../templates/prisma-setup.template';
import { configurePrismaGenerator, ignoreGeneratedPrismaClient } from '../lib/configure-prisma-generator';

const PM_CHOICES = ['npm', 'yarn', 'pnpm'];
const DB_CHOICES = ['Mongoose', 'PostgreSQL', 'MySQL', 'SQLite'];
const VALIDATOR_CHOICES = ['zod', 'class-validator'];

interface AppOptions {
    pkgManager?: string; pm?: string;
    database?: string; db?: string;
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

    // Resolve --database / --db / -d
    let database: string = options.database || options.db || '';
    if (database && !DB_CHOICES.includes(database)) {
        console.error(chalk.red(`Invalid --database "${database}". Valid options: ${DB_CHOICES.join(', ')}`));
        process.exit(1);
    }
    if (!database) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const answer = await inquirer.prompt([{
            type: 'list',
            name: 'database',
            message: 'Which database would you like to use?',
            choices: DB_CHOICES,
            default: 'Mongoose',
        }]);
        database = answer.database;
    }

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

    const isPrisma = database !== 'Mongoose';

    console.log(chalk.blue(`Generating NestJS app: ${appName} with ${database}`));

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
            `@nest-extended/core@${nestExtendedVersion}`,
            `@nest-extended/decorators@${nestExtendedVersion}`,
        ];

        if (isPrisma) {
            baseDeps.push(
                '@prisma/client',
                getPrismaAdapterPackage(database),
                `@nest-extended/prisma@${nestExtendedVersion}`,
            );
        } else {
            baseDeps.push(
                '@nestjs/mongoose',
                'mongoose',
                `@nest-extended/mongoose@${nestExtendedVersion}`,
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
    if (isPrisma) devDeps.push('prisma');

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

    if (isPrisma) {
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
