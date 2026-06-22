import * as path from 'path';
import * as fs from 'fs-extra';
import * as chalk from 'chalk';

/**
 * The NestJS-compatible Prisma 7 client generator block.
 *
 * Prisma 7's `prisma init` scaffolds the new `prisma-client` generator with an
 * output of `../generated/prisma`. Two things need adjusting for NestJS:
 *   1. `moduleFormat = "cjs"` — Prisma 7 emits ESM by default, which breaks
 *      Nest's CommonJS build.
 *   2. output is moved *inside* `src/` so the whole compiled tree stays under
 *      `src/` (otherwise tsc's inferred rootDir expands to the app root and
 *      shifts the build entry from `dist/main.js` to `dist/src/main.js`,
 *      breaking `nest start`).
 *
 * The generated client lands at `<app>/src/generated/prisma/` and is imported
 * from `<output>/client` (see prisma-setup.template.ts).
 */
const GENERATOR_BLOCK = `generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}`;

/**
 * Normalize the `generator client { ... }` block in prisma/schema.prisma to the
 * NestJS-compatible Prisma 7 configuration above.
 *
 * Single source of truth shared by generate-app.ts and generate-service.ts so
 * the two stay consistent.
 */
export const configurePrismaGenerator = (projectDir: string): void => {
    const schemaPath = path.join(projectDir, 'prisma/schema.prisma');

    if (!fs.existsSync(schemaPath)) {
        console.warn(chalk.yellow('Warning: prisma/schema.prisma not found. Skipping generator configuration.'));
        return;
    }

    const content = fs.readFileSync(schemaPath, 'utf8');
    const generatorRegex = /generator\s+client\s*\{[\s\S]*?\}/;

    let updated: string;
    if (generatorRegex.test(content)) {
        updated = content.replace(generatorRegex, GENERATOR_BLOCK);
    } else {
        // No generator block (unexpected) — prepend one.
        updated = `${GENERATOR_BLOCK}\n\n${content}`;
    }

    fs.writeFileSync(schemaPath, updated);
    console.log(chalk.green('Configured Prisma client generator (prisma-client, cjs) in schema.prisma'));
};

/**
 * Ensure the generated Prisma client directory is gitignored.
 */
export const ignoreGeneratedPrismaClient = (projectDir: string): void => {
    const gitignorePath = path.join(projectDir, '.gitignore');
    const entry = '/src/generated';

    let content = '';
    if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf8');
    }

    const alreadyIgnored = content
        .split('\n')
        .map((line) => line.trim())
        .includes(entry);

    if (alreadyIgnored) return;

    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(gitignorePath, `${prefix}\n# Prisma generated client\n${entry}\n`);
};
