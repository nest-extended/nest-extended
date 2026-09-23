import * as path from 'path';
import * as fs from 'fs-extra';
import * as chalk from 'chalk';

/*
 Prisma 7 removed the implicit `prisma generate` that used to run after
 `prisma migrate dev`. To make sure the generated client never goes stale,
 we inject a set of convenience scripts into the app's package.json so that
 running `prisma:migrate` (or `prisma:push`) always regenerates the client
 automatically.

 Scripts added:
   prisma:generate  – npx prisma generate
   prisma:migrate   – npx prisma migrate dev  &&  npx prisma generate
   prisma:push      – npx prisma db push       &&  npx prisma generate
   prisma:studio    – npx prisma studio
   prisma:reset     – npx prisma migrate reset  &&  npx prisma generate
 */
export const injectPrismaScripts = (projectDir: string): void => {
    const pkgJsonPath = path.join(projectDir, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
        console.warn(chalk.yellow('Warning: package.json not found. Skipping Prisma script injection.'));
        return;
    }

    const appPkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    appPkg.scripts = appPkg.scripts || {};

    const scripts: Record<string, string> = {
        'prisma:generate': 'npx prisma generate',
        // migrate dev + immediate generate so the client is never stale
        'prisma:migrate':  'npx prisma migrate dev && npx prisma generate',
        // db push is handy during prototyping
        'prisma:push':     'npx prisma db push && npx prisma generate',
        'prisma:studio':   'npx prisma studio',
        // reset also re-seeds; regenerate client afterwards
        'prisma:reset':    'npx prisma migrate reset && npx prisma generate',
    };

    let added = 0;
    for (const [key, value] of Object.entries(scripts)) {
        if (!appPkg.scripts[key]) {
            appPkg.scripts[key] = value;
            added++;
        }
    }

    if (added > 0) {
        fs.writeFileSync(pkgJsonPath, JSON.stringify(appPkg, null, 2) + '\n');
        console.log(chalk.green(`Injected ${added} Prisma script(s) into package.json`));
        console.log(chalk.gray('  Use `npm run prisma:migrate` instead of `npx prisma migrate dev`'));
        console.log(chalk.gray('  This chains prisma generate automatically so the client stays fresh.'));
    }
};
