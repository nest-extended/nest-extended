import { ensureAppModuleImport } from './ensure-app-module-import';

/** Registers a generated feature module in the app's root module. */
export async function updateAppModule(
    Name: string,
    name: string,
    fullPath: string = name,
): Promise<void> {
    await ensureAppModuleImport({
        importLine: `import { ${Name}Module } from './services/${fullPath}/${name}.module';`,
        importsEntry: `${Name}Module`,
        presenceToken: `import { ${Name}Module }`,
        anchor: /import\s*{\s*\w+Module\s*}\s*from\s*'\.\/services\/[^']+';/g,
        label: `${Name}Module`,
    });
}

/**
 * Registers `EventEmitterModule.forRoot()` so services with `broadcast` set can emit
 * globally. No-op if it is already there.
 */
export async function ensureEventEmitterModule(): Promise<void> {
    await ensureAppModuleImport({
        importLine: `import { EventEmitterModule } from '@nestjs/event-emitter';`,
        importsEntry: `EventEmitterModule.forRoot()`,
        presenceToken: `EventEmitterModule`,
        label: 'EventEmitterModule',
    });
}
