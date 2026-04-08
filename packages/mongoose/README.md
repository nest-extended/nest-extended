# @nest-extended/mongoose

This package provides powerful Mongoose integrations for the **NestExtended** ecosystem, offering a robust service layer with built-in pagination, filtering, soft delete capabilities, exception filters, and query utilities.

## Key Features

### NestService

A generic service class (`NestService<M, D>`) that provides:

- **CRUD Operations**: `_find`, `_get`, `_create`, `_patch`, `_remove`
- **Advanced Querying**: Support for `$regex`, `$or`, `$in`, `$nin`, `$lt`, `$lte`, `$gt`, `$gte`, `$ne` and standard MongoDB operators
- **Pagination**: Built-in pagination logic using `$skip` and `$limit` with configurable defaults (limit: 20, skip: 0)
- **Soft Delete**: Configurable soft delete support — marks documents as deleted instead of removing, with user tracking via CLS context
- **Bulk Operations**: Optional multi-document create via `insertMany` (enable with `multi: true`)
- **Count**: `getCount(filter)` for counting documents matching a filter
- **Conditional Pagination**: `_find` accepts `{ pagination: false }` to return raw arrays instead of paginated responses

**Constructor Options** (`NestServiceOptions`):
- `multi` (default: `false`) — allow bulk create with arrays
- `softDelete` (default: `true`) — enable soft delete behavior
- `pagination` (default: `true`) — enable paginated responses

### Query Utilities

- **`nestify(query, filters, options)`**: Applies `$select`, `$populate`, `$sort`, `$limit`, `$skip` to a Mongoose query
- **`rawQuery(query)`**: Converts query params to MongoDB query with auto-ObjectId conversion, `$regex` support, and recursive `$or` handling
- **`assignFilters`**: Extracts known filter keys (`$sort`, `$limit`, `$skip`, `$select`, `$populate`) from query params
- **`filterQuery`**: Full query parsing — separates filters from query and validates operators
- **`cleanQuery`**: Validates query operators and throws `BadRequestException` for invalid `$` params

### Helper Utilities

- **`EnsureObjectId(id)`**: Validates and converts string to `Types.ObjectId`, throws `Error` on invalid ID
- **`ensureObjectId`**: Alias export for the same utility

### Exception Filters

- **`GlobalExceptionFilter`**: Catch-all exception filter that handles:
    - `HttpException` — returns standard NestJS error response
    - `MongooseError` — wraps as `BadRequestException`
    - `ZodError` — wraps as `BadRequestException`
    - `MongoServerError` — parses specific error codes with human-readable messages
    - Unhandled errors — returns 500 with stack trace (stack hidden in production)

- **`handleMongoError(exception)`**: Translates MongoDB error codes to user-friendly messages:
    - `11000` — Duplicate key violation
    - `121` — Document validation failure
    - `66` — Immutable field modification
    - `50` — Operation timeout
    - `16755` — Invalid aggregation pipeline
    - `40324` — Invalid index options
    - `8000` — Transaction error
    - `31` — Memory limit exceeded

### Types

- **`NestifyFilters`**: `$select`, `$populate`, `$sort`, `$limit`, `$skip`
- **`NestifyOptions`**: `defaultLimit`, `defaultSkip`, `defaultPagination`

## Usage

### NestService

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

With custom options:

```typescript
super(catModel, { multi: true, softDelete: false, pagination: false });
```

### Querying

You can use the `_find` method with query objects:

```typescript
const results = await this.catsService._find({
  name: { $regex: 'kitty', $options: 'i' },
  age: { $gt: 5 },
  $sort: { createdAt: -1 },
  $limit: 10
});
```

Disable pagination for a single query:

```typescript
const allCats = await this.catsService._find({}, { pagination: false });
```

### GlobalExceptionFilter

Register globally in `app.module.ts`:

```typescript
import { GlobalExceptionFilter } from '@nest-extended/mongoose';
import { APP_FILTER } from '@nestjs/core';

providers: [
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
]
```

### EnsureObjectId

```typescript
import { EnsureObjectId } from '@nest-extended/mongoose';

const objectId = EnsureObjectId('507f1f77bcf86cd799439011');
```

## Exported API

| Export | Type | Description |
|---|---|---|
| `NestService` | Class | Generic CRUD service with pagination & soft delete |
| `nestify` | Function | Apply filters/pagination to Mongoose query |
| `rawQuery` | Function | Convert query params to MongoDB filter |
| `assignFilters` | Function | Extract filter params from query |
| `filterQuery` | Function | Full query parsing with operator validation |
| `cleanQuery` | Function | Validate query operators |
| `EnsureObjectId` | Function | Validate & convert to ObjectId |
| `GlobalExceptionFilter` | Filter | Catch-all exception handler |
| `handleMongoError` | Function | MongoDB error code translator |
| `NestifyFilters` | Interface | Filter type definition |
| `NestifyOptions` | Interface | Options type definition |
