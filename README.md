# NestExtended

NestExtended is a set of packages designed to enhance NestJS development by providing reusable components, utilities, and a powerful CLI for rapid scaffolding.

## Packages

This workspace contains the following packages:

- **[@nest-extended/core](packages/core/README.md)**: Core utilities, decorators, and generic base classes for NestJS applications.
- **[@nest-extended/mongoose](packages/mongoose/README.md)**: Mongoose-specific extensions, including a powerful `NestService` for CRUD operations and query helpers.
- **[@nest-extended/cli](packages/cli/README.md)**: A CLI tool to generate boilerplate code (Modules, Services, Controllers, Schemas, DTOs) ensuring best practices and satisfying dependencies.

## Getting Started

### Installation

```bash
yarn add @nest-extended/core @nest-extended/mongoose
yarn add -D @nest-extended/cli
```

### Usage

Use the CLI to generate a new resource:

```bash
nestx-cli g service my-feature
```

This will generate a full set of files (Service, Controller, Module, Schema, DTO) and automatically register the module in your `app.module.ts`.
