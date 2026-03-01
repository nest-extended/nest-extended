import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { updateAppModule } from '../lib/update-app-module';
import { generateAuthServices } from '../lib/generate-auth-services';

export const generateAuthAction = async () => {
    const projectDir = process.cwd();
    const appDir = projectDir;
    const authDir = path.join(appDir, 'src/services/auth');

    if (fs.existsSync(authDir)) {
        console.error(chalk.red('Error: Authentication is already generated in this project.'));
        process.exit(1);
    }

    console.log(chalk.blue('Generating authentication (Auth & Users services)...'));

    const pkgManager = fs.existsSync(path.join(projectDir, 'yarn.lock')) ? 'yarn' : fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';

    console.log(chalk.blue('Installing additional dependencies...'));
    await new Promise<void>((resolve, reject) => {
        const installArgs = pkgManager === 'npm' ? ['install'] : ['add'];
        const child = spawn(
            pkgManager,
            [...installArgs, '@nestjs/jwt', 'bcrypt'],
            { stdio: 'inherit', cwd: appDir, shell: true }
        );
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${pkgManager} install failed with code ${code}`));
        });
    });

    console.log(chalk.blue('Installing dev dependencies...'));
    await new Promise<void>((resolve, reject) => {
        const devArgs = pkgManager === 'npm' ? ['install', '-D'] : ['add', '-D'];
        const child = spawn(pkgManager, [...devArgs, '@types/bcrypt'], {
            stdio: 'inherit', cwd: appDir, shell: true
        });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${pkgManager} dev install failed with code ${code}`));
        });
    });

    console.log(chalk.blue('Configuring project...'));

    generateAuthServices(appDir);

    // Update app.module.ts to add modules
    await updateAppModule('Auth', 'auth');
    await updateAppModule('Users', 'users');

    // Update app.module.ts to add deletedBy to softDelete config
    const appModulePath = path.join(appDir, 'src/app.module.ts');
    if (fs.existsSync(appModulePath)) {
        let content = fs.readFileSync(appModulePath, 'utf8');
        // Check if softDelete config exists and doesn't have deletedBy yet
        if (content.includes(`getData: (user: { _id?: string } | null) => ({
          deleted: true,`) && !content.includes('deletedBy: user?._id')) {
            content = content.replace(
                `getData: (user: { _id?: string } | null) => ({
          deleted: true,`,
                `getData: (user: { _id?: string } | null) => ({
          deleted: true,
          deletedBy: user?._id,`
            );
            fs.writeFileSync(appModulePath, content);
            console.log(chalk.green('Updated softDelete configuration in app.module.ts with deletedBy'));
        }
    }

    console.log(chalk.blue('Running lint...'));
    await new Promise<void>((resolve) => {
        const lintChild = spawn(pkgManager, ['run', 'lint'], {
            stdio: 'inherit',
            cwd: projectDir,
            shell: true,
        });
        lintChild.on('close', () => resolve());
    });

    console.log(chalk.green('Authentication generated successfully!'));
};
