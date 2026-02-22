
import { Command } from 'commander';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { createFileWithContent } from '../lib/create-file';
import { updateAppModule } from '../lib/update-app-module';
import { getModule } from '../templates/module.template';
import { getService } from '../templates/service.template';
import { getController } from '../templates/controller.template';
import { getDto } from '../templates/dto.template';
import { getSchema } from '../templates/schema.template';
import { getServiceSpec } from '../templates/service.spec.template';
import { getControllerSpec } from '../templates/controller.spec.template';

import {
    getAuthController,
    getAuthGuard,
    getAuthModule,
    getAuthService,
    getJwtConstants,
    getPublicDecorator,
} from '../templates/auth.template';
import { getUsersSchema, getUsersService } from '../templates/users.template';

export const generateCommand = new Command('generate')
    .alias('g')
    .description('Generate a new element');

generateCommand
    .command('service <name>')
    .description('Generate a new service')
    .action(async (rawName: string) => {
        // if arg have '-' change to camelCase (Logic from original index.js)
        const argArray = rawName.split('-');
        argArray.forEach((arg, index) => {
            argArray[index] = arg[0].toUpperCase() + arg.slice(1).toLowerCase();
        });
        const Name = argArray.join(''); // PascalCase
        const name = Name[0].toLowerCase() + Name.slice(1); // camelCase

        console.log(`Generating service for: ${Name} (${name})`);

        createFileWithContent(`src/schemas/${name}.schema.ts`, getSchema(Name));
        createFileWithContent(`src/services/${name}/${name}.module.ts`, getModule(Name, name));
        createFileWithContent(`src/services/${name}/${name}.service.ts`, getService(Name, name));
        createFileWithContent(
            `src/services/${name}/${name}.controller.ts`,
            getController(Name, name, rawName), // Passing rawName as 'url' param, consistent with original index.js passing 'arg'
        );
        createFileWithContent(`src/services/${name}/dto/${name}.dto.ts`, getDto(Name));
        createFileWithContent(
            `src/services/${name}/${name}.service.spec.ts`,
            getServiceSpec(Name, name),
        );
        createFileWithContent(
            `src/services/${name}/${name}.controller.spec.ts`,
            getControllerSpec(Name, name),
        );

        await updateAppModule(Name, name);

        console.log(chalk.blue('Running lint...'));
        const projectDir = process.cwd();
        const pkgManager = fs.existsSync(path.join(projectDir, 'yarn.lock')) ? 'yarn' : 'npm';
        await new Promise<void>((resolve) => {
            const lintChild = spawn(pkgManager, ['run', 'lint'], {
                stdio: 'inherit',
                cwd: projectDir,
                shell: true,
            });
            lintChild.on('close', () => resolve());
        });
    });

generateCommand
    .command('app <name>')
    .description('Generate a new application')
    .action(async (appName: string) => {
        const questions = [
            {
                type: 'list',
                name: 'database',
                message: 'Which database would you like to use?',
                choices: ['mongo', 'sql'],
            },
        ];
        // @ts-ignore
        const answers = await inquirer.prompt(questions);
        const database = answers['database'];

        if (database === 'sql') {
            console.error(chalk.red('Error: We are not supporting sql now'));
            process.exit(1);
        }

        console.log(chalk.blue(`Generating NestJS app: ${appName}`));

        // 1. Run nest new
        await new Promise<void>((resolve, reject) => {
            const child = spawn('npx', ['@nestjs/cli', 'new', appName], {
                stdio: 'inherit',
                shell: true,
            });
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`nest new failed with code ${code}`));
            });
        });

        const appDir = path.join(process.cwd(), appName);
        const pkgManager = fs.existsSync(path.join(appDir, 'yarn.lock')) ? 'yarn' : 'npm';
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
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { NestExtendedModule } from '@nest-extended/core';
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
        getData: (user: any) => ({
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
        fs.writeFileSync(appModulePath, appModuleContent);

        // 5. Generate Users Service
        const usersDir = path.join(appDir, 'src/services/users');
        const schemasDir = path.join(appDir, 'src/schemas');
        fs.ensureDirSync(usersDir);
        fs.ensureDirSync(schemasDir);

        fs.writeFileSync(path.join(schemasDir, 'users.schema.ts'), getUsersSchema());
        fs.writeFileSync(path.join(usersDir, 'users.module.ts'), getModule('Users', 'users'));
        fs.writeFileSync(path.join(usersDir, 'users.service.ts'), getUsersService());
        fs.writeFileSync(path.join(usersDir, 'users.controller.ts'), getController('Users', 'users', 'users'));
        fs.ensureDirSync(path.join(usersDir, 'dto'));
        fs.writeFileSync(path.join(usersDir, 'dto/users.dto.ts'), getDto('Users'));

        // 6. Generate Auth Service
        const authDir = path.join(appDir, 'src/services/auth');
        fs.ensureDirSync(authDir);
        fs.ensureDirSync(path.join(authDir, 'constants'));
        fs.ensureDirSync(path.join(authDir, 'decorators'));

        fs.writeFileSync(path.join(authDir, 'auth.module.ts'), getAuthModule());
        fs.writeFileSync(path.join(authDir, 'auth.service.ts'), getAuthService());
        fs.writeFileSync(path.join(authDir, 'auth.controller.ts'), getAuthController());
        fs.writeFileSync(path.join(authDir, 'auth.guard.ts'), getAuthGuard());
        fs.writeFileSync(path.join(authDir, 'constants/jwt-constants.ts'), getJwtConstants());
        fs.writeFileSync(path.join(authDir, 'decorators/public.decorator.ts'), getPublicDecorator());

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
    });
