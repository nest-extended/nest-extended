import {CONFIG_FILE_NAME, initializeConfig} from "./config-init";
import path from "path";
import fs from "fs";


export async function getConfig() {
    const configFilePath = path.join(process.cwd(), CONFIG_FILE_NAME);

    if (fs.existsSync(configFilePath)) {
        const existingContent = fs.readFileSync(configFilePath, 'utf-8');
        return JSON.parse(existingContent);
    } else {
        await initializeConfig();
        return await getConfig();
    }
}