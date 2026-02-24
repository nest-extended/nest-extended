import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { getModule } from '../templates/module.template';
import { getController } from '../templates/controller.template';
import { getDto } from '../templates/dto.template';
import {
    getAuthController,
    getAuthGuard,
    getAuthModule,
    getAuthService,
    getJwtConstants,
} from '../templates/auth.template';
import { getUsersController, getUsersSchema, getUsersService } from '../templates/users.template';

export const generateAppAction = async (appName: string) => {
    const questions = [
        {
            type: 'list',
            name: 'database',
            message: 'Which database would you like to use?',
            choices: ['mongo', 'sql'],
        },
    ];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const answers = await inquirer.prompt(questions);
    const database = answers['database'];

    if (database === 'sql') {
        console.error(chalk.red('Error: We are not supporting sql now'));
        process.exit(1);
    }

    console.log(chalk.blue(`Generating NestJS app: ${appName}`));

    const appDir = path.join(process.cwd(), appName);
    const pkgManager = fs.existsSync(path.join(process.cwd(), 'yarn.lock')) ? 'yarn' : 'npm';

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
        const installArgs = pkgManager === 'yarn' ? ['add'] : ['install'];
        const child = spawn(
            pkgManager,
            [
                ...installArgs,
                '@nestjs/mongoose',
                'mongoose',
                '@nestjs/config',
                'nestjs-cls',
                '@nestjs/jwt',
                'bcrypt',
                `@nest-extended/core@${nestExtendedVersion}`,
                `@nest-extended/mongoose@${nestExtendedVersion}`,
                `@nest-extended/decorators@${nestExtendedVersion}`,
                'zod'
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
    await new Promise<void>((resolve, reject) => {
        const devArgs = pkgManager === 'yarn' ? ['add', '-D'] : ['install', '-D'];
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

    console.log(chalk.blue('Configuring project...'));

    // 4. Update app.module.ts
    const appModulePath = path.join(appDir, 'src/app.module.ts');
    let appModuleContent = fs.readFileSync(appModulePath, 'utf8');

    const importsToAdd = `
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from '@nest-extended/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { NestExtendedModule, NullResponseInterceptor } from '@nest-extended/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './services/auth/auth.module';
import { UsersModule } from './services/users/users.module';
`;
    appModuleContent = importsToAdd + appModuleContent;

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
          deleted: true,
          deletedBy: user?._id,
          deletedAt: new Date(),
        }),
      },
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/test'),
    AuthModule,
    UsersModule,`;

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
    fs.writeFileSync(path.join(appDir, '.env'), 'MONGODB_URI=mongodb://localhost:27017/test\nJWT_SECRET=super-secret-jwt-key\n');

    // 5. Generate Users Service
    const usersDir = path.join(appDir, 'src/services/users');
    const schemasDir = path.join(appDir, 'src/schemas');
    fs.ensureDirSync(usersDir);
    fs.ensureDirSync(schemasDir);

    fs.writeFileSync(path.join(schemasDir, 'users.schema.ts'), getUsersSchema());
    fs.writeFileSync(path.join(usersDir, 'users.module.ts'), getModule('Users', 'users'));
    fs.writeFileSync(path.join(usersDir, 'users.service.ts'), getUsersService());
    fs.writeFileSync(path.join(usersDir, 'users.controller.ts'), getUsersController());
    fs.ensureDirSync(path.join(usersDir, 'dto'));
    fs.writeFileSync(path.join(usersDir, 'dto/users.dto.ts'), getDto('Users'));

    // 6. Generate Auth Service
    const authDir = path.join(appDir, 'src/services/auth');
    fs.ensureDirSync(authDir);
    fs.ensureDirSync(path.join(authDir, 'constants'));

    fs.writeFileSync(path.join(authDir, 'auth.module.ts'), getAuthModule());
    fs.writeFileSync(path.join(authDir, 'auth.service.ts'), getAuthService());
    fs.writeFileSync(path.join(authDir, 'auth.controller.ts'), getAuthController());
    fs.writeFileSync(path.join(authDir, 'auth.guard.ts'), getAuthGuard());
    fs.writeFileSync(path.join(authDir, 'constants/jwt-constants.ts'), getJwtConstants());

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
