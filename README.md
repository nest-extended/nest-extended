# NestExtended

NestExtended is a set of packages designed to enhance NestJS development by providing reusable components, utilities, and a powerful CLI for rapid scaffolding.

## Packages

This workspace contains the following packages:

- **[@nest-extended/core](packages/core/README.md)**: Core utilities, decorators, and generic base classes for NestJS applications.
- **[@nest-extended/mongoose](packages/mongoose/README.md)**: Mongoose-specific extensions, including a powerful `NestService` for CRUD operations and query helpers.
- **[@nest-extended/prisma](packages/prisma/README.md)**: Prisma database adapter supporting PostgreSQL, MySQL, and SQLite with FeathersJS-style querying.
- **[@nest-extended/typeorm](packages/typeorm/README.md)**: TypeORM database adapter supporting PostgreSQL, MySQL, and SQLite with the same FeathersJS-style querying.
- **[@nest-extended/cli](packages/cli/README.md)**: A CLI tool to generate boilerplate code (Modules, Services, Controllers, Schemas/Models/Entities, DTOs) ensuring best practices and satisfying dependencies.
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

Generates a fully configured NestJS application with your choice of database and ORM.
It interactively prompts for a database (PostgreSQL, MySQL, SQLite, MongoDB), then an ORM (Prisma or TypeORM for SQL databases; Mongoose for MongoDB), a validation library (`zod` or `class-validator`), and handles scaffolding the app. It also prompts whether you want to automatically generate authentication modules.

**Includes:**
- Running `@nestjs/cli`'s `nest new` command internally
- Database + ORM selection: **Mongoose** (MongoDB), **Prisma** (PostgreSQL/MySQL/SQLite), or **TypeORM** (PostgreSQL/MySQL/SQLite)
- Context-mapping out of the box using `nestjs-cls`
- Built-in `AuthModule` with JSON Web Token (JWT) handling via `@nestjs/jwt` and password hashing with `bcrypt` (opt-in)
- Fully functional `UsersModule` equipped with standard fields and authentication logic (opt-in)
- Pre-configured `NestExtendedModule` context for soft deletes and automatic `qs` query parser
- Validation library choice: `zod` or `class-validator` + `class-transformer` (user selects during generation)

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
- **Service**: Extends `NestService` from `@nest-extended/mongoose`, `@nest-extended/prisma`, or `@nest-extended/typeorm` depending on the ORM selection.
- **Controller**: Standard CRUD controller, calling the event-firing service methods.
- **Events**: A `{name}.events.ts` lifecycle-hooks class, registered in the module's providers — see [Service Events](#service-events). Skip with `--skip-events`.
- **Schema/Model/Entity**: Mongoose schema, Prisma model (appended to `schema.prisma`), or TypeORM entity, all with soft delete fields.
- **DTO**: Data Transfer Object with validation (Zod or class-validator, user selects during generation).
- **Specs**: Unit tests for service and controller.

The CLI prompts for database, ORM, validation library, and whether to generate events, and auto-installs missing packages.

Generated schemas use `select: false` on soft-delete/audit fields (`deleted`, `deletedAt`, `deletedBy`, `updatedBy`) to exclude them from queries by default.

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
- `src/services/userProfile/userProfile.events.ts`
- `src/services/userProfile/dto/userProfile.dto.ts`
- `src/schemas/userProfile.schema.ts`
- `src/services/userProfile/userProfile.service.spec.ts`
- `src/services/userProfile/userProfile.controller.spec.ts`

##### Migration (`m run`, `m events`)

```bash
nest-cli m run          # move relocated decorator imports to @nest-extended/decorators
nest-cli m events       # switch controllers to the event-firing service methods
```

`m events` rewrites `_find`/`_get`/`_create`/`_patch`/`_remove` to `find`/`get`/`create`/
`patch`/`remove` in `src/**/*.controller.ts`, printing every change and asking before it
writes. Use `--dry-run` to preview.

---

### `@nest-extended/core`

This package provides the core building blocks for NestJS applications built with the **NestExtended** ecosystem. It includes generic controllers, decorators, and configuration interfaces designed to work seamlessly with `@nest-extended/mongoose`.

#### Key Features

- **Generic Controller (`NestController`)**: A base controller class that handles common CRUD operations (`find`, `get`, `create`, `patch`, `delete`) by delegating to a service implementing `ServiceOptions`.
- **Decorators**: Moved to `@nest-extended/decorators`.
    - `@User()`
    - `@Public()`
    - `@ModifyBody()`
- **Query Parser**: Auto-configures `qs` as the Express query parser (depth: 20, arrayLimit: 100) via `NestExtendedModule.forRoot()`. Configurable or disable with `queryParser: false`.
- **Service Events**: A per-service hooks class (`NestServiceEvents` + `@ServiceEvents()`) wired at boot by `NestExtendedModule.forRoot()`. See [Service Events](#service-events).

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
    - **CRUD Operations**: `_find`, `_get`, `_create`, `_patch`, `_remove` — plus `find`, `get`, `create`, `patch`, `remove`, which are identical but fire [service events](#service-events).
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

### `@nest-extended/prisma`

This package provides powerful Prisma integrations for the **NestExtended** ecosystem, offering a robust service layer with built-in pagination, filtering, soft delete capabilities, exception filters, and FeathersJS-style query utilities. Supports **PostgreSQL**, **MySQL**, and **SQLite**.

#### Key Features

- **NestService**: A generic service class (`NestService<T>`) that provides:
    - **CRUD Operations**: `_find`, `_get`, `_create`, `_patch`, `_remove` — plus `find`, `get`, `create`, `patch`, `remove`, which are identical but fire [service events](#service-events).
    - **FeathersJS-Style Querying**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$like`, `$notLike`, `$iLike`, `$notILike`, `$or`, `$and`.
    - **Pagination**: Built-in pagination using `$skip` and `$limit`.
    - **Soft Delete**: Configurable soft delete support.
    - **Relations**: `$include` for eager-loading (replaces Mongoose `$populate`).
- **Exception Filters**:
    - `GlobalExceptionFilter` for Prisma, Zod, and HTTP exceptions.
    - `handlePrismaError` for translating Prisma error codes to user-friendly messages.

#### Usage

```typescript
import { NestService } from '@nest-extended/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CatsService extends NestService<any> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.cat);
  }
}
```

##### Querying

```typescript
const results = await this.catsService._find({
  name: { $iLike: 'kitty' },
  age: { $gt: 5 },
  $sort: { createdAt: -1 },
  $limit: 10,
  $include: { owner: true }
});
```

---

### `@nest-extended/typeorm`

This package provides powerful TypeORM integrations for the **NestExtended** ecosystem, with the same service layer, FeathersJS-style query language, pagination, soft delete, and exception filters as the Prisma/Mongoose packages. Supports **PostgreSQL**, **MySQL/MariaDB**, and **SQLite**.

#### Key Features

- **NestService**: A generic service class (`NestService<T>`) that provides:
    - **CRUD Operations**: `_find`, `_get`, `_create`, `_patch`, `_remove` — plus `find`, `get`, `create`, `patch`, `remove`, which are identical but fire [service events](#service-events).
    - **FeathersJS-Style Querying**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$like`, `$notLike`, `$iLike`, `$notILike`, `$or`, `$and` — translated to TypeORM `FindOperator`s.
    - **Pagination**: Built-in pagination using `$skip` and `$limit`.
    - **Soft Delete**: Configurable soft delete support.
    - **Relations**: `$include` for eager-loading (maps to TypeORM `relations`).
- **Exception Filters**:
    - `GlobalExceptionFilter` for TypeORM `QueryFailedError`/`EntityNotFoundError`, Zod, and HTTP exceptions.
    - `handleTypeOrmError` for translating driver error codes (PostgreSQL/MySQL/SQLite) to user-friendly messages.

#### Usage

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestService } from '@nest-extended/typeorm';
import { Cat } from './entities/cat.entity';

@Injectable()
export class CatsService extends NestService<Cat> {
  constructor(@InjectRepository(Cat) repo: Repository<Cat>) {
    super(repo);
  }
}
```

##### Querying

```typescript
const results = await this.catsService._find({
  name: { $like: 'kitty' },
  age: { $gt: 5 },
  $sort: { createdAt: -1 },
  $limit: 10,
  $include: { owner: true }
});
```

---

### `@nest-extended/decorators`

This package provides useful decorators for NestJS applications.

#### Key Features

- **`@User()`**: Retrieves the current user from the request (integrates with `nestjs-cls` or request object).
- **`@Public()`**: Marks a route as public (useful for authentication guards).
- **`@ModifyBody()`**: Allows modification of the request body before validation (e.g., setting `createdBy`).
- **`@UseBefore()` / `@UseAfter()`**: Run an inline function or an injectable handler class around a route handler (or a whole controller). `@UseBefore` is awaited and can reshape the request; `@UseAfter` is detached and cannot alter the response.

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

## Service Events

Every service has two versions of each operation. The underscore ones — `_find`, `_get`,
`_create`, `_patch`, `_remove` — do the work and fire nothing. The plain ones — `find`,
`get`, `create`, `patch`, `remove` — take the same arguments, return the same values, and
additionally dispatch lifecycle hooks to a companion `{name}.events.ts` class.

Use the underscore methods when one service calls another; use the plain ones from
controllers. `nest-cli g service` generates the events file and wires it up by default.

```typescript
// company.events.ts
@Injectable()
@ServiceEvents(CompanyService)
export class CompanyEvents extends NestServiceEvents<CompanyService, CompanyDocument> {
  constructor(
    @InjectModel(CompanyProfile.name)
    private readonly profileModel: Model<CompanyProfileDocument>,   // inject anything
  ) {
    super();
  }

  // Inline and awaited — what you return replaces the input.
  beforeCreate(data: any, ctx: EventContext<CompanyService>) {
    return { ...data, slug: slugify(data.name) };
  }

  // Detached — the response has already been sent.
  async onCreate(company: CompanyDocument, ctx: EventContext<CompanyService>) {
    await this.profileModel.create({ company: company._id, createdBy: ctx.user?._id });
  }
}
```

Hooks: `beforeFind`/`onFind`, `beforeGet`/`onGet`, `beforeCreate`/`onCreate`,
`beforePatch`/`onPatch`, `beforeRemove`/`onRemove`, and `onError`. All optional, all
receive `(payload, ctx)`.

**`on*` hooks never block or alter the response.** They run after it has been sent, their
return values are ignored, and a throw is logged rather than surfaced to the client — so a
failing hook can't break an endpoint, but its work is also not transactional with the
operation. Only `before*` hooks can change input or cancel an operation.

Custom events work the same way — add a method to the events class and `emit` it:

```typescript
async approve(id: string) {
  const doc = await this._patch(id, { status: 'approved' });
  this.emit('approve', doc);      // type-checked against CompanyEvents
  return doc;
}
```

For request- and response-aware logic, use `@UseBefore` / `@UseAfter` from
`@nest-extended/decorators` instead. With `@nestjs/event-emitter` installed, a service can
also `broadcast` its events so other modules can `@OnEvent(...)`.

Existing projects switch their controllers over with `nest-cli m events`.

Full details: [docs/events.md](docs/events.md).

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
# For Mongoose (MongoDB)
yarn add @nest-extended/core @nest-extended/mongoose @nest-extended/decorators

# For Prisma (PostgreSQL, MySQL, SQLite)
yarn add @nest-extended/core @nest-extended/prisma @nest-extended/decorators

# For TypeORM (PostgreSQL, MySQL, SQLite)
yarn add @nest-extended/core @nest-extended/typeorm @nest-extended/decorators

# CLI (recommended as dev dependency)
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

This will scaffold a new NestJS application with your choice of database (PostgreSQL, MySQL, SQLite, or MongoDB) and ORM (Prisma or TypeORM for SQL; Mongoose for MongoDB), `nestjs-cls` context mapping, soft-delete configuration, and an interactive prompt to optionally generate user/JWT authentication modules.

### Generate Authentication

If you generated an application without authentication and want to add it later, you can use the `auth` command:

```bash
nest-cli g auth
```

This will automatically install `@nestjs/jwt` and `bcrypt`, scaffold the `Auth` and `Users` modules, and configure `app.module.ts` to support them along with appending `deletedBy` mapping to the global soft-delete configuration.
