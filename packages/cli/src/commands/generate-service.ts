import chalk from 'chalk';
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
    // if arg have '-' change to camelCase (Logic from original index.js)
    const argArray = rawName.split('-');
    argArray.forEach((arg, index) => {
        argArray[index] = arg[0].toUpperCase() + arg.slice(1).toLowerCase();
    });
    const Name = argArray.join(''); // PascalCase
    const name = Name[0].toLowerCase() + Name.slice(1); // camelCase

    console.log(`Generating service for: ${Name} (${name})`);

    const isAuthGenerated = fs.existsSync(path.join(process.cwd(), 'src/services/auth'));

    createFileWithContent(`src/schemas/${name}.schema.ts`, getSchema(Name, 'Users', isAuthGenerated));
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
};
