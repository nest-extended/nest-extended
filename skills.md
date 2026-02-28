# Skills and Architecture Documentation

To add this workspace's skills to an AI agent, run the following command in your terminal:
```bash
npx skills add https://github.com/nest-extended/nest-extended/skills --skill nest-extended
```

Below is an overview of the core packages in the workspace and their roles.

## Workspace Packages (`/packages`)

The `nest-extended` workspace is composed of several specialized, interoperable packages:

### `@nest-extended/core`
Path: `packages/core`
Provides core utilities, decorators, and generic base classes for NestJS applications. This acts as the foundation for the rest of the workspace and provides strict typings.

### `@nest-extended/mongoose`
Path: `packages/mongoose`
Offers Mongoose-specific extensions including a powerful `NestService` for seamless CRUD operations, query helpers, filters, and integrated model types to streamline database interactions without boilerplate.

### `@nest-extended/cli`
Path: `packages/cli`
A robust CLI tool (`nest-cli`, `nestx-cli`) for generating boilerplate code (Modules, Services, Controllers, Schemas, DTOs). It ensures structural best practices, gracefully handles dependency imports, and can scaffold entire pre-configured applications with integrated authentication.

### `@nest-extended/decorators`
Path: `packages/decorators`
Contains standalone generic decorators that can be used across various NestJS modules and services to simplify complex repetitive logic such as request manipulation, logging, or input modifications.
