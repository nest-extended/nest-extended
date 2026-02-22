import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

export const migrationCommand = new Command('migration')
    .alias('m')
    .description('Migrate project to newer version');

migrationCommand
    .command('run')
    .description('Run migration scripts')
    .action(async () => {
        console.log('Running migration...');
        const files = await glob('src/**/*.ts', { ignore: ['node_modules/**'] });

        let updateCount = 0;

        for (const file of files) {
            const filePath = path.resolve(file);
            let content = await fs.readFile(filePath, 'utf-8');
            let hasChanges = false;

            // Check for imports from @nest-extended/core
            if (content.includes('@nest-extended/core')) {
                // Regex to find named imports from @nest-extended/core
                const importRegex = /import\s+{([^}]+)}\s+from\s+['"]@nest-extended\/core['"];?/g;

                content = content.replace(importRegex, (match: string, imports: string) => {
                    const importedItems = imports.split(',').map((item: string) => item.trim());

                    const decoratorsToMove = ['ModifyBody', 'User', 'Public', 'setCreatedBy'];
                    const movedItems = importedItems.filter((item: string) => decoratorsToMove.includes(item));
                    const remainingItems = importedItems.filter((item: string) => !decoratorsToMove.includes(item));

                    if (movedItems.length > 0) {
                        hasChanges = true;
                        const parts = [];

                        if (remainingItems.length > 0) {
                            parts.push(`import { ${remainingItems.join(', ')} } from '@nest-extended/core';`);
                        }

                        parts.push(`import { ${movedItems.join(', ')} } from '@nest-extended/decorators';`);

                        return parts.join('\n');
                    }

                    return match;
                });
            }

            if (hasChanges) {
                await fs.writeFile(filePath, content, 'utf-8');
                console.log(`Updated ${file}`);
                updateCount++;
            }
        }

        console.log(`Migration completed. Updated ${updateCount} files.`);
    });
