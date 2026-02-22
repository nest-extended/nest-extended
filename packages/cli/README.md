# @nest-extended/cli

A powerful command-line interface for the **NestExtended** ecosystem. This CLI automates the creation of modules, services, controllers, schemas, and DTOs, ensuring your project follows best practices and maintains consistency.

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
It interactive prompts for your choice of database (currently supporting MongoDB) and handles scaffolding the app.

**Includes:**
- Running `@nestjs/cli`'s `nest new` command internally
- `Mongoose` schema integration out of the box
- Context-mapping out of the box using `nestjs-cls`
- Built-in `AuthModule` with JSON Web Token (JWT) handling via `@nestjs/jwt` and password hashing with `bcrypt`
- Fully functional `UsersModule` equipped with standard fields and authentication logic implementations.
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

### Generate Service (`g service`)

Generates a complete resource bundle including:
- **Module**: Registers the controller and service.
- **Service**: Extends `NestService` from `@nest-extended/mongoose`.
- **Controller**: Extends `NestController` from `@nest-extended/core`.
- **Schema**: Mongoose schema with `timestamps` and soft delete fields.
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
