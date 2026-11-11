import * as fs from 'fs-extra';
import * as path from 'path';

export const ensureHealthEndpoint = (appDir: string): void => {
    const appControllerPath = path.join(appDir, 'src/app.controller.ts');

    if (!fs.existsSync(appControllerPath)) return;

    let content = fs.readFileSync(appControllerPath, 'utf8');
    if (content.includes("@Get('health')")) return;

    content = content.replace(
        "import { Controller, Get } from '@nestjs/common';",
        "import { Controller, Get } from '@nestjs/common';\nimport { Public } from '@nest-extended/decorators';",
    );

    const healthMethod = `
  @Public()
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
`;
    content = content.replace('\n}', `${healthMethod}}`);

    fs.writeFileSync(appControllerPath, content);
};