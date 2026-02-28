# NestExtended

NestExtended is a set of packages designed to enhance NestJS development by providing reusable components, utilities, and a powerful CLI for rapid scaffolding.

## Packages

This workspace contains the following packages:

- **[@nest-extended/core](packages/core/README.md)**: Core utilities, decorators, and generic base classes for NestJS applications.
- **[@nest-extended/mongoose](packages/mongoose/README.md)**: Mongoose-specific extensions, including a powerful `NestService` for CRUD operations and query helpers.
- **[@nest-extended/cli](packages/cli/README.md)**: A CLI tool to generate boilerplate code (Modules, Services, Controllers, Schemas, DTOs) ensuring best practices and satisfying dependencies.
- **[@nest-extended/decorators](packages/decorators/README.md)**: Reusable decorators for standardizing controller and service behavior.

## Workspace Summary

To add the AI agent skills for this repository, run:
```bash
npx skills add https://github.com/nest-extended/nest-extended/skills --skill nest-extended
```

For information regarding the workspace mechanics and packages:
- **[skills.md](skills.md)**: Documentation of the monorepo structure and comprehensive details of every package.
- **[AGENT_CONTEXT.md](AGENT_CONTEXT.md)**: A high-level prompt summary file to instantly ingest the project architecture in any new session.

## Getting Started

### Installation

```bash
yarn add @nest-extended/core @nest-extended/mongoose
yarn add -D @nest-extended/cli
```

### Usage

Use the CLI to generate a new resource:

```bash
nest-cli g service my-feature
```

This will generate a full set of files (Service, Controller, Module, Schema, DTO) and automatically register the module in your `app.module.ts`.

### Generate Application

Use the CLI to generate an entire pre-configured NestJS application:

```bash
nestx-cli g app my-app
```

This will scaffold a new NestJS generic application complete with Mongoose integration, `nestjs-cls` context mapping, Winston logging setup, soft-delete, and out-of-the-box user/JWT authentication modules.
