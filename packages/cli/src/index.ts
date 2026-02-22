#!/usr/bin/env node
import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { migrationCommand } from './commands/migration';

const program = new Command();

program
    .name('nestx-cli')
    .description('CLI for @nest-extended packages')
    .version('0.0.1');

program.addCommand(generateCommand);
program.addCommand(migrationCommand);

program.parse(process.argv);
