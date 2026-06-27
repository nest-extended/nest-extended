# @nest-extended/typeorm

This package provides powerful TypeORM integrations for the **NestExtended** ecosystem, offering a robust service layer with built-in pagination, filtering, soft delete capabilities, exception filters, and query utilities. Supports **PostgreSQL**, **MySQL/MariaDB**, and **SQLite**.

It mirrors the API surface of `@nest-extended/prisma` and `@nest-extended/mongoose` — the same `NestService` methods, the same FeathersJS-style query language — so you can switch ORMs without rewriting your controllers or queries.

## Key Features

### NestService

A generic service class (`NestService<T>`) that provides:

- **CRUD Operations**: `_find`, `_get`, `_create`, `_patch`, `_remove`
- **FeathersJS-Style Querying**: Support for `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$like`, `$notLike`, `$iLike`, `$notILike`, `$or`, `$and`
- **Pagination**: Built-in pagination logic using `$skip` and `$limit` with configurable defaults (limit: 20, skip: 0)
- **Soft Delete**: Configurable soft delete support — marks records as deleted instead of removing, with user tracking via CLS context
- **Bulk Operations**: Optional multi-record create (enable with `multi: true`)
- **Count**: `getCount(filter)` for counting records matching a filter
- **Conditional Pagination**: `_find` accepts `{ pagination: false }` to return raw arrays instead of paginated responses
- **Relations**: `$include` for eager-loading relations (the TypeORM analogue of Prisma `$include` / Mongoose `$populate`)

**Constructor** — pass a TypeORM `Repository`:

```typescript
constructor(repo: Repository<T>, serviceOptions?: NestServiceOptions, softDeleteConfig?: SoftDeleteConfig)
```

**Constructor Options** (`NestServiceOptions`):
- `multi` (default: `false`) — allow bulk create with arrays
- `softDelete` (default: `true`) — enable soft delete behavior
- `pagination` (default: `true`) — enable paginated responses

### Query Operators

All operators follow FeathersJS-style syntax and are translated to TypeORM `where` clauses using TypeORM `FindOperator`s:

| Operator | Description | Example | TypeORM Translation |
|---|---|---|---|
| `$eq` | Equality | `{ age: { $eq: 25 } }` | `{ age: Equal(25) }` |
| `$ne` | Not equal | `{ status: { $ne: 'draft' } }` | `{ status: Not('draft') }` |
| `$gt` | Greater than | `{ age: { $gt: 18 } }` | `{ age: MoreThan(18) }` |
| `$gte` | Greater than or equal | `{ age: { $gte: 18 } }` | `{ age: MoreThanOrEqual(18) }` |
| `$lt` | Less than | `{ age: { $lt: 65 } }` | `{ age: LessThan(65) }` |
| `$lte` | Less than or equal | `{ age: { $lte: 65 } }` | `{ age: LessThanOrEqual(65) }` |
| `$in` | In array | `{ role: { $in: [1, 2] } }` | `{ role: In([1, 2]) }` |
| `$nin` | Not in array | `{ role: { $nin: [3] } }` | `{ role: Not(In([3])) }` |
| `$like` | Contains (case-sensitive) | `{ name: { $like: 'john' } }` | `{ name: Like('%john%') }` |
| `$notLike` | Does not contain | `{ name: { $notLike: 'test' } }` | `{ name: Not(Like('%test%')) }` |
| `$iLike` | Contains (case-insensitive) | `{ name: { $iLike: 'john' } }` | `{ name: ILike('%john%') }` |
| `$notILike` | Not contains (case-insensitive) | `{ name: { $notILike: 'test' } }` | `{ name: Not(ILike('%test%')) }` |
| `$or` | OR condition | `{ $or: [{ a: 1 }, { b: 2 }] }` | `where: [{ a: 1 }, { b: 2 }]` |
| `$and` | AND condition | `{ $and: [{ a: 1 }, { b: 2 }] }` | merged into a single where object |

> **Note**: Multiple operators on a single field (e.g. `{ age: { $gte: 20, $lte: 40 } }`) are combined with TypeORM's `And(...)` operator. `$or` produces an array of `where` objects (TypeORM's OR form); when combined with top-level fields the base conditions are distributed across each OR branch — `{ status: 'active', $or: [{ a: 1 }, { b: 2 }] }` becomes `[{ status: 'active', a: 1 }, { status: 'active', b: 2 }]`.
>
> `$iLike` / `$notILike` emit `ILIKE`, which is **PostgreSQL-only**. MySQL is case-insensitive by default (collation-dependent); on SQLite `ILIKE` is not supported — use `$like`.

### Special Parameters

| Param | Effect | TypeORM Translation |
|---|---|---|
| `$sort` | Sort order — `{ createdAt: -1 }` | `order: { createdAt: 'DESC' }` |
| `$limit` | Max records (default: 20) | `take: number` |
| `$skip` | Skip count (default: 0) | `skip: number` |
| `$select` | Field projection (array/string/object) | `select: { field1: true, field2: true }` |
| `$include` | Eager-load relations | `relations: { posts: true }` |

### Query Utilities

- **`applyFilters(findOptions, filters, options)`**: Applies `$select`, `$include`, `$sort`, `$limit`, `$skip` to a TypeORM find-options object
- **`rawQuery(query)`**: Converts FeathersJS-style query params to a TypeORM `where` clause (object, or array for `$or`)
- **`assignFilters`**: Extracts known filter keys (`$sort`, `$limit`, `$skip`, `$select`, `$include`) from query params
- **`filterQuery`**: Full query parsing — separates filters from query and validates operators
- **`cleanQuery`**: Validates query operators and throws `BadRequestException` for invalid `$` params

### Exception Filters

- **`GlobalExceptionFilter`**: Catch-all exception filter that handles:
    - `HttpException` — returns standard NestJS error response
    - `QueryFailedError` — parses driver-specific error codes with human-readable messages
    - `EntityNotFoundError` — returns a `NotFoundException`
    - `ZodError` — wraps as `BadRequestException`
    - Unhandled errors — returns 500 with stack trace (stack hidden in production)

- **`handleTypeOrmError(exception)`**: Translates TypeORM/driver error codes to user-friendly messages across PostgreSQL (SQLSTATE), MySQL/MariaDB (errno) and SQLite (string codes):
    - Unique constraint violation (`23505` / `1062` / `SQLITE_CONSTRAINT_UNIQUE`)
    - Foreign key violation (`23503` / `1452` / `SQLITE_CONSTRAINT_FOREIGNKEY`)
    - Not-null violation (`23502` / `1048` / `SQLITE_CONSTRAINT_NOTNULL`)
    - Check constraint, value-too-long, undefined table/column

### Types

- **`TypeOrmFilters`**: `$select`, `$include`, `$sort`, `$limit`, `$skip`
- **`TypeOrmFilterOptions`**: `defaultLimit`, `defaultSkip`, `defaultPagination`

## Usage

### NestService

Extend `NestService` and inject a TypeORM repository:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestService } from '@nest-extended/typeorm';
import { Cat } from './entities/cat.entity';

@Injectable()
export class CatsService extends NestService<Cat> {
  constructor(
    @InjectRepository(Cat) repo: Repository<Cat>,
  ) {
    super(repo);
  }
}
```

With custom options:

```typescript
super(repo, { multi: true, softDelete: false, pagination: false });
```

### Querying

```typescript
const results = await this.catsService._find({
  name: { $iLike: 'kitty' },
  age: { $gt: 5 },
  $sort: { createdAt: -1 },
  $limit: 10,
});
```

Disable pagination for a single query:

```typescript
const allCats = await this.catsService._find({}, { pagination: false });
```

### Relations with $include

```typescript
const results = await this.usersService._find({
  $include: { posts: true },
});
```

### GlobalExceptionFilter

Register globally in `app.module.ts`:

```typescript
import { GlobalExceptionFilter } from '@nest-extended/typeorm';
import { APP_FILTER } from '@nestjs/core';

providers: [
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
]
```

### Database setup

The CLI commands `nest-cli g app` and `nest-cli g service` generate a shared
`src/database/data-source.ts` (DataSource) and `src/database/database.module.ts`
(`TypeOrmModule.forRoot`) automatically when you select TypeORM. Schema creation
is controlled by the `DB_SYNCHRONIZE` env var (default `false`): set it to `true`
to auto-sync on boot, or run the generated `npm run db:sync` script manually.

> **Tip**: For production, prefer real migrations (`npm run migration:generate`,
> `npm run migration:run`) over `synchronize`.

## Supported Databases

| Database | `$iLike` Support | Driver | Connection |
|---|---|---|---|
| PostgreSQL | ✅ Full support | `pg` | `DATABASE_URL=postgresql://user:password@localhost:5432/mydb` |
| MySQL/MariaDB | ⚠️ Case-insensitive by default (collation) | `mysql2` | `DATABASE_URL=mysql://user:password@localhost:3306/mydb` |
| SQLite | ❌ No `ILIKE` (use `$like`) | `better-sqlite3` | `DATABASE_PATH=dev.db` |

## Exported API

| Export | Type | Description |
|---|---|---|
| `NestService` | Class | Generic CRUD service with pagination & soft delete |
| `applyFilters` | Function | Apply filters/pagination to TypeORM find-options |
| `rawQuery` | Function | Convert FeathersJS-style query to TypeORM where clause |
| `assignFilters` | Function | Extract filter params from query |
| `filterQuery` | Function | Full query parsing with operator validation |
| `cleanQuery` | Function | Validate query operators |
| `FILTERS` | Object | Filter converter definitions |
| `OPERATORS` | Array | Valid operator list |
| `GlobalExceptionFilter` | Filter | Catch-all exception handler |
| `handleTypeOrmError` | Function | TypeORM/driver error code translator |
| `TypeOrmFilters` | Interface | Filter type definition |
| `TypeOrmFilterOptions` | Interface | Options type definition |
