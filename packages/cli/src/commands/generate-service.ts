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
import { getPrismaService } from '../templates/prisma-service.template';
import { getPrismaModule } from '../templates/prisma-module.template';
import { getPrismaModel } from '../templates/prisma-model.template';
import { getPrismaController } from '../templates/prisma-controller.template';
import { getPrismaDto } from '../templates/prisma-dto.template';
import { getPrismaDtoClassValidator } from '../templates/prisma-dto-class-validator.template';
import { getPrismaServiceFile, getPrismaModuleFile } from '../templates/prisma-setup.template';

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

/**
 * Install dev dependencies if not already installed.
 */
const ensureDevPackagesInstalled = async (projectDir: string, packages: string[]): Promise<void> => {
    const missing = packages.filter(pkg => !isPackageInstalled(projectDir, pkg));
    if (missing.length === 0) return;

    const pkgManager = detectPackageManager(projectDir);
    const installArgs = pkgManager === 'npm' ? ['install', '-D'] : ['add', '-D'];

    console.log(chalk.blue(`Installing missing dev packages: ${missing.join(', ')}...`));

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

    console.log(chalk.green('Dev packages installed successfully!'));
};

/**
 * Ensure Prisma is initialized and PrismaModule/Service exist.
 */
const ensurePrismaSetup = async (projectDir: string, dbType: string): Promise<void> => {
    const prismaSchemaPath = path.join(projectDir, 'prisma/schema.prisma');

    // Initialize Prisma if schema.prisma doesn't exist
    if (!fs.existsSync(prismaSchemaPath)) {
        let datasourceProvider = 'postgresql';
        if (dbType === 'MySQL') datasourceProvider = 'mysql';
        else if (dbType === 'SQLite') datasourceProvider = 'sqlite';

        console.log(chalk.blue(`Initializing Prisma with ${datasourceProvider}...`));

        await new Promise<void>((resolve, reject) => {
            const child = spawn('npx', ['prisma', 'init', '--datasource-provider', datasourceProvider], {
                stdio: 'inherit',
                cwd: projectDir,
                shell: true,
            });
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`prisma init failed with code ${code}`));
            });
        });
    }

    // Create PrismaService and PrismaModule if they don't exist
    const prismaServicePath = path.join(projectDir, 'src/prisma/prisma.service.ts');
    const prismaModulePath = path.join(projectDir, 'src/prisma/prisma.module.ts');

    if (!fs.existsSync(prismaServicePath)) {
        fs.ensureDirSync(path.join(projectDir, 'src/prisma'));
        fs.writeFileSync(prismaServicePath, getPrismaServiceFile());
        console.log(chalk.green('Created src/prisma/prisma.service.ts'));
    }

    if (!fs.existsSync(prismaModulePath)) {
        fs.writeFileSync(prismaModulePath, getPrismaModuleFile());
        console.log(chalk.green('Created src/prisma/prisma.module.ts'));
    }
};

/**
 * Append a Prisma model to schema.prisma if it doesn't already exist.
 */
const appendPrismaModel = (projectDir: string, Name: string, isAuthGenerated: boolean): void => {
    const prismaSchemaPath = path.join(projectDir, 'prisma/schema.prisma');

    if (!fs.existsSync(prismaSchemaPath)) {
        console.warn(chalk.yellow('Warning: prisma/schema.prisma not found. Skipping model creation.'));
        return;
    }

    const content = fs.readFileSync(prismaSchemaPath, 'utf8');

    // Check if model already exists
    if (content.includes(`model ${Name} {`)) {
        console.log(chalk.yellow(`Model ${Name} already exists in schema.prisma`));
        return;
    }

    const modelBlock = getPrismaModel(Name, isAuthGenerated);
    fs.appendFileSync(prismaSchemaPath, '\n' + modelBlock);
    console.log(chalk.green(`Added model ${Name} to prisma/schema.prisma`));
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

    // Ask user which database to use
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const { databaseType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'databaseType',
            message: 'Which database would you like to use?',
            choices: ['Mongoose', 'PostgreSQL', 'MySQL', 'SQLite'],
            default: 'Mongoose',
        },
    ]);

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
    const isPrisma = databaseType !== 'Mongoose';

    // Ensure required validator packages are installed
    if (validatorType === 'zod') {
        await ensurePackagesInstalled(projectDir, ['zod']);
    } else {
        await ensurePackagesInstalled(projectDir, ['class-validator', 'class-transformer']);
    }

    // Ensure database-specific packages are installed
    if (isPrisma) {
        await ensurePackagesInstalled(projectDir, ['@prisma/client', '@nest-extended/prisma']);
        await ensureDevPackagesInstalled(projectDir, ['prisma']);
        await ensurePrismaSetup(projectDir, databaseType);
    }

    console.log(`Generating service for: ${Name} (${fullPath}) using ${databaseType}`);

    const isAuthGenerated = fs.existsSync(path.join(projectDir, 'src/services/auth'));

    if (isPrisma) {
        // --- Prisma-based generation ---

        // Generate DTO
        const dtoContent = validatorType === 'zod' ? getPrismaDto(Name) : getPrismaDtoClassValidator(Name);

        // Append model to schema.prisma
        appendPrismaModel(projectDir, Name, isAuthGenerated);

        // Generate service files
        createFileWithContent(`${targetDir}/${name}.module.ts`, getPrismaModule(Name, name));
        createFileWithContent(`${targetDir}/${name}.service.ts`, getPrismaService(Name, name));
        createFileWithContent(`${targetDir}/${name}.controller.ts`, getPrismaController(Name, name, rawName));
        createFileWithContent(`${targetDir}/dto/${name}.dto.ts`, dtoContent);
        createFileWithContent(`${targetDir}/${name}.service.spec.ts`, getServiceSpec(Name, name));
        createFileWithContent(`${targetDir}/${name}.controller.spec.ts`, getControllerSpec(Name, name));

    } else {
        // --- Mongoose-based generation (existing behavior) ---

        // To compute depth for relative imports to src/schemas
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
    }

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
