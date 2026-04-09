import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { getModule } from '../templates/module.template';
import { getController } from '../templates/controller.template';
import { getDto } from '../templates/dto.template';
import { generateAuthServices } from '../lib/generate-auth-services';

export const generateAppAction = async (appName: string) => {
    const questions = [
        {
            type: 'list',
            name: 'pkgManager',
            message: 'Which package manager would you like to use?',
            choices: ['npm', 'yarn', 'pnpm'],
            default: 'yarn',
        },
        {
            type: 'list',
            name: 'database',
            message: 'Which database would you like to use?',
            choices: ['mongoose', 'sqlite', 'prisma'],
        },
        {
            type: 'list',
            name: 'validatorType',
            message: 'Which validation library would you like to use?',
            choices: ['zod', 'class-validator'],
            default: 'zod',
        },
        {
            type: 'confirm',
            name: 'generateAuth',
            message: 'Would you like to generate authentication (Users and Auth services)?',
            default: true,
        },
    ];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const answers = await inquirer.prompt(questions);
    const database = answers['database'];
    const pkgManager = answers['pkgManager'];
    const validatorType = answers['validatorType'];
    const generateAuth = answers['generateAuth'];

    if (database === 'sqlite' || database === 'prisma') {
        console.error(chalk.red(`Error: We are not supporting ${database} now`));
        process.exit(1);
    }

    console.log(chalk.blue(`Generating NestJS app: ${appName}`));

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
            '@nestjs/mongoose',
            'mongoose',
            '@nestjs/config',
            'nestjs-cls',
            `@nest-extended/core@${nestExtendedVersion}`,
            `@nest-extended/mongoose@${nestExtendedVersion}`,
            `@nest-extended/decorators@${nestExtendedVersion}`,
        ];
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
    if (generateAuth) {
        await new Promise<void>((resolve, reject) => {
            const devArgs = pkgManager === 'npm' ? ['install', '-D'] : ['add', '-D'];
            const child = spawn(pkgManager, [...devArgs, '@types/bcrypt'], {
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
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/test'),${authModuleImports}`;

    appModuleContent = appModuleContent.replace(/imports:\s*\[/, `imports: [
${nestImports}`);

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
