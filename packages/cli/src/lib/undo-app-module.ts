import * as fs from 'fs-extra';
import * as path from 'path';
import * as chalk from 'chalk';

export async function undoAppModule(Name: string, name: string): Promise<void> {
    const appModulePath = path.join(process.cwd(), 'src/app.module.ts');

    try {
        if (!fs.existsSync(appModulePath)) {
            console.warn(chalk.yellow(`Warning: ${appModulePath} not found. Skipping app.module.ts update.`));
            return;
        }

        let content = await fs.readFile(appModulePath, 'utf-8');

        const moduleImport = `${Name}Module`;
        if (!content.includes(`import { ${moduleImport} }`)) {
            console.log(chalk.yellow(`${moduleImport} is not imported in app.module.ts`));
            return;
        }

        // Remove the import line
        const importRegex = new RegExp(`import\\s*{\\s*${moduleImport}\\s*}\\s*from\\s*'\\.\\/services\\/[^']+';\\r?\\n?`, 'g');
        content = content.replace(importRegex, '');

        // Remove the module from the imports array
        // We will match the NameModule in the imports array and remove it, along with trailing/leading comma/whitespace if necessary.
        const moduleInArrayRegex = new RegExp(`\\b${moduleImport}\\b\\s*,?\\s*`, 'g');
        content = content.replace(moduleInArrayRegex, '');

        // Clean up empty lines that might have been left over if we just replaced it with empty string
        content = content.replace(/,\s*,/g, ',');
        content = content.replace(/\[\s*,/g, '[');
        content = content.replace(/,\s*\]/g, ']');

        await fs.writeFile(appModulePath, content, 'utf-8');
        console.log(chalk.green(`Successfully removed ${moduleImport} from app.module.ts`));
    } catch (err) {
        console.error(chalk.red('Error updating app.module.ts:'), err instanceof Error ? err.message : String(err));
    }
}
