import inquirer from "inquirer";
import path from "path";
import fs from "fs";

export const CONFIG_FILE_NAME = 'nest-extended.config.json';

async function promptPackageManager(): Promise<string> {
    const { packageManager } = await inquirer.prompt([
        {
            type: 'list',
            name: 'packageManager',
            message: 'Select your preferred package manager:',
            choices: ['npm', 'yarn', 'pnpm'],
        },
    ]);

    return packageManager;
}

export async function initializeConfig() {
    const configFilePath = path.join(process.cwd(), CONFIG_FILE_NAME);

    let config: Record<string, any> = {};

    // Check if the file already exists
    if (fs.existsSync(configFilePath)) {
        console.log(`🔄 ${CONFIG_FILE_NAME} already exists. Updating packageManager...`);
        const existingContent = fs.readFileSync(configFilePath, 'utf-8');
        config = JSON.parse(existingContent);
    } else {
        console.log(`📝 Creating a new ${CONFIG_FILE_NAME}...`);
    }

    // Prompt user for package manager
    const packageManager = await promptPackageManager();
    config.packageManager = packageManager;

    // Write the updated config to the file
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log(`✅ ${CONFIG_FILE_NAME} has been updated.`);
}