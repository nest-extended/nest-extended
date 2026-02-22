#!/usr/bin/env node
import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { migrationCommand } from './commands/migration';

const program = new Command();

import * as chalk from 'chalk';

program
    .name('nest-cli')
    .description('CLI for @nest-extended packages')
    .version('0.0.1');

program.addCommand(generateCommand);
program.addCommand(migrationCommand);

program.command('help')
    .description('display comprehensive help for all commands')
    .action(() => {
        console.log('');
        console.log(chalk.bold.cyan('🪹  NestExtended CLI'));
        console.log(chalk.gray('   A powerful command-line interface for the NestExtended ecosystem.'));
        console.log('');
        console.log(`${chalk.bold('USAGE')}`);
        console.log(`  $ ${chalk.green('nest-cli')} ${chalk.yellow('[command]')} ${chalk.cyan('[options]')}`);
        console.log('');
        console.log(`${chalk.bold('COMMANDS')}`);

        program.commands.forEach((cmd) => {
            if (cmd.name() === 'help') return;

            const aliases = cmd.alias() ? ` | ${cmd.alias()}` : '';
            console.log(`  ${chalk.green.bold(cmd.name())}${chalk.gray(aliases)}`);
            console.log(`  ${chalk.white(cmd.description())}`);

            if (cmd.commands && cmd.commands.length > 0) {
                console.log('');
                cmd.commands.forEach((sub) => {
                    const args = sub.registeredArguments.map(arg => arg.required ? `<${arg.name()}>` : `[${arg.name()}]`).join(' ');
                    console.log(`    ${chalk.cyan('nest-cli')} ${chalk.cyan(cmd.name())} ${chalk.green(sub.name())} ${chalk.yellow(args)}`);
                    console.log(`    ${chalk.gray('└─')} ${sub.description()}`);
                });
            }
            console.log(''); // spacer
        });

        console.log(`${chalk.bold('OPTIONS')}`);
        console.log(`  ${chalk.cyan('-V, --version')}    Output the version number`);
        console.log(`  ${chalk.cyan('-h, --help')}       Display help for command`);
        console.log('');
    });

program.parse(process.argv);
