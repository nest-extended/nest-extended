
import { Command } from 'commander';
import { generateServiceAction } from './generate-service';
import { generateAppAction } from './generate-app';
import { generateAuthAction } from './generate-auth';

export const generateCommand = new Command('generate')
    .alias('g')
    .description('Generate a new element');

generateCommand
    .command('service <name>')
    .description('Generate a new service')
    .option('-d, --database <type>', 'Database type: PostgreSQL | MySQL | SQLite | MongoDB')
    .option('--db <type>', 'Alias for --database')
    .option('-o, --orm <type>', 'ORM/ODM: prisma | typeorm | mongoose')
    .option('-v, --validator <type>', 'Validation library: zod | class-validator')
    .option('--events', 'Generate a {name}.events.ts lifecycle hooks file (skips prompt)')
    .option('--skip-events', 'Skip the events file (skips prompt)')
    .option('--broadcast', 'Also broadcast events globally via @nestjs/event-emitter (skips prompt)')
    .option('--skip-broadcast', 'Do not broadcast events globally (skips prompt)')
    .action((name, options) => generateServiceAction(name, options));

generateCommand
    .command('app <name>')
    .description('Generate a new application')
    .option('-p, --pkg-manager <pm>', 'Package manager: npm | yarn | pnpm')
    .option('--pm <pm>', 'Alias for --pkg-manager')
    .option('-d, --database <type>', 'Database type: PostgreSQL | MySQL | SQLite | MongoDB')
    .option('--db <type>', 'Alias for --database')
    .option('-o, --orm <type>', 'ORM/ODM: prisma | typeorm | mongoose')
    .option('-v, --validator <type>', 'Validation library: zod | class-validator')
    .option('--auth', 'Generate authentication modules (skips prompt)')
    .option('--skip-auth', 'Skip authentication modules (skips prompt)')
    .action((name, options) => generateAppAction(name, options));

generateCommand
    .command('auth')
    .description('Generate authentication (Auth and Users services)')
    .action(generateAuthAction);
