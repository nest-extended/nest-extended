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

    console.log(`Generating service for: ${Name} (${fullPath})`);

    const isAuthGenerated = fs.existsSync(path.join(process.cwd(), 'src/services/auth'));

    // To compute depth for relative imports to src/schemas
    // targetDir is `src/services/qna/category`
    // from targetDir to src is `../../` for `src/services/category`, so `../../` + dirPath depth
    const depth = dirPath ? dirPath.split('/').map(() => '../').join('') + '../../' : '../../';

    createFileWithContent(`src/schemas/${fullPath}.schema.ts`, getSchema(Name, 'Users', isAuthGenerated, dirPath));
    createFileWithContent(`${targetDir}/${name}.module.ts`, getModule(Name, name, fullPath, depth));
    createFileWithContent(`${targetDir}/${name}.service.ts`, getService(Name, name, fullPath));
    createFileWithContent(
        `${targetDir}/${name}.controller.ts`,
        getController(Name, name, rawName, depth, fullPath),
    );
    createFileWithContent(`${targetDir}/dto/${name}.dto.ts`, getDto(Name));
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
};
