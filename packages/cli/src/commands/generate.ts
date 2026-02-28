
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
    .action(generateServiceAction);

generateCommand
    .command('app <name>')
    .description('Generate a new application')
    .action(generateAppAction);

generateCommand
    .command('auth')
    .description('Generate authentication (Auth and Users services)')
    .action(generateAuthAction);
