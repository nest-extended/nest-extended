# Agent Context — NestExtended Monorepo

> **Purpose**: This file is the single source of truth for AI agents (Antigravity, Claude Code, etc.).
> After reading this file, an agent should have **complete** understanding of the repository's structure,
> every package, every exported API, every CLI command, every template, the build/release pipeline,
> and the CI/CD workflow — **without needing to explore the source code again**.

---

## 1. Project Overview

**NestExtended** is a TypeScript monorepo providing reusable packages and a CLI to supercharge NestJS development.
It offers generic CRUD services, controllers, decorators, Mongoose integrations, exception filters,
and a scaffolding CLI that generates entire NestJS applications with optional JWT authentication.

| Field | Value |
|---|---|
| Workspace name | `@nest-extended/source` |
| Version | `0.0.2-beta-14` |
| License | MIT |
| Package manager | Yarn (v1) |
| Monorepo tool | Nx 22.x |
| Node target | 20 |
| TypeScript target | ES2015 |
| Module system | CommonJS |

### Contributors

- **Soubhik Kumar Gon** — [GitHub](https://github.com/zakhaev26)
- **Santanu Prasad Sahoo** — [GitHub](https://github.com/santanup)

---

## 2. Repository Structure

```
nest-extended/
├── AGENT_CONTEXT.md          ← This file (AI agent context)
├── README.md                 ← Root README with full project overview
├── package.json              ← Workspace root package.json
├── nx.json                   ← Nx workspace configuration
├── tsconfig.base.json        ← Base TypeScript config with path aliases
├── yarn.lock
├── eslint.config.mjs         ← Root ESLint config
├── skills.md                 ← AI skills documentation
├── skills-lock.json
├── .github/
│   ├── dependabot.yml        ← Dependabot config (npm + GitHub Actions)
│   └── workflows/
│       ├── ci.yml            ← CI: build & verify on push/PR to main
│       └── publish.yml       ← Publish: tag-triggered NPM publish
├── scripts/
│   └── release.js            ← Version bump + git tag script
├── packages/
│   ├── core/                 ← @nest-extended/core
│   ├── mongoose/             ← @nest-extended/mongoose
│   ├── prisma/               ← @nest-extended/prisma
│   ├── typeorm/              ← @nest-extended/typeorm
│   ├── cli/                  ← @nest-extended/cli
│   └── decorators/           ← @nest-extended/decorators
├── .agents/                  ← Agent skills (Nx generators, workspaces, etc.)
└── dist/                     ← Build output (dist/packages/<name>)
```

---

## 3. README File Paths

These are all the README files in the repository. Read these for detailed feature documentation:

| Package | README Path |
|---|---|
| Root | [`README.md`](README.md) |
| Core | [`packages/core/README.md`](packages/core/README.md) |
| Mongoose | [`packages/mongoose/README.md`](packages/mongoose/README.md) |
| Prisma | [`packages/prisma/README.md`](packages/prisma/README.md) |
| TypeORM | [`packages/typeorm/README.md`](packages/typeorm/README.md) |
| CLI | [`packages/cli/README.md`](packages/cli/README.md) |
| Decorators | [`packages/decorators/README.md`](packages/decorators/README.md) |

---

## 4. Published Packages — Complete Reference

### 4.1 `@nest-extended/core`

**Path**: `packages/core/`
**NPM**: `@nest-extended/core`
**Dependencies**: `tslib`, `qs`, `@nest-extended/decorators` (peer), `nestjs-cls` (peer), `@nestjs/common` (peer)

#### Source Layout

```
packages/core/src/
├── index.ts                          ← Public exports
├── index.d.ts                        ← ServiceOptions type declaration
├── lib/
│   ├── nest.controller.ts            ← NestController<T> base class
│   └── nest-extended.module.ts       ← NestExtendedModule dynamic module
├── common/
│   ├── cls.helper.ts                 ← getCurrentUser(), CLS_KEYS
│   ├── options.ts                    ← Default options object
│   └── constants.ts                  ← WeekDays enum, EachSlotDurationInMinutes
├── interceptors/
│   └── null-response.interceptor.ts  ← NullResponseInterceptor
└── types/
    ├── nest-extended.config.ts       ← NestExtendedConfig, SoftDeleteConfig, QueryParserConfig, NEST_EXTENDED_CONFIG
    ├── ServiceOptions.ts             ← ServiceOptions<T>, NestServiceOptions
    ├── PaginatedResponse.ts          ← PaginatedResponse<D>
    └── RequestBody.ts                ← Re-export of RequestBody from decorators
```

#### Exported API

| Export | Kind | Description |
|---|---|---|
| `NestController<T>` | Class | Generic CRUD controller with `find`, `get`, `create`, `patch`, `delete` endpoints. Auto-applies `@Public()` on `find`, `@ModifyBody(setCreatedBy())` on `create`, `@User()` on `delete`. |
| `NestExtendedModule` | Module | Dynamic module — `NestExtendedModule.forRoot(config)` provides global `NEST_EXTENDED_CONFIG`. Auto-configures `qs` query parser on bootstrap. |
| `options` | Object | Defaults: `deleteKey='deleted'`, `defaultPagination=true`, `defaultLimit=20`, `defaultSkip=0`, `multi=false`. |
| `getCurrentUser<T>()` | Function | Retrieve authenticated user from CLS context. Returns `undefined` if unavailable. |
| `CLS_KEYS` | Const | `{ USER: 'user' }` — CLS storage keys. |
| `NullResponseInterceptor` | Interceptor | Throws `NotFoundException` when GET handlers return `null`/`undefined`. |
| `NestExtendedConfig` | Interface | `{ softDelete?: SoftDeleteConfig, queryParser?: QueryParserConfig \| boolean }` |
| `SoftDeleteConfig` | Interface | `{ getQuery: () => Record, getData: (user) => Record }` |
| `QueryParserConfig` | Interface | `{ depth?: number, arrayLimit?: number, allowDots?: boolean }` — defaults: 20, 100, false |
| `NEST_EXTENDED_CONFIG` | Symbol | Injection token for `NestExtendedConfig`. |
| `ServiceOptions<T>` | Interface | Contract: `_find`, `_get`, `_create`, `_patch`, `_remove`. |
| `NestServiceOptions` | Type | `{ multi?: boolean, softDelete?: boolean, pagination?: boolean }` |
| `PaginatedResponse<D>` | Interface | `{ total: number, $limit: number, $skip: number, data: D[] }` |
| `RequestBody` | Type | Re-export from `@nest-extended/decorators`. |
| `WeekDays` | Enum | `sunday` through `saturday`. |
| `EachSlotDurationInMinutes` | Const | `30` |

---

### 4.2 `@nest-extended/mongoose`

**Path**: `packages/mongoose/`
**NPM**: `@nest-extended/mongoose`
**Dependencies**: `tslib`, `@nest-extended/core`, `zod`, `mongoose` (peer), `@nestjs/common` (peer), `lodash` (peer)

#### Source Layout

```
packages/mongoose/src/
├── index.ts                          ← Public exports
├── lib/
│   ├── nest.service.ts               ← NestService<M, D> generic service
│   └── mongoose.ts                   ← Placeholder utility
├── common/
│   ├── nestify.ts                    ← nestify() query helper
│   ├── query.utils.ts               ← rawQuery, assignFilters, filterQuery, cleanQuery, FILTERS, OPERATORS
│   └── ensureObjectId.ts            ← EnsureObjectId utility
├── filters/
│   ├── global-exception.filter.ts   ← GlobalExceptionFilter (catch-all)
│   └── mongo-error.filter.ts        ← handleMongoError (error code translator)
├── interceptors/                     ← (empty, reserved)
└── types/
    └── Nestify.ts                    ← NestifyFilters, NestifyOptions interfaces
```

#### NestService — Full Method Reference

| Method | Signature | Description |
|---|---|---|
| `_find` | `(query?, findOptions?) → PaginatedResponse<D> \| D[]` | Find with filters, sorting, pagination. Supports `{ pagination: false }`. |
| `_get` | `(id, query?) → D \| null` | Find single document by ID. |
| `_create` | `(data) → D` or `(data[]) → D[]` | Create one or many (requires `multi: true` for arrays). |
| `_patch` | `(id, data, query?) → D \| D[] \| null` | Update by ID or bulk update by query (id=null). Uses `findOneAndUpdate` (single) or `updateMany` (bulk). |
| `_remove` | `(id, query?, user?) → D \| D[] \| null` | Soft delete (patches `deleted=true`, `deletedBy`, `deletedAt`) or hard delete depending on config. User from param or CLS fallback. |
| `getCount` | `(filter) → number` | Count documents matching filter. |

**Constructor**: `new NestService(model, serviceOptions?, softDeleteConfig?)`
- `serviceOptions`: `{ multi: false, softDelete: true, pagination: true }` (defaults)
- `softDeleteConfig`: Custom `SoftDeleteConfig` or falls back to `{ deleted: { $ne: true } }` filter

#### Query Special Parameters

| Param | Effect |
|---|---|
| `$sort` | Sort order — e.g., `{ createdAt: -1 }` |
| `$limit` | Max documents to return (default: 20) |
| `$skip` | Documents to skip (default: 0) |
| `$select` | Field projection — array of field names, string, or object |
| `$populate` | Mongoose populate — string, object, or array |
| `$regex` | Regex filter — `{ $regex: { fieldName: 'pattern' } }` → case-insensitive |
| `$or` | OR query — `{ $or: [{ field1: value }, { field2: value }] }` |

#### Supported MongoDB Operators

`$in`, `$nin`, `$lt`, `$lte`, `$gt`, `$gte`, `$ne`, `$or`

#### Exception Filters

**`GlobalExceptionFilter`** — Catch-all filter handling:
- `HttpException` → standard NestJS response
- `MongooseError` → 400 BadRequest
- `ZodError` → 400 BadRequest
- `MongoServerError` → translated error message (see below)
- Unknown → 500 with stack trace (hidden in production)

**MongoDB Error Codes Handled**:
| Code | Message |
|---|---|
| 11000 | Duplicate key violation |
| 121 | Document validation failure |
| 66 | Immutable field modification |
| 50 | Operation timeout |
| 16755 | Invalid aggregation pipeline |
| 40324 | Invalid index options |
| 8000 | Transaction error |
| 31 | Memory limit exceeded |

#### Exported API

| Export | Kind | Description |
|---|---|---|
| `NestService<M, D>` | Class | Generic CRUD service |
| `nestify` | Function | Apply filters/pagination to Mongoose query |
| `rawQuery` | Function | Convert query params to MongoDB filter |
| `assignFilters` | Function | Extract filter params |
| `filterQuery` | Function | Full query parser |
| `cleanQuery` | Function | Validate query operators |
| `FILTERS` | Object | Filter converters (`$sort`, `$limit`, `$skip`, `$select`, `$populate`) |
| `OPERATORS` | Array | Valid MongoDB operators list |
| `EnsureObjectId` | Function | Validate/convert to ObjectId |
| `GlobalExceptionFilter` | Filter | Catch-all exception handler |
| `handleMongoError` | Function | MongoDB error message translator |
| `NestifyFilters` | Interface | Filter types |
| `NestifyOptions` | Interface | Pagination defaults |

---

### 4.3 `@nest-extended/prisma`

**Path**: `packages/prisma/`
**NPM**: `@nest-extended/prisma`
**Dependencies**: `tslib`, `@nest-extended/core`, `zod`, `@prisma/client` (peer), `@nestjs/common` (peer), `lodash` (peer)

#### Source Layout

```
packages/prisma/src/
├── index.ts                          ← Public exports
├── lib/
│   └── nest.service.ts               ← NestService<T> generic service for Prisma
├── common/
│   ├── query.utils.ts                ← rawQuery, assignFilters, filterQuery, cleanQuery, FILTERS, OPERATORS
│   └── apply-filters.ts             ← applyFilters() query helper (replaces Mongoose nestify)
├── filters/
│   ├── global-exception.filter.ts   ← GlobalExceptionFilter (catch-all, Prisma-aware)
│   └── prisma-error.filter.ts       ← handlePrismaError (error code translator)
└── types/
    └── PrismaFilters.ts              ← PrismaFilters, PrismaFilterOptions interfaces
```

#### NestService — Full Method Reference

| Method | Signature | Description |
|---|---|---|
| `_find` | `(query?, findOptions?) → PaginatedResponse<T> \| T[]` | Find with filters, sorting, pagination. Supports `{ pagination: false }`. |
| `_get` | `(id, query?) → T \| null` | Find single record by ID. |
| `_create` | `(data) → T` or `(data[]) → T[]` | Create one or many (requires `multi: true` for arrays). |
| `_patch` | `(id, data, query?) → T \| T[] \| null` | Update by ID or bulk update by query (id=null). Uses `update` (single) or `updateMany` (bulk). |
| `_remove` | `(id, query?, user?) → T \| T[] \| null` | Soft delete (patches `deleted=true`, `deletedBy`, `deletedAt`) or hard delete depending on config. User from param or CLS fallback. |
| `getCount` | `(filter) → number` | Count records matching filter. |

**Constructor**: `new NestService(prismaModel, serviceOptions?, softDeleteConfig?)`
- `prismaModel`: Prisma delegate (e.g., `prisma.user`)
- `serviceOptions`: `{ multi: false, softDelete: true, pagination: true }` (defaults)
- `softDeleteConfig`: Custom `SoftDeleteConfig` or falls back to `{ deleted: { not: true } }` filter

#### Query Operators (FeathersJS-style)

| Operator | Prisma Translation |
|---|---|
| `$eq` | `{ field: value }` |
| `$ne` | `{ field: { not: value } }` |
| `$gt` | `{ field: { gt: value } }` |
| `$gte` | `{ field: { gte: value } }` |
| `$lt` | `{ field: { lt: value } }` |
| `$lte` | `{ field: { lte: value } }` |
| `$in` | `{ field: { in: [values] } }` |
| `$nin` | `{ field: { notIn: [values] } }` |
| `$like` | `{ field: { contains: value } }` |
| `$notLike` | `{ field: { not: { contains: value } } }` |
| `$iLike` | `{ field: { contains: value, mode: 'insensitive' } }` (PostgreSQL) |
| `$notILike` | `{ NOT: { field: { contains: value, mode: 'insensitive' } } }` |
| `$or` | `{ OR: [...conditions] }` |
| `$and` | `{ AND: [...conditions] }` |

#### Query Special Parameters

| Param | Effect |
|---|---|
| `$sort` | Sort order — `{ createdAt: -1 }` → `orderBy: { createdAt: 'desc' }` |
| `$limit` | Max records to return (default: 20), maps to Prisma `take` |
| `$skip` | Records to skip (default: 0), maps to Prisma `skip` |
| `$select` | Field projection — array of field names, string, or object → Prisma `select` |
| `$include` | Eager-load relations — `{ $include: { posts: true } }` → Prisma `include` |

#### Exception Filters

**`GlobalExceptionFilter`** — Catch-all filter handling:
- `HttpException` → standard NestJS response
- `PrismaClientKnownRequestError` → translated error message (see below)
- `PrismaClientValidationError` → 400 BadRequest
- `ZodError` → 400 BadRequest
- Unknown → 500 with stack trace (hidden in production)

**Prisma Error Codes Handled**:
| Code | Message |
|---|---|
| P2002 | Unique constraint violation (duplicate key) |
| P2003 | Foreign key constraint violation |
| P2025 | Record not found |
| P2014 | Relation violation |
| P2000 | Value too long for column |
| P2006 | Invalid value provided |
| P2011 | Null constraint violation |
| P2024 | Connection pool timeout |
| P2021 | Table does not exist |
| P2022 | Column does not exist |

#### Exported API

| Export | Kind | Description |
|---|---|---|
| `NestService<T>` | Class | Generic CRUD service for Prisma |
| `applyFilters` | Function | Apply $select/$include/$sort/$limit/$skip to Prisma query |
| `rawQuery` | Function | Convert FeathersJS-style query to Prisma `where` clause |
| `assignFilters` | Function | Extract filter params |
| `filterQuery` | Function | Full query parser |
| `cleanQuery` | Function | Validate query operators |
| `FILTERS` | Object | Filter converters (`$sort`, `$limit`, `$skip`, `$select`, `$include`) |
| `OPERATORS` | Array | Valid operator list |
| `GlobalExceptionFilter` | Filter | Catch-all exception handler (Prisma-aware) |
| `handlePrismaError` | Function | Prisma error message translator |
| `PrismaFilters` | Interface | Filter types |
| `PrismaFilterOptions` | Interface | Pagination defaults |

---

### 4.4 `@nest-extended/typeorm`

**Path**: `packages/typeorm/`
**NPM**: `@nest-extended/typeorm`
**Dependencies**: `tslib`, `@nest-extended/core`, `zod`, `typeorm` (peer), `@nestjs/typeorm` (peer), `@nestjs/common` (peer), `lodash` (peer)

Same API surface and FeathersJS-style query language as the Prisma/Mongoose adapters. Supports PostgreSQL, MySQL/MariaDB, SQLite.

#### Source Layout

```
packages/typeorm/src/
├── index.ts                          ← Public exports
├── lib/
│   └── nest.service.ts               ← NestService<T> generic service over a TypeORM Repository
├── common/
│   ├── query.utils.ts                ← rawQuery, assignFilters, filterQuery, cleanQuery, FILTERS, OPERATORS
│   └── apply-filters.ts             ← applyFilters() query helper
├── filters/
│   ├── global-exception.filter.ts   ← GlobalExceptionFilter (catch-all, TypeORM-aware)
│   └── typeorm-error.filter.ts      ← handleTypeOrmError (driver error code translator)
└── types/
    └── TypeOrmFilters.ts            ← TypeOrmFilters, TypeOrmFilterOptions interfaces
```

#### NestService — Full Method Reference

Same methods/signatures as Prisma: `_find`, `_get`, `_create`, `_patch`, `_remove`, `getCount`.

**Constructor**: `new NestService(repository, serviceOptions?, softDeleteConfig?)`
- `repository`: TypeORM `Repository<T>` (inject via `@InjectRepository(Entity)`)
- `serviceOptions`: `{ multi: false, softDelete: true, pagination: true }` (defaults)
- `softDeleteConfig`: defaults to `{ deleted: { $ne: true } }` (converted to `{ deleted: Not(true) }`)

#### Query Operators (FeathersJS-style → TypeORM)

| Operator | TypeORM Translation |
|---|---|
| `$eq` | `Equal(value)` |
| `$ne` | `Not(value)` |
| `$gt/$gte/$lt/$lte` | `MoreThan/MoreThanOrEqual/LessThan/LessThanOrEqual(value)` |
| `$in/$nin` | `In([values])` / `Not(In([values]))` |
| `$like/$notLike` | `Like('%value%')` / `Not(Like('%value%'))` |
| `$iLike/$notILike` | `ILike('%value%')` / `Not(ILike('%value%'))` (PostgreSQL) |
| `$or` | array of `where` objects (TypeORM OR); base fields distributed across branches |
| `$and` | merged into a single `where` object |

Multiple operators on one field combine via `And(...)`.

#### Query Special Parameters

| Param | Effect |
|---|---|
| `$sort` | `{ createdAt: -1 }` → `order: { createdAt: 'DESC' }` |
| `$limit` | maps to `take` (default: 20) |
| `$skip` | maps to `skip` (default: 0) |
| `$select` | array/string/object → `select: { field: true }` |
| `$include` | array/string/object → `relations: { relation: true }` |

#### Exception Filters

**`GlobalExceptionFilter`** — handles `HttpException`, `QueryFailedError` (driver codes), `EntityNotFoundError` (→ 404), `ZodError`, unknown (→ 500, stack hidden in production).

**`handleTypeOrmError`** maps driver codes: unique (`23505`/`1062`/`SQLITE_CONSTRAINT_UNIQUE`), foreign key (`23503`/`1452`/`SQLITE_CONSTRAINT_FOREIGNKEY`), not-null (`23502`/`1048`/`SQLITE_CONSTRAINT_NOTNULL`), check, value-too-long, undefined table/column.

#### Exported API

| Export | Kind | Description |
|---|---|---|
| `NestService<T>` | Class | Generic CRUD service for TypeORM |
| `applyFilters` | Function | Apply $select/$include/$sort/$limit/$skip to TypeORM find-options |
| `rawQuery` | Function | Convert FeathersJS-style query to a TypeORM `where` clause |
| `assignFilters` / `filterQuery` / `cleanQuery` | Functions | Filter extraction / parsing / validation |
| `FILTERS` / `OPERATORS` | Object / Array | Filter converters / valid operator list |
| `GlobalExceptionFilter` | Filter | Catch-all exception handler (TypeORM-aware) |
| `handleTypeOrmError` | Function | TypeORM/driver error message translator |
| `TypeOrmFilters` / `TypeOrmFilterOptions` | Interfaces | Filter / pagination-defaults types |

---

### 4.5 `@nest-extended/cli`

**Path**: `packages/cli/`
**NPM**: `@nest-extended/cli`
**Binary**: `nest-cli`
**Dependencies**: `@nestjs/cli`, `chalk@4`, `commander@11`, `fs-extra`, `inquirer@8`, `tslib`, `glob`

#### Source Layout

```
packages/cli/src/
├── index.ts                          ← CLI entry point (commander program)
├── commands/
│   ├── generate.ts                   ← `generate` command group (alias: `g`)
│   ├── generate-app.ts              ← `g app <name>` — scaffold full NestJS app
│   ├── generate-auth.ts             ← `g auth` — add auth to existing app
│   ├── generate-service.ts          ← `g service <name>` — generate resource bundle
│   └── migration.ts                  ← `m run` — run migration scripts
├── lib/
│   ├── create-file.ts               ← File creation utility
│   ├── update-app-module.ts         ← Auto-update app.module.ts imports & module array
│   ├── configure-prisma-generator.ts ← Normalize the Prisma 7 generator block + gitignore
│   ├── resolve-orm.ts               ← Two-step database+ORM resolution (`--db`/`--orm` + prompts)
│   ├── generate-auth-services.ts    ← Mongoose Auth/Users file generation
│   ├── generate-prisma-auth-services.ts  ← Prisma Auth/Users files + Users model
│   └── generate-typeorm-auth-services.ts ← TypeORM Auth/Users files + Users entity
└── templates/
    ├── module.template.ts / service.template.ts / controller.template.ts ← Mongoose variants
    ├── schema.template.ts           ← Mongoose schema with soft delete + auth fields
    ├── dto.template.ts / dto-class-validator.template.ts ← Zod / class-validator DTOs
    ├── service.spec.template.ts / controller.spec.template.ts ← unit tests (shared)
    ├── auth.template.ts / users.template.ts ← Mongoose auth + users
    ├── prisma-*.template.ts         ← Prisma variants (model/service/module/controller/dto/setup/auth/users)
    └── typeorm-*.template.ts        ← TypeORM variants (entity/service/module/controller/dto/setup/auth/users)
```

#### CLI Commands Reference

| Command | Alias | Arguments | Description |
|---|---|---|---|
| `nest-cli generate app <name>` | `g app` | `<name>` | Scaffold complete NestJS app |
| `nest-cli generate auth` | `g auth` | none | Add auth modules to existing app |
| `nest-cli generate service <name>` | `g service` | `<name>` | Generate resource bundle |
| `nest-cli migration run` | `m run` | none | Run version migration scripts |
| `nest-cli version` | `v` | none | Print version |
| `nest-cli help` | — | none | Display help |

#### `g app` — Generated App Features

When generating a new app, the CLI:
1. Runs `nest new` via `@nestjs/cli`
2. Resolves the **database** (`PostgreSQL`/`MySQL`/`SQLite`/`MongoDB`) then the **ORM** (`prisma`/`typeorm` for SQL, `mongoose` for MongoDB) — two-step prompt, or `--db`/`--orm` flags. SQL with no `--orm` defaults to Prisma.
3. Prompts for validation library: `zod` or `class-validator`
4. Installs the base set + the ORM set:
   - Mongoose: `@nestjs/mongoose`, `mongoose`, `@nest-extended/mongoose`
   - Prisma: `@prisma/client`, a driver adapter, `@nest-extended/prisma` (dev `prisma`)
   - TypeORM: `@nestjs/typeorm`, `typeorm`, `dotenv`, a driver (`pg`/`mysql2`/`better-sqlite3`), `@nest-extended/typeorm` (dev `ts-node`)
5. Optionally installs: `@nestjs/jwt`, `bcrypt`, `@types/bcrypt`
6. Configures `app.module.ts` with `ConfigModule`, `ClsModule`, `NestExtendedModule.forRoot()` (soft delete config), the database module (`MongooseModule.forRoot()` / `PrismaModule` / `DatabaseModule`), the matching `GlobalExceptionFilter` (APP_FILTER), and `NullResponseInterceptor` (APP_INTERCEPTOR)
7. Prisma: runs `prisma init` + writes `PrismaService`/`PrismaModule`. TypeORM: writes `src/database/data-source.ts` + `database.module.ts` and `db:sync`/`migration:*` scripts (`DB_SYNCHRONIZE` defaults to `false`).
8. Generates `.env` (`MONGODB_URI` / `DATABASE_URL` / `DATABASE_PATH` + `DB_SYNCHRONIZE`) and `JWT_SECRET`
9. Optionally generates Auth and Users modules (Mongoose/Prisma/TypeORM variants)

#### `g auth` — Generated Auth Files

| File | Description |
|---|---|
| `src/services/auth/auth.module.ts` | Module with JWT config (`365d` expiry), global `AuthGuard` |
| `src/services/auth/auth.service.ts` | `signInLocal(email, password)` with bcrypt comparison |
| `src/services/auth/auth.controller.ts` | `POST /authentication` (sign-in) + `GET /authentication/verify` |
| `src/services/auth/auth.guard.ts` | JWT guard: extracts Bearer token, verifies, loads user, sets CLS |
| `src/services/auth/constants/jwt-constants.ts` | Secret from `JWT_SECRET` env or random fallback |
| `src/services/users/users.module.ts` | Users module |
| `src/services/users/users.service.ts` | NestService + `sanitizeUser()` (removes password) |
| `src/services/users/users.controller.ts` | CRUD + password hashing + block endpoint |
| `src/schemas/users.schema.ts` | Schema: firstName, lastName, email (unique), password (select:false), phone, role (enum 1-3) |
| `src/services/users/dto/users.dto.ts` | Zod validation |

#### `g service` — Generated Files

For `nest-cli g service <name>` (e.g., `user-profile` → `UserProfile`):

1. Prompts for validation library: `zod` or `class-validator`
2. Checks if the selected validator packages are installed; auto-installs if missing
3. Generates the following files:

| File | Description |
|---|---|
| `src/schemas/<name>.schema.ts` | Mongoose schema with timestamps, soft delete fields (`select: false` on `deleted`, `deletedAt`, `deletedBy`, `updatedBy`), optional auth fields |
| `src/services/<name>/<name>.module.ts` | Module with MongooseModule.forFeature |
| `src/services/<name>/<name>.service.ts` | NestService extension |
| `src/services/<name>/<name>.controller.ts` | Full CRUD controller with decorators |
| `src/services/<name>/dto/<name>.dto.ts` | Zod validations or class-validator DTOs (based on user selection) |
| `src/services/<name>/<name>.service.spec.ts` | Service unit test |
| `src/services/<name>/<name>.controller.spec.ts` | Controller unit test |

**Nested paths supported**: `nest-cli g service qna/category` → `src/services/qna/category/`

**Validator selection**: Prompts user to choose `zod` or `class-validator`. Auto-detects package manager (yarn/npm/pnpm) and installs missing packages.

**Schema `select: false`**: Fields `deleted`, `deletedAt`, `deletedBy`, and `updatedBy` are generated with `select: false` to exclude them from queries by default.

#### `m run` — Migration

Currently handles:
- Moving `ModifyBody`, `User`, `Public`, `setCreatedBy` imports from `@nest-extended/core` to `@nest-extended/decorators`

#### Name Transformation

| Input | PascalCase | camelCase |
|---|---|---|
| `user-profile` | `UserProfile` | `userProfile` |
| `order-item` | `OrderItem` | `orderItem` |
| `qna/category` | `Category` | `category` (nested under `qna/`) |

---

### 4.6 `@nest-extended/decorators`

**Path**: `packages/decorators/`
**NPM**: `@nest-extended/decorators`
**Dependencies**: `tslib`, `@nestjs/common` (peer), `express` (peer)

#### Source Layout

```
packages/decorators/src/
├── index.ts                     ← Public exports
├── User.decorator.ts            ← @User() param decorator
├── Public.decorator.ts          ← @Public() method decorator + IS_PUBLIC_KEY
└── ModifyBody.decorator.ts      ← @ModifyBody() param decorator + setCreatedBy, RequestBody type
```

#### Exported API

| Export | Kind | Description |
|---|---|---|
| `User` | Param Decorator | Extracts `req.user` from HTTP request |
| `Public` | Method Decorator | Sets `isPublic` metadata to skip auth |
| `IS_PUBLIC_KEY` | Const (`'isPublic'`) | Metadata key for `@Public()` |
| `ModifyBody(...fns)` | Param Decorator | Accepts transform functions, applies them to request, returns `req.body` |
| `setCreatedBy(key?)` | Function | Transform for `@ModifyBody` — sets `body[key]` to `user._id` (default key: `'createdBy'`) |
| `RequestBody<TBody, TUser>` | Type | Typed request: `Omit<Request, 'body'|'user'> & { user: TUser, body: TBody }` |
| `ModifyBodyFn<TBody, TUser>` | Type | Transform function type for `@ModifyBody` |

---

## 5. Build & Release

### Nx Build Commands

```bash
# Build all packages
yarn nx run-many -t build

# Build a single package
yarn nx build core
yarn nx build prisma
yarn nx build typeorm
yarn nx build mongoose
yarn nx build cli
yarn nx build decorators

# Lint
yarn nx run-many -t lint

# Typecheck
yarn nx run-many -t typecheck
```

Build output: `dist/packages/<name>/`

### Release Process

```bash
# 1. Bump version across all packages
node scripts/release.js <version>
# This updates version in all 6 package.json files,
# syncs internal dependency versions,
# creates a git commit and tag

# 2. Push to trigger publish
git push && git push --tags
```

The `release.js` script:
- Updates `version` in root and all 6 package `package.json` files
- Syncs internal dependency versions (`@nest-extended/core`, etc.)
- Commits with message `chore: release v<version>`
- Creates git tag `v<version>`

### CI/CD Pipelines

**CI** (`.github/workflows/ci.yml`):
- Triggers: push/PR to `main`
- Steps: checkout → Node 20 → cache yarn/nx → `yarn install --frozen-lockfile` → `yarn nx run-many -t build`
- Concurrency: cancels previous runs for same PR

**Publish** (`.github/workflows/publish.yml`):
- Triggers: push tags `v*`
- Steps: build job → 6 parallel publish jobs (core, mongoose, prisma, typeorm, cli, decorators)
- Publishes to NPM with `--access public`
- Requires `NPM_TOKEN` secret

**Dependabot** (`.github/dependabot.yml`):
- Weekly Monday checks for npm + GitHub Actions
- Groups: `@nestjs/*`, `nx`/`@nx/*`, `@types/*`

---

## 6. Workspace Configuration

### TypeScript Path Aliases (`tsconfig.base.json`)

```json
{
  "@nest-extended/cli": ["packages/cli/src/index.ts"],
  "@nest-extended/core": ["packages/core/src/index.ts"],
  "@nest-extended/decorators": ["packages/decorators/src/index.ts"],
  "@nest-extended/mongoose": ["packages/mongoose/src/index.ts"],
  "@nest-extended/prisma": ["packages/prisma/src/index.ts"],
  "@nest-extended/typeorm": ["packages/typeorm/src/index.ts"]
}
```

### Nx Plugins

- `@nx/js/typescript` — TypeScript build/typecheck
- `@nx/eslint/plugin` — ESLint integration
- `@nx/webpack/plugin` — Webpack build/serve/preview

### Key Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `@nestjs/common` | ^11.1.14 | NestJS framework |
| `@nestjs/mongoose` | ^11.0.4 | Mongoose NestJS integration |
| `mongoose` | ^9.2.3 | MongoDB ODM |
| `nestjs-cls` | ^6.2.0 | Continuation Local Storage |
| `commander` | ^14.0.3 | CLI framework |
| `inquirer` | ^13.3.0 | Interactive prompts |
| `chalk` | ^4.1.2 | Terminal colors |
| `zod` | ^4.3.6 | Schema validation |
| `lodash` | ^4.17.23 | Utility functions |
| `nx` | 22.5.2 | Monorepo build tool |

---

## 7. Package Inter-Dependencies

```
@nest-extended/decorators  (standalone — no internal deps)
        ↑
@nest-extended/core  (depends on decorators)
        ↑                    ↑                    ↑
@nest-extended/mongoose  @nest-extended/prisma  @nest-extended/typeorm
(depends on core)        (depends on core)      (depends on core)

@nest-extended/cli  (standalone — generates code that uses core, mongoose/prisma/typeorm, decorators)
```

---

## 8. Guidelines for AI Agents

1. **Identify scope first** — determine if the task relates to a specific package or the workspace.
2. **Check path aliases** — when modifying imports, use the `@nest-extended/*` aliases.
3. **Follow naming conventions** — see CLI name transformation rules (Section 4.3).
4. **Template awareness** — when modifying CLI templates, understand that they generate code strings (not actual source files in this repo).
5. **Soft delete is ON by default** — `NestService` defaults to `softDelete: true`. All queries auto-filter deleted documents.
6. **Auth-aware templates** — the `g service` command checks if `src/services/auth/` exists to decide whether to include `createdBy`/`updatedBy`/`deletedBy` fields.
10. **Query parser is auto-configured** — `NestExtendedModule.forRoot()` automatically sets up `qs` as the Express query parser (depth: 20, arrayLimit: 100). Disable with `queryParser: false`.
11. **Validator selection** — `g service` and `g app` prompt for `zod` or `class-validator`. Missing packages are auto-installed.
12. **Schema select: false** — generated schemas use `select: false` on `deleted`, `deletedAt`, `deletedBy`, `updatedBy` to hide soft-delete/audit fields from default queries.
7. **Build before publish** — always run `yarn nx run-many -t build` to verify changes compile.
8. **Version sync** — use `node scripts/release.js <ver>` to keep all package versions in sync.
9. **Read the README files** — for detailed API docs, reference the README paths listed in Section 3.

---

## 9. Quick Reference — File Locations

| What | Where |
|---|---|
| NestController source | `packages/core/src/lib/nest.controller.ts` |
| NestService (Mongoose) | `packages/mongoose/src/lib/nest.service.ts` |
| NestService (Prisma) | `packages/prisma/src/lib/nest.service.ts` |
| NestService (TypeORM) | `packages/typeorm/src/lib/nest.service.ts` |
| NestExtendedModule | `packages/core/src/lib/nest-extended.module.ts` |
| Soft delete config type | `packages/core/src/types/nest-extended.config.ts` |
| CLS helper | `packages/core/src/common/cls.helper.ts` |
| Default options | `packages/core/src/common/options.ts` |
| NullResponseInterceptor | `packages/core/src/interceptors/null-response.interceptor.ts` |
| GlobalExceptionFilter | `packages/mongoose/src/filters/global-exception.filter.ts` |
| MongoDB error handler | `packages/mongoose/src/filters/mongo-error.filter.ts` |
| nestify query helper | `packages/mongoose/src/common/nestify.ts` |
| rawQuery / query utils | `packages/mongoose/src/common/query.utils.ts` |
| EnsureObjectId | `packages/mongoose/src/common/ensureObjectId.ts` |
| CLI entry point | `packages/cli/src/index.ts` |
| Generate app command | `packages/cli/src/commands/generate-app.ts` |
| Generate auth command | `packages/cli/src/commands/generate-auth.ts` |
| Generate service command | `packages/cli/src/commands/generate-service.ts` |
| Migration command | `packages/cli/src/commands/migration.ts` |
| App module updater | `packages/cli/src/lib/update-app-module.ts` |
| Auth templates | `packages/cli/src/templates/auth.template.ts` |
| Users templates | `packages/cli/src/templates/users.template.ts` |
| Service template | `packages/cli/src/templates/service.template.ts` |
| Controller template | `packages/cli/src/templates/controller.template.ts` |
| Schema template | `packages/cli/src/templates/schema.template.ts` |
| DTO template | `packages/cli/src/templates/dto.template.ts` |
| Module template | `packages/cli/src/templates/module.template.ts` |
| Prisma templates | `packages/cli/src/templates/prisma-*.template.ts` |
| TypeORM templates | `packages/cli/src/templates/typeorm-*.template.ts` |
| TypeORM query utils | `packages/typeorm/src/common/query.utils.ts` |
| TypeORM error handler | `packages/typeorm/src/filters/typeorm-error.filter.ts` |
| Database+ORM resolver | `packages/cli/src/lib/resolve-orm.ts` |
| TypeORM auth generator | `packages/cli/src/lib/generate-typeorm-auth-services.ts` |
| @User decorator | `packages/decorators/src/User.decorator.ts` |
| @Public decorator | `packages/decorators/src/Public.decorator.ts` |
| @ModifyBody decorator | `packages/decorators/src/ModifyBody.decorator.ts` |
| Release script | `scripts/release.js` |
| CI workflow | `.github/workflows/ci.yml` |
| Publish workflow | `.github/workflows/publish.yml` |
