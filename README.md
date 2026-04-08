# NestExtended

NestExtended is a set of packages designed to enhance NestJS development by providing reusable components, utilities, and a powerful CLI for rapid scaffolding.

## Packages

This workspace contains the following packages:

- **[@nest-extended/core](packages/core/README.md)**: Core utilities, decorators, and generic base classes for NestJS applications.
- **[@nest-extended/mongoose](packages/mongoose/README.md)**: Mongoose-specific extensions, including a powerful `NestService` for CRUD operations and query helpers.
- **[@nest-extended/cli](packages/cli/README.md)**: A CLI tool to generate boilerplate code (Modules, Services, Controllers, Schemas, DTOs) ensuring best practices and satisfying dependencies.
- **[@nest-extended/decorators](packages/decorators/README.md)**: Reusable decorators for standardizing controller and service behavior.

---

## Workspace Packages Detail

### `@nest-extended/cli`

A powerful command-line interface for the **NestExtended** ecosystem. This CLI automates the creation of modules, services, controllers, schemas, and DTOs, ensuring your project follows best practices and maintains consistency.

#### Installation

To install globally (recommended for scaffolding new apps):

```bash
npm install -g @nest-extended/cli
# or
yarn global add @nest-extended/cli
```

To install as a dev dependency in an existing project:

```bash
npm install -D @nest-extended/cli
# or
yarn add -D @nest-extended/cli
```

#### Commands

##### Generate Application (`g app`)

Generates a fully configured NestJS application with standard best-practices built right in.
It interactively prompts for your choice of database (currently supporting MongoDB) and handles scaffolding the app. It also prompts whether you want to automatically generate authentication modules.

**Includes:**
- Running `@nestjs/cli`'s `nest new` command internally
- `Mongoose` schema integration out of the box
- Context-mapping out of the box using `nestjs-cls`
- Built-in `AuthModule` with JSON Web Token (JWT) handling via `@nestjs/jwt` and password hashing with `bcrypt` (opt-in)
- Fully functional `UsersModule` equipped with standard fields and authentication logic implementations. (opt-in)
- Pre-configured `NestExtendedModule` context for soft deletes functionality

**Usage:**

```bash
nest-cli g app <app-name>
# or
nest-cli generate app <app-name>
```

**Example:**

```bash
nest-cli g app e-commerce-dashboard
```

##### Generate Authentication (`g auth`)

If you generated a NestJS application without the authentication modules and want to add them later, use the `auth` command. This will scaffold out the `Auth` and `Users` modules, install `@nestjs/jwt` and `bcrypt`, and hook them into your `app.module.ts`.

**Usage:**

```bash
nest-cli g auth
# or
nest-cli generate auth
```

##### Generate Service (`g service`)

Generates a complete resource bundle including:
- **Module**: Registers the controller and service.
- **Service**: Extends `NestService` from `@nest-extended/mongoose`.
- **Controller**: Extends `NestController` from `@nest-extended/core`.
- **Schema**: Mongoose schema with `timestamps` and soft delete fields (only injects `createdBy`, `updatedBy`, `deletedBy` mapping if Auth was generated).
- **DTO**: Data Transfer Object with validation.
- **Specs**: Unit tests for service and controller.

It also automatically updates your `src/app.module.ts` to include the new module.

**Usage:**

```bash
nest-cli g service <name>
# or
nest-cli generate service <name>
```

**Example:**

```bash
nest-cli g service user-profile
```

This will create:
- `src/services/userProfile/userProfile.module.ts`
- `src/services/userProfile/userProfile.service.ts`
- `src/services/userProfile/userProfile.controller.ts`
- `src/services/userProfile/dto/userProfile.dto.ts`
- `src/schemas/userProfile.schema.ts`
- `src/services/userProfile/userProfile.service.spec.ts`
- `src/services/userProfile/userProfile.controller.spec.ts`

---

### `@nest-extended/core`

This package provides the core building blocks for NestJS applications built with the **NestExtended** ecosystem. It includes generic controllers, decorators, and configuration interfaces designed to work seamlessly with `@nest-extended/mongoose`.

#### Key Features

- **Generic Controller (`NestController`)**: A base controller class that handles common CRUD operations (`find`, `get`, `create`, `patch`, `delete`) by delegating to a service implementing `ServiceOptions`.
- **Decorators**: Moved to `@nest-extended/decorators`.
    - `@User()`
    - `@Public()`
    - `@ModifyBody()`

#### Usage

##### NestController

Extend `NestController` to automatically expose standard CRUD endpoints.

```typescript
import { NestController } from '@nest-extended/core';
import { MyService } from './my.service';

@Controller('my-resource')
export class MyController extends NestController<MyResource> {
  constructor(private readonly myService: MyService) {
      super(myService);
  }
}
```

##### Decorators

Decorators have been moved to their own package.

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';
```

---

### `@nest-extended/mongoose`

This package provides powerful Mongoose integrations for the **NestExtended** ecosystem, offering a robust service layer with built-in pagination, filtering, and soft delete capabilities.

#### Key Features

- **NestService**: A generic service class (`NestService<DTO, Document>`) that provides:
    - **CRUD Operations**: `_find`, `_get`, `_create`, `_patch`, `_remove`.
    - **Advanced Querying**: Support for `$regex`, `$or`, and standard MongoDB operators.
    - **Pagination**: Built-in pagination logic using `skip` and `limit`.
    - **Soft Delete**: Configurable soft delete support (requires `@nest-extended/core` integration).
- **Utilities**:
    - `ensureObjectId`: Helper to validate and convert strings to MongoDB ObjectIds.
    - `nestify`: Query helper for applying filters, sorting, and pagination.

#### Usage

##### NestService

Extend `NestService` to create a service with full CRUD capabilities.

```typescript
import { NestService } from '@nest-extended/mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cat, CatDocument } from './schemas/cat.schema';

@Injectable()
export class CatsService extends NestService<Cat, CatDocument> {
  constructor(@InjectModel(Cat.name) catModel: Model<CatDocument>) {
    super(catModel);
  }
}
```

##### Querying

You can use the `_find` method with query objects:

```typescript
const results = await this.catsService._find({
  name: { $regex: 'kitty', $options: 'i' },
  age: { $gt: 5 },
  $sort: { createdAt: -1 },
  $limit: 10
});
```

---

### `@nest-extended/decorators`

This package provides useful decorators for NestJS applications.

#### Key Features

- **`@User()`**: Retrieves the current user from the request (integrates with `nestjs-cls` or request object).
- **`@Public()`**: Marks a route as public (useful for authentication guards).
- **`@ModifyBody()`**: Allows modification of the request body before validation (e.g., setting `createdBy`).

#### Installation

```bash
npm install @nest-extended/decorators
```

#### Usage

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';
import { Controller, Get, Post } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Public()
  @Get()
  findAll() { ... }

  @Post()
  create(@ModifyBody(setCreatedBy()) body: CreateDto) { ... }

  @Get('profile')
  getProfile(@User() user: any) { ... }
}
```

---

## AI Agent Skills

Give your AI agent (Claude Code, Antigravity, Copilot, etc.) full knowledge of the NestExtended ecosystem:

```bash
npx skills add nest-extended/nest-extended
```

This installs the [`skills.md`](skills.md) skill which provides comprehensive package documentation, CLI commands, query parameters, and usage patterns.

For detailed file-level reference, see [`AGENT_CONTEXT.md`](AGENT_CONTEXT.md) — a single-file context that covers every export, every template, and every source file location.

**GitHub**: [github.com/nest-extended/nest-extended](https://github.com/nest-extended/nest-extended)

---

## Getting Started

### Installation

```bash
yarn add @nest-extended/core @nest-extended/mongoose @nest-extended/decorators
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
nest-cli g app my-app
```

This will scaffold a new NestJS generic application complete with Mongoose integration, `nestjs-cls` context mapping, soft-delete configuration, and an interactive prompt to optionally generate user/JWT authentication modules (`Users` and `Auth` services).

### Generate Authentication

If you generated an application without authentication and want to add it later, you can use the `auth` command:

```bash
nest-cli g auth
```

This will automatically install `@nestjs/jwt` and `bcrypt`, scaffold the `Auth` and `Users` modules, and configure `app.module.ts` to support them along with appending `deletedBy` mapping to the global soft-delete configuration.
