
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export async function updateAppModule(Name: string, name: string): Promise<void> {
    const appModulePath = path.join(process.cwd(), 'src/app.module.ts');

    try {
        if (!fs.existsSync(appModulePath)) {
            console.warn(chalk.yellow(`Warning: ${appModulePath} not found. Skipping app.module.ts update.`));
            return;
        }

        let content = await fs.readFile(appModulePath, 'utf-8');

        // Check if module is already imported
        const moduleImport = `${Name}Module`;
        if (content.includes(`import { ${moduleImport} }`)) {
            console.log(chalk.yellow(`${moduleImport} is already imported in app.module.ts`));
            return;
        }

        // Find the last module import line (lines importing from './services/')
        const importRegex = /import\s*{\s*\w+Module\s*}\s*from\s*'\.\/services\/[^']+';/g;
        let lastImportMatch: RegExpExecArray | null = null;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            lastImportMatch = match;
        }

        // Create the new import statement
        const newImport = `import { ${Name}Module } from './services/${name}/${name}.module';`;

        if (lastImportMatch) {
            // Insert after the last service module import
            const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
            content = content.slice(0, insertPosition) + '\n' + newImport + content.slice(insertPosition);
        } else {
            // If no service module imports found, add after the last import statement
            const lastImportIndex = content.lastIndexOf('import');
            if (lastImportIndex !== -1) {
                const lineEnd = content.indexOf('\n', lastImportIndex);
                content = content.slice(0, lineEnd + 1) + newImport + '\n' + content.slice(lineEnd + 1);
            } else {
                // Fallback if no imports at all (unlikely)
                content = newImport + '\n' + content;
            }
        }

        // Find the imports array and add the new module at the end
        // Robust bracket matching
        const importsStartIndex = content.search(/imports:\s*\[/);
        if (importsStartIndex !== -1) {
            const openBracketIndex = content.indexOf('[', importsStartIndex);
            let counter = 1;
            let closingBracketIndex = -1;

            for (let i = openBracketIndex + 1; i < content.length; i++) {
                if (content[i] === '[') counter++;
                else if (content[i] === ']') counter--;

                if (counter === 0) {
                    closingBracketIndex = i;
                    break;
                }
            }

            if (closingBracketIndex !== -1) {
                // Logic to determine indentation and prefix
                const beforeClosing = content.substring(0, closingBracketIndex);
                const lines = beforeClosing.split('\n');
                const lastLine = lines[lines.length - 1];

                // use 2 spaces as default indent based on observation
                const indentMatch = lastLine.match(/^\s*/);
                const baseIndent = indentMatch ? indentMatch[0] : '    ';

                // Check if we need a comma for previous item
                const contentInside = content.substring(openBracketIndex + 1, closingBracketIndex);
                const trimmedInside = contentInside.trim();
                // If previous content exists and does not end with comma
                const needsComma = trimmedInside.length > 0 && !trimmedInside.endsWith(',');

                const prefix = needsComma ? ',' : '';

                // Standard formatting: add 2 spaces to base indent for item
                const itemIndent = baseIndent + '  ';

                // Adjust insertion point to remove trailing whitespace/indent before closing bracket
                // This allows us to re-insert the closing bracket indentation correctly
                const trailingWhitespaceMatch = beforeClosing.match(/(\r?\n\s*)$/);
                const trailingWhitespaceLength = trailingWhitespaceMatch ? trailingWhitespaceMatch[0].length : 0;
                const insertionPoint = closingBracketIndex - trailingWhitespaceLength;

                // Construct new content:
                // 1. Prefix (comma if needed)
                // 2. Newline + Item Indent + Module Name + Comma
                // 3. Newline + Base Indent (for closing bracket)

                const insertString = `${prefix}\n${itemIndent}${Name}Module,\n${baseIndent}`;

                // Slice until insertion point (excludes original trailing whitespace)
                // Add insertString
                // Slice from closingBracketIndex (includes closing bracket)
                content = content.slice(0, insertionPoint) + insertString + content.slice(closingBracketIndex);
            }
        }

        await fs.writeFile(appModulePath, content, 'utf-8');
        console.log(chalk.green(`Successfully added ${Name}Module to app.module.ts`));
    } catch (err: any) {
        console.error(chalk.red('Error updating app.module.ts:'), err.message);
    }
}
