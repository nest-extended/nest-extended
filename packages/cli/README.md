# @nest-extended/cli

A powerful command-line interface for the **NestExtended** ecosystem. This CLI automates the creation of modules, services, controllers, schemas, and DTOs, ensuring your project follows best practices and maintains consistency.

## Installation

```bash
yarn add -D @nest-extended/cli
# or
npm install -D @nest-extended/cli
```

## Commands

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
nestx-cli g service <name>
# or
nestx-cli generate service <name>
```

**Example:**

```bash
nestx-cli g service user-profile
```

This will create:
- `src/services/userProfile/userProfile.module.ts`
- `src/services/userProfile/userProfile.service.ts`
- `src/services/userProfile/userProfile.controller.ts`
- `src/services/userProfile/dto/userProfile.dto.ts`
- `src/schemas/userProfile.schema.ts`
- `src/services/userProfile/userProfile.service.spec.ts`
- `src/services/userProfile/userProfile.controller.spec.ts`
