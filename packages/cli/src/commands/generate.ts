
import { Command } from 'commander';
import { generateServiceAction } from './generate-service';
import { generateAppAction } from './generate-app';

export const generateCommand = new Command('generate')
    .alias('g')
    .description('Generate a new element');

generateCommand
    .command('service <name>')
    .description('Generate a new service')
    .action(generateServiceAction);

generateCommand
    .command('app <name>')
    .description('Generate a new application')
    .action(generateAppAction);
