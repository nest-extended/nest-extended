# @nest-extended/cli

A powerful command-line interface for the **NestExtended** ecosystem. This CLI automates the creation of modules, services, controllers, schemas, and DTOs, ensuring your project follows best practices and maintains consistency. It also provides migration tools for upgrading between versions.

## Installation

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

## Commands

### Generate Application (`g app`)

Generates a fully configured NestJS application with standard best-practices built right in.
Prompts for package manager, database, validation library, and whether to scaffold authentication modules — any of these can be supplied as flags to skip the prompt.

**Includes:**
- Running `@nestjs/cli`'s `nest new` command internally
- `Mongoose` schema integration out of the box
- Context-mapping out of the box using `nestjs-cls`
- Built-in `AuthModule` with JSON Web Token (JWT) handling via `@nestjs/jwt` and password hashing with `bcrypt` (opt-in)
- Fully functional `UsersModule` equipped with standard fields and authentication logic implementations (opt-in)
- Pre-configured `NestExtendedModule` context for soft deletes functionality
- `GlobalExceptionFilter` and `NullResponseInterceptor` auto-registered as global providers
- `@nestjs/config` with `.env` file support
- Zod validation library pre-installed
- Auto-linting after generation

**Usage:**

```bash
nest-cli g app <app-name> [options]
# or
nest-cli generate app <app-name> [options]
```

**Flags:**

| Flag | Short | Values | Behavior when omitted |
|---|---|---|---|
| `--pkg-manager <pm>` | `-p`, `--pm` | `npm` \| `yarn` \| `pnpm` | Prompts interactively |
| `--database <type>` | `-d`, `--db` | `Mongoose` \| `PostgreSQL` \| `MySQL` \| `SQLite` | Prompts interactively |
| `--validator <type>` | `-v` | `zod` \| `class-validator` | Prompts interactively |
| `--auth` | — | boolean flag | Prompts interactively |
| `--skip-auth` | — | boolean flag | Prompts interactively |

**Examples:**

```bash
# Fully non-interactive — no prompts at all
nest-cli g app my-api --db Mongoose --validator zod --pm yarn --auth

# Mix — prompts only for what's missing
nest-cli g app my-api --database PostgreSQL --validator class-validator

# Fully interactive (original behavior — prompts for everything)
nest-cli g app e-commerce-dashboard
```

### Generate Authentication (`g auth`)

If you generated a NestJS application without the authentication modules and want to add them later, use the `auth` command. This will scaffold out the `Auth` and `Users` modules, install `@nestjs/jwt` and `bcrypt`, and hook them into your `app.module.ts`.

**What it generates:**
- `src/services/auth/auth.module.ts` — Auth module with JWT configuration and global guard
- `src/services/auth/auth.service.ts` — Service with `signInLocal()` (email/password, bcrypt)
- `src/services/auth/auth.controller.ts` — `/authentication` endpoint with sign-in and verify routes
- `src/services/auth/auth.guard.ts` — JWT auth guard with CLS user injection
- `src/services/auth/constants/jwt-constants.ts` — JWT secret from env or random fallback
- `src/services/users/users.module.ts` — Users module
- `src/services/users/users.service.ts` — NestService extension with `sanitizeUser()`
- `src/services/users/users.controller.ts` — CRUD + password hashing + block endpoint
- `src/schemas/users.schema.ts` — User schema (firstName, lastName, email, password, phone, role)
- `src/services/users/dto/users.dto.ts` — Zod validation schemas

**Usage:**

```bash
nest-cli g auth
# or
nest-cli generate auth
```

### Generate Service (`g service`)

Generates a complete resource bundle including:
- **Module**: Registers the controller and service, imports MongooseModule.forFeature
- **Service**: Extends `NestService` from `@nest-extended/mongoose`
- **Controller**: Custom controller with full CRUD (find, get, create, patch, delete) using `@ModifyBody(setCreatedBy())` and `@User()` decorators. It calls the **event-firing** service methods (`find`, `create`, …) rather than the underscore ones.
- **Events**: A `{name}.events.ts` lifecycle-hooks class, registered in the module's providers (skip with `--skip-events`)
- **Schema**: Mongoose schema with `timestamps` and soft delete fields (only injects `createdBy`, `updatedBy`, `deletedBy` mapping if Auth was generated)
- **DTO**: Data Transfer Object with Zod validation (Create, Patch, Remove schemas + inferred types)
- **Specs**: Unit tests for service and controller

It also automatically updates your `src/app.module.ts` to include the new module.

**Supports nested paths** — use `/` to create nested service directories (e.g., `nest-cli g service qna/category`).

**Usage:**

```bash
nest-cli g service <name> [options]
# or
nest-cli generate service <name> [options]
```

**Flags:**

| Flag | Short | Values | Behavior when omitted |
|---|---|---|---|
| `--database <type>` | `-d`, `--db` | `Mongoose` \| `PostgreSQL` \| `MySQL` \| `SQLite` | Prompts interactively |
| `--validator <type>` | `-v` | `zod` \| `class-validator` | Prompts interactively |
| `--events` / `--skip-events` | — | generate `{name}.events.ts` | Prompts (default **yes**) |
| `--broadcast` / `--skip-broadcast` | — | broadcast events via `@nestjs/event-emitter` | Prompts (default **no**) |

With `--broadcast` the CLI also installs `@nestjs/event-emitter` and adds
`EventEmitterModule.forRoot()` to `src/app.module.ts`.

> Service events are wired at boot by `NestExtendedModule.forRoot()`. If that is missing
> from `src/app.module.ts`, the CLI warns — the generated events class would never fire.

**Examples:**

```bash
# Fully non-interactive — no prompts at all
nest-cli g service category --database Mongoose --validator zod

# Mix — prompts only for what's missing
nest-cli g service category --db PostgreSQL

# Using short flags
nest-cli g service user-profile -d Mongoose -v class-validator

# Fully interactive (original behavior — prompts for everything)
nest-cli g service user-profile

# Skip the events file, or wire up global broadcasting
nest-cli g service category --db Mongoose -v zod --skip-events
nest-cli g service category --db Mongoose -v zod --events --broadcast
```

**Generated files for `nest-cli g service user-profile`:**
- `src/services/userProfile/userProfile.module.ts`
- `src/services/userProfile/userProfile.service.ts`
- `src/services/userProfile/userProfile.controller.ts`
- `src/services/userProfile/userProfile.events.ts` (unless `--skip-events`)
- `src/services/userProfile/dto/userProfile.dto.ts`
- `src/schemas/userProfile.schema.ts`
- `src/services/userProfile/userProfile.service.spec.ts`
- `src/services/userProfile/userProfile.controller.spec.ts`

Nested example:

```bash
nest-cli g service qna/category --db Mongoose -v zod
```

This will create files under `src/services/qna/category/` and `src/schemas/qna/category.schema.ts`.

### Migration (`m run`)

Runs migration scripts to update the codebase for newer versions. Currently handles:
- Moving decorator imports (`ModifyBody`, `User`, `Public`, `setCreatedBy`) from `@nest-extended/core` to `@nest-extended/decorators`

**Usage:**

```bash
nest-cli m run
# or
nest-cli migration run
```

### Migration Events (`m events`)

Switches existing controllers from the event-free `_find` / `_get` / `_create` / `_patch` /
`_remove` to their event-firing counterparts, so a project generated before service events
existed starts firing them.

```bash
nest-cli m events --dry-run     # show what would change
nest-cli m events               # apply, after confirming
nest-cli m events -y            # apply without asking
nest-cli m events --path 'src/**/*.ts'
```

By default it only touches `src/**/*.controller.ts` — service-to-service calls should keep
using the underscore methods so they stay event-free. It prints every replacement with its
file and line before writing.

Because `on*` hooks are detached and cannot alter a response, this migration does not change
any endpoint's output.

### Version

Output the current CLI version:

```bash
nest-cli version
# or
nest-cli v
```

### Help

Display comprehensive help for all commands:

```bash
nest-cli help
```

## Naming Convention

The CLI automatically handles name transformation:
- Accepts kebab-case input: `user-profile`
- Converts to PascalCase for classes: `UserProfile`
- Converts to camelCase for files and variables: `userProfile`
