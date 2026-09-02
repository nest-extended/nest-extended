import * as fs from 'fs-extra';
import * as path from 'path';
import * as chalk from 'chalk';

export interface AppModuleImportOptions {
    /** The full `import { X } from '...';` line to add. */
    importLine: string;
    /** The entry to append to the `imports: [...]` array, e.g. `UserModule`. */
    importsEntry: string;
    /** If this string already appears in the file, there is nothing to do. */
    presenceToken: string;
    /** Existing imports to anchor the new one after. Defaults to the last import in the file. */
    anchor?: RegExp;
    /** Name used in log output. */
    label: string;
}

/**
 * Adds an import line and an `imports: [...]` entry to the app's root module.
 *
 * Shared by service generation and by any feature that needs a module registered
 * (e.g. `EventEmitterModule`), so the bracket-matching insert only exists once.
 *
 * @returns true if the file was changed.
 */
export async function ensureAppModuleImport(
    options: AppModuleImportOptions,
): Promise<boolean> {
    const { importLine, importsEntry, presenceToken, anchor, label } = options;
    const appModulePath = path.join(process.cwd(), 'src/app.module.ts');

    try {
        if (!fs.existsSync(appModulePath)) {
            console.warn(
                chalk.yellow(
                    `Warning: ${appModulePath} not found. Skipping app.module.ts update.`,
                ),
            );
            return false;
        }

        let content = await fs.readFile(appModulePath, 'utf-8');

        if (content.includes(presenceToken)) {
            console.log(chalk.yellow(`${label} is already registered in app.module.ts`));
            return false;
        }

        content = insertImportLine(content, importLine, anchor);
        content = insertImportsEntry(content, importsEntry);

        await fs.writeFile(appModulePath, content, 'utf-8');
        console.log(chalk.green(`Successfully added ${label} to app.module.ts`));
        return true;
    } catch (err: any) {
        console.error(chalk.red('Error updating app.module.ts:'), err.message);
        return false;
    }
}

/** Places the import after the last matching anchor, else after the last import. */
function insertImportLine(content: string, importLine: string, anchor?: RegExp): string {
    if (anchor) {
        const pattern = new RegExp(anchor.source, anchor.flags.includes('g') ? anchor.flags : `${anchor.flags}g`);
        let lastMatch: RegExpExecArray | null = null;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            lastMatch = match;
        }
        if (lastMatch) {
            const insertPosition = lastMatch.index + lastMatch[0].length;
            return content.slice(0, insertPosition) + '\n' + importLine + content.slice(insertPosition);
        }
    }

    const lastImportIndex = content.lastIndexOf('import');
    if (lastImportIndex === -1) return importLine + '\n' + content;

    const lineEnd = content.indexOf('\n', lastImportIndex);
    return content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1);
}

/** Appends an entry to the `imports: [...]` array, matching brackets to find its end. */
function insertImportsEntry(content: string, entry: string): string {
    const importsStartIndex = content.search(/imports:\s*\[/);
    if (importsStartIndex === -1) return content;

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

    if (closingBracketIndex === -1) return content;

    const beforeClosing = content.substring(0, closingBracketIndex);
    const lines = beforeClosing.split('\n');
    const lastLine = lines[lines.length - 1];

    const indentMatch = lastLine.match(/^\s*/);
    const baseIndent = indentMatch ? indentMatch[0] : '    ';

    const contentInside = content.substring(openBracketIndex + 1, closingBracketIndex);
    const trimmedInside = contentInside.trim();
    const needsComma = trimmedInside.length > 0 && !trimmedInside.endsWith(',');
    const prefix = needsComma ? ',' : '';

    const itemIndent = baseIndent + '  ';

    // Drop the whitespace before the closing bracket so it can be re-indented cleanly.
    const trailingWhitespaceMatch = beforeClosing.match(/(\r?\n\s*)$/);
    const trailingWhitespaceLength = trailingWhitespaceMatch ? trailingWhitespaceMatch[0].length : 0;
    const insertionPoint = closingBracketIndex - trailingWhitespaceLength;

    const insertString = `${prefix}\n${itemIndent}${entry},\n${baseIndent}`;

    return content.slice(0, insertionPoint) + insertString + content.slice(closingBracketIndex);
}
