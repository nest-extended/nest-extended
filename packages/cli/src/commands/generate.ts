
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
    .option('-d, --database <type>', 'Database type: Mongoose | PostgreSQL | MySQL | SQLite')
    .option('--db <type>', 'Alias for --database')
    .option('-v, --validator <type>', 'Validation library: zod | class-validator')
    .action((name, options) => generateServiceAction(name, options));

generateCommand
    .command('app <name>')
    .description('Generate a new application')
    .option('-p, --pkg-manager <pm>', 'Package manager: npm | yarn | pnpm')
    .option('--pm <pm>', 'Alias for --pkg-manager')
    .option('-d, --database <type>', 'Database type: Mongoose | PostgreSQL | MySQL | SQLite')
    .option('--db <type>', 'Alias for --database')
    .option('-v, --validator <type>', 'Validation library: zod | class-validator')
    .option('--auth', 'Generate authentication modules (skips prompt)')
    .option('--skip-auth', 'Skip authentication modules (skips prompt)')
    .action((name, options) => generateAppAction(name, options));

generateCommand
    .command('auth')
    .description('Generate authentication (Auth and Users services)')
    .action(generateAuthAction);
