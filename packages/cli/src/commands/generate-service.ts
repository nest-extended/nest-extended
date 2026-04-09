import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as inquirer from 'inquirer';
import { spawn } from 'child_process';
import { createFileWithContent } from '../lib/create-file';
import { updateAppModule } from '../lib/update-app-module';
import { getModule } from '../templates/module.template';
import { getService } from '../templates/service.template';
import { getController } from '../templates/controller.template';
import { getDto } from '../templates/dto.template';
import { getDtoClassValidator } from '../templates/dto-class-validator.template';
import { getSchema } from '../templates/schema.template';
import { getServiceSpec } from '../templates/service.spec.template';
import { getControllerSpec } from '../templates/controller.spec.template';

/**
 * Detect the package manager used in the project.
 */
const detectPackageManager = (projectDir: string): string => {
    if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
    return 'npm';
};

/**
 * Check if a package is installed in node_modules.
 */
const isPackageInstalled = (projectDir: string, packageName: string): boolean => {
    return fs.existsSync(path.join(projectDir, 'node_modules', packageName));
};

/**
 * Install packages if they are not already installed.
 */
const ensurePackagesInstalled = async (projectDir: string, packages: string[]): Promise<void> => {
    const missing = packages.filter(pkg => !isPackageInstalled(projectDir, pkg));
    if (missing.length === 0) return;

    const pkgManager = detectPackageManager(projectDir);
    const installArgs = pkgManager === 'npm' ? ['install'] : ['add'];

    console.log(chalk.blue(`Installing missing packages: ${missing.join(', ')}...`));

    await new Promise<void>((resolve, reject) => {
        const child = spawn(pkgManager, [...installArgs, ...missing], {
            stdio: 'inherit',
            cwd: projectDir,
            shell: true,
        });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${pkgManager} install failed with code ${code}`));
        });
    });

    console.log(chalk.green('Packages installed successfully!'));
};

export const generateServiceAction = async (rawName: string) => {
    const parts = rawName.split('/');
    const rawBasename = parts.pop() || '';
    const dirPath = parts.join('/');

    // if arg have '-' change to camelCase (Logic from original index.js)
    const argArray = rawBasename.split('-');
    argArray.forEach((arg, index) => {
        argArray[index] = arg[0].toUpperCase() + arg.slice(1).toLowerCase();
    });
    const Name = argArray.join(''); // PascalCase
    const name = Name[0].toLowerCase() + Name.slice(1); // camelCase

    const fullPath = dirPath ? `${dirPath}/${name}` : name;
    const targetDir = `src/services/${fullPath}`;

    // Ask user which validator to use
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const { validatorType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'validatorType',
            message: 'Which validation library would you like to use?',
            choices: ['zod', 'class-validator'],
            default: 'zod',
        },
    ]);

    const projectDir = process.cwd();

    // Ensure required validator packages are installed
    if (validatorType === 'zod') {
        await ensurePackagesInstalled(projectDir, ['zod']);
    } else {
        await ensurePackagesInstalled(projectDir, ['class-validator', 'class-transformer']);
    }

    console.log(`Generating service for: ${Name} (${fullPath})`);

    const isAuthGenerated = fs.existsSync(path.join(projectDir, 'src/services/auth'));

    // To compute depth for relative imports to src/schemas
    // targetDir is `src/services/qna/category`
    // from targetDir to src is `../../` for `src/services/category`, so `../../` + dirPath depth
    const depth = dirPath ? dirPath.split('/').map(() => '../').join('') + '../../' : '../../';

    // Generate the DTO based on validator selection
    const dtoContent = validatorType === 'zod' ? getDto(Name) : getDtoClassValidator(Name);

    createFileWithContent(`src/schemas/${fullPath}.schema.ts`, getSchema(Name, 'Users', isAuthGenerated, dirPath));
    createFileWithContent(`${targetDir}/${name}.module.ts`, getModule(Name, name, fullPath, depth));
    createFileWithContent(`${targetDir}/${name}.service.ts`, getService(Name, name, fullPath));
    createFileWithContent(
        `${targetDir}/${name}.controller.ts`,
        getController(Name, name, rawName, depth, fullPath),
    );
    createFileWithContent(`${targetDir}/dto/${name}.dto.ts`, dtoContent);
    createFileWithContent(
        `${targetDir}/${name}.service.spec.ts`,
        getServiceSpec(Name, name),
    );
    createFileWithContent(
        `${targetDir}/${name}.controller.spec.ts`,
        getControllerSpec(Name, name),
    );

    await updateAppModule(Name, name, fullPath);

    console.log(chalk.blue('Running lint...'));
    const pkgManager = detectPackageManager(projectDir);
    await new Promise<void>((resolve) => {
        const lintChild = spawn(pkgManager, ['run', 'lint'], {
            stdio: 'inherit',
            cwd: projectDir,
            shell: true,
        });
        lintChild.on('close', () => resolve());
    });
};
