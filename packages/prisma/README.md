# @nest-extended/prisma

This package provides powerful Prisma integrations for the **NestExtended** ecosystem, offering a robust service layer with built-in pagination, filtering, soft delete capabilities, exception filters, and query utilities. Supports **PostgreSQL**, **MySQL**, and **SQLite**.

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
- **Relations**: `$include` for eager-loading relations (replaces Mongoose `$populate`)

**Constructor Options** (`NestServiceOptions`):
- `multi` (default: `false`) — allow bulk create with arrays
- `softDelete` (default: `true`) — enable soft delete behavior
- `pagination` (default: `true`) — enable paginated responses

### Query Operators

All operators follow FeathersJS-style syntax and are translated to Prisma `where` clauses:

| Operator | Description | Example | Prisma Translation |
|---|---|---|---|
| `$eq` | Equality | `{ age: { $eq: 25 } }` | `{ age: 25 }` |
| `$ne` | Not equal | `{ status: { $ne: 'draft' } }` | `{ status: { not: 'draft' } }` |
| `$gt` | Greater than | `{ age: { $gt: 18 } }` | `{ age: { gt: 18 } }` |
| `$gte` | Greater than or equal | `{ age: { $gte: 18 } }` | `{ age: { gte: 18 } }` |
| `$lt` | Less than | `{ age: { $lt: 65 } }` | `{ age: { lt: 65 } }` |
| `$lte` | Less than or equal | `{ age: { $lte: 65 } }` | `{ age: { lte: 65 } }` |
| `$in` | In array | `{ role: { $in: [1, 2] } }` | `{ role: { in: [1, 2] } }` |
| `$nin` | Not in array | `{ role: { $nin: [3] } }` | `{ role: { notIn: [3] } }` |
| `$like` | Contains (case-sensitive) | `{ name: { $like: 'john' } }` | `{ name: { contains: 'john' } }` |
| `$notLike` | Does not contain | `{ name: { $notLike: 'test' } }` | `{ name: { not: { contains: 'test' } } }` |
| `$iLike` | Contains (case-insensitive) | `{ name: { $iLike: 'john' } }` | `{ name: { contains: 'john', mode: 'insensitive' } }` |
| `$notILike` | Not contains (case-insensitive) | `{ name: { $notILike: 'test' } }` | `{ NOT: { name: { contains: 'test', mode: 'insensitive' } } }` |
| `$or` | OR condition | `{ $or: [{ a: 1 }, { b: 2 }] }` | `{ OR: [{ a: 1 }, { b: 2 }] }` |
| `$and` | AND condition | `{ $and: [{ a: 1 }, { b: 2 }] }` | `{ AND: [{ a: 1 }, { b: 2 }] }` |

> **Note**: `$iLike` and `$notILike` use PostgreSQL's `mode: 'insensitive'`. MySQL is case-insensitive by default (collation-dependent). SQLite does not support case-insensitive search natively.

### Special Parameters

| Param | Effect | Prisma Translation |
|---|---|---|
| `$sort` | Sort order — `{ createdAt: -1 }` | `orderBy: { createdAt: 'desc' }` |
| `$limit` | Max records (default: 20) | `take: number` |
| `$skip` | Skip count (default: 0) | `skip: number` |
| `$select` | Field projection (array/string/object) | `select: { field1: true, field2: true }` |
| `$include` | Eager-load relations | `include: { posts: true }` |

### Query Utilities

- **`applyFilters(queryOptions, filters, options)`**: Applies `$select`, `$include`, `$sort`, `$limit`, `$skip` to a Prisma query options object
- **`rawQuery(query)`**: Converts FeathersJS-style query params to Prisma `where` clause
- **`assignFilters`**: Extracts known filter keys (`$sort`, `$limit`, `$skip`, `$select`, `$include`) from query params
- **`filterQuery`**: Full query parsing — separates filters from query and validates operators
- **`cleanQuery`**: Validates query operators and throws `BadRequestException` for invalid `$` params

### Exception Filters

- **`GlobalExceptionFilter`**: Catch-all exception filter that handles:
    - `HttpException` — returns standard NestJS error response
    - `PrismaClientKnownRequestError` — parses specific error codes with human-readable messages
    - `PrismaClientValidationError` — wraps as `BadRequestException`
    - `ZodError` — wraps as `BadRequestException`
    - Unhandled errors — returns 500 with stack trace (stack hidden in production)

- **`handlePrismaError(exception)`**: Translates Prisma error codes to user-friendly messages:
    - `P2002` — Unique constraint violation (duplicate key)
    - `P2003` — Foreign key constraint violation
    - `P2025` — Record not found
    - `P2014` — Relation violation
    - `P2000` — Value too long for column
    - `P2006` — Invalid value provided
    - `P2011` — Null constraint violation
    - `P2024` — Connection pool timeout
    - `P2021` — Table does not exist
    - `P2022` — Column does not exist

### Types

- **`PrismaFilters`**: `$select`, `$include`, `$sort`, `$limit`, `$skip`
- **`PrismaFilterOptions`**: `defaultLimit`, `defaultSkip`, `defaultPagination`

## Usage

### NestService

Extend `NestService` to create a service with full CRUD capabilities.

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

With custom options:

```typescript
super(prisma.cat, { multi: true, softDelete: false, pagination: false });
```

### Querying

You can use the `_find` method with FeathersJS-style query objects:

```typescript
const results = await this.catsService._find({
  name: { $iLike: 'kitty' },
  age: { $gt: 5 },
  $sort: { createdAt: -1 },
  $limit: 10
});
```

Disable pagination for a single query:

```typescript
const allCats = await this.catsService._find({}, { pagination: false });
```

### Relations with $include

Use `$include` to eager-load related models:

```typescript
const results = await this.usersService._find({
  $include: {
    posts: true
  }
});

// With nested conditions
const results = await this.usersService._find({
  $include: {
    posts: {
      where: { published: true }
    }
  }
});
```

### GlobalExceptionFilter

Register globally in `app.module.ts`:

```typescript
import { GlobalExceptionFilter } from '@nest-extended/prisma';
import { APP_FILTER } from '@nestjs/core';

providers: [
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
]
```

### PrismaService Setup

Create a `PrismaService` wrapper in your project:

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

> **Tip**: The CLI command `nest-cli g app` and `nest-cli g service` will generate these files automatically when you select a Prisma-based database (PostgreSQL, MySQL, or SQLite).

## Supported Databases

| Database | `$iLike` Support | Connection URL Example |
|---|---|---|
| PostgreSQL | ✅ Full support | `postgresql://user:password@localhost:5432/mydb` |
| MySQL | ⚠️ Case-insensitive by default (collation) | `mysql://user:password@localhost:3306/mydb` |
| SQLite | ❌ No case-insensitive mode | `file:./dev.db` |

## Exported API

| Export | Type | Description |
|---|---|---|
| `NestService` | Class | Generic CRUD service with pagination & soft delete |
| `applyFilters` | Function | Apply filters/pagination to Prisma query options |
| `rawQuery` | Function | Convert FeathersJS-style query to Prisma where clause |
| `assignFilters` | Function | Extract filter params from query |
| `filterQuery` | Function | Full query parsing with operator validation |
| `cleanQuery` | Function | Validate query operators |
| `FILTERS` | Object | Filter converter definitions |
| `OPERATORS` | Array | Valid operator list |
| `GlobalExceptionFilter` | Filter | Catch-all exception handler |
| `handlePrismaError` | Function | Prisma error code translator |
| `PrismaFilters` | Interface | Filter type definition |
| `PrismaFilterOptions` | Interface | Options type definition |
