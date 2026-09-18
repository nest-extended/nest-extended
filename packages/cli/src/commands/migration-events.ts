import * as chalk from 'chalk';
import * as fs from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';
import { glob } from 'glob';

const DEFAULT_PATTERN = 'src/**/*.controller.ts';

/** `._find(` -> `.find(`, and the same for get/create/patch/remove. */
const CALL_PATTERN = /\._(find|get|create|patch|remove)\(/g;

interface Replacement {
    line: number;
    method: string;
}

interface FileChange {
    file: string;
    filePath: string;
    content: string;
    replacements: Replacement[];
}

export interface MigrationEventsOptions {
    dryRun?: boolean;
    yes?: boolean;
    path?: string;
}

/**
 * Switches controllers from the event-free `_find`/`_get`/... methods to their
 * event-firing counterparts.
 *
 * Scoped to controllers by default: internal service-to-service calls should keep using
 * the underscore methods so they do not fire events.
 */
export const migrationEventsAction = async (
    options: MigrationEventsOptions = {},
): Promise<void> => {
    const pattern = options.path || DEFAULT_PATTERN;
    const files = await glob(pattern, { ignore: ['node_modules/**', 'dist/**'] });

    const changes = collectChanges(files);

    if (changes.length === 0) {
        console.log(chalk.green(`Nothing to migrate — no underscore calls found in ${pattern}`));
        return;
    }

    const total = changes.reduce((sum, change) => sum + change.replacements.length, 0);

    for (const change of changes) {
        console.log(`\n  ${chalk.cyan(change.file)}`);
        for (const { method, line } of change.replacements) {
            console.log(`    _${method} ${chalk.dim('->')} ${method} ${chalk.dim(`(line ${line})`)}`);
        }
    }
    console.log(`\n${changes.length} file(s), ${total} replacement(s).`);

    if (options.dryRun) {
        console.log(chalk.yellow('Dry run — nothing was written.'));
        return;
    }

    if (!options.yes && !(await confirm())) {
        console.log(chalk.yellow('Aborted.'));
        return;
    }

    for (const change of changes) {
        fs.writeFileSync(change.filePath, change.content, 'utf-8');
        console.log(chalk.green(`Updated ${change.file}`));
    }

    console.log(
        chalk.green(`\nMigration completed. Updated ${changes.length} file(s), ${total} call(s).`),
    );
};

function collectChanges(files: string[]): FileChange[] {
    const changes: FileChange[] = [];

    for (const file of files) {
        const filePath = path.resolve(file);
        const original = fs.readFileSync(filePath, 'utf-8');
        if (!CALL_PATTERN.test(original)) {
            CALL_PATTERN.lastIndex = 0;
            continue;
        }
        CALL_PATTERN.lastIndex = 0;

        const replacements: Replacement[] = [];
        const lines = original.split('\n');

        lines.forEach((line, index) => {
            let match: RegExpExecArray | null;
            CALL_PATTERN.lastIndex = 0;
            while ((match = CALL_PATTERN.exec(line)) !== null) {
                replacements.push({ line: index + 1, method: match[1] });
            }
        });

        changes.push({
            file,
            filePath,
            content: original.replace(CALL_PATTERN, '.$1('),
            replacements,
        });
    }

    return changes;
}

async function confirm(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const answer = await inquirer.prompt([{
        type: 'confirm',
        name: 'apply',
        message: 'Apply these changes?',
        default: true,
    }]);
    return answer.apply;
}
