import * as path from 'path';
import * as fs from 'fs-extra';
import * as chalk from 'chalk';

/**
 * Convert a freshly scaffolded NestJS app from ESM back to CommonJS.
 *
 * `nest new` emits an ESM app from NestJS v12 on (`"type": "module"` plus
 * `module`/`moduleResolution: nodenext`), and there is no CLI flag to opt out.
 * ESM would force an explicit `.js` extension onto every relative import in the
 * code this generator emits, so the app is converted back to CommonJS instead —
 * which also matches the rest of the toolchain (see `configure-prisma-generator.ts`,
 * which pins the Prisma client to `moduleFormat = "cjs"` for the same reason).
 *
 * The Nest v12 packages themselves are ESM-only, but a CommonJS app loads them
 * through Node's `require(esm)` interop, supported on every Node version Nest v12
 * runs on (>= 20.19 / >= 22.12).
 *
 * Three things have to change together:
 *   1. `package.json`  — `"type": "commonjs"`.
 *   2. `tsconfig.json` — CommonJS emit + node resolution, so extensionless
 *      relative imports resolve. `moduleResolution: "node"` is deprecated in
 *      TypeScript 6, hence the accompanying `ignoreDeprecations`.
 *   3. `src/main.ts`   — the scaffold bootstraps with a top-level `await`,
 *      which is only legal in ESM.
 */
export const convertAppToCommonJs = (appDir: string): void => {
    convertPackageJson(appDir);
    convertTsConfig(appDir);
    convertMainBootstrap(appDir);
    console.log(chalk.green('Configured the app for CommonJS.'));
};

/** `"type": "module"` → `"type": "commonjs"`. */
const convertPackageJson = (appDir: string): void => {
    const pkgPath = path.join(appDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.type = 'commonjs';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
};

/**
 * Switch the compiler to CommonJS emit with node resolution. Edited as text so
 * the scaffold's comments and key order survive.
 */
const convertTsConfig = (appDir: string): void => {
    const tsconfigPath = path.join(appDir, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) return;

    let source = fs.readFileSync(tsconfigPath, 'utf8');
    source = source.replace(/"module"\s*:\s*"[^"]*"/, '"module": "commonjs"');
    // `ignoreDeprecations` silences TS6's deprecation error for node10 resolution.
    source = source.replace(
        /"moduleResolution"\s*:\s*"[^"]*"/,
        '"moduleResolution": "node",\n    "ignoreDeprecations": "6.0"',
    );
    // Only meaningful under nodenext resolution; drop it rather than leave it dangling.
    source = source.replace(/\s*"resolvePackageJsonExports"\s*:\s*(true|false),?/, '');
    fs.writeFileSync(tsconfigPath, source);
};

/** `await bootstrap();` is a top-level await — illegal once the app is CommonJS. */
const convertMainBootstrap = (appDir: string): void => {
    const mainPath = path.join(appDir, 'src', 'main.ts');
    if (!fs.existsSync(mainPath)) return;

    const source = fs.readFileSync(mainPath, 'utf8');
    const next = source.replace(/^await\s+bootstrap\(\);/m, 'void bootstrap();');
    if (next !== source) fs.writeFileSync(mainPath, next);
};
