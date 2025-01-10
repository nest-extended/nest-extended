import inquirer from 'inquirer';
import fs from "fs";
import path from "path";

async function promptServiceName(): Promise<string> {
    const { serviceName } = await inquirer.prompt([
        {
            type: 'input',
            name: 'serviceName',
            message: 'Enter the service name:',
            validate: (input: string) => input.trim() ? true : 'Service name cannot be empty',
        },
    ]);
    return serviceName;
}

function toCamelCase(input: string): string {
    return input
        .replace(/[-_/](\w)/g, (_, char) => char.toUpperCase()) // Convert after -, _, / to uppercase
        .replace(/^./, char => char.toLowerCase()); // Lowercase first character
}

function getPaths(serviceName: string): { folderPath: string; baseName: string } {
    const normalizedPath = serviceName.split(/[\\/]/).map(toCamelCase).join(path.sep);
    const segments = normalizedPath.split(path.sep);
    const folderPath = path.join(process.cwd(), ...segments.slice(0, -1), segments.slice(-1)[0]);
    const baseName = segments.slice(-1)[0];
    return { folderPath, baseName };
}

function generateFileContent(baseName: string): Record<string, string> {
    return {
        controller: `
import { Controller } from '@nestjs/common';

@Controller('${baseName.toLowerCase()}')
export class ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Controller {}`,
        service: `
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Service {}`,
        module: `
import { Module } from '@nestjs/common';
import { ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Controller } from './${baseName}.controller';
import { ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Service } from './${baseName}.service';

@Module({
  controllers: [${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Controller],
  providers: [${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Service],
})
export class ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Module {}`,
    };
}

export async function generateService() {
    const serviceName = await promptServiceName();
    const { folderPath, baseName } = getPaths(serviceName);

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    const files = generateFileContent(baseName);

    for (const [type, content] of Object.entries(files)) {
        const filePath = path.join(folderPath, `${baseName}.${type}.ts`);
        if (fs.existsSync(filePath)) {
            console.log(`⚠️ File ${filePath} already exists. Skipping.`);
        } else {
            fs.writeFileSync(filePath, content.trim());
            console.log(`✅ Created ${filePath}`);
        }
    }
}