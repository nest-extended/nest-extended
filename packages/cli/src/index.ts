#!/usr/bin/env node

import { Command } from 'commander';
import { initializer } from "./initializer";
// import { generateCode } from './code-generator';
// import NestService from "@nest-extended/mongoose";
import {generateService} from "./service/generate-service";

const program = new Command();

program
    .name('@nest-extended/cli')
    .description('A CLI for generating NestJS code')
    .version('0.0.1');

program
    .command('init')
    .description('Create or update a nest-extended.config.json file')
    .action(() => {
        // console.log(NestService);
        initializer();
    });

program
    .command('g <type> <name>')
    .description('Generate a NestJS component (e.g., module, controller, service)')
    .action(async (type: string) => {
        // generateCode(type, name);
        if (type === 'service') await generateService();
    });

program.parse(process.argv);
