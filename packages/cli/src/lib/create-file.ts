
import * as fs from 'fs-extra';
import * as path from 'path';
import * as chalk from 'chalk';

export function createFileWithContent(
    filePath: string,
    content: string,
    callback?: (err?: Error) => void
): void {
    // Extract the directory path from the file path
    const directory = path.dirname(filePath);

    // Create the directory if it doesn't exist
    fs.mkdirSync(directory, { recursive: true });

    // Write the content to the file
    fs.writeFile(filePath, content, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error(chalk.red('Error creating file:'), err);
        } else {
            console.log(chalk.green('File created successfully:'), filePath);
        }

        // Invoke the callback function, if provided
        if (callback) {
            callback(err || undefined);
        }
    });
}
