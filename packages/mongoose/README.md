# @nest-extended/mongoose

This package provides powerful Mongoose integrations for the **NestExtended** ecosystem, offering a robust service layer with built-in pagination, filtering, and soft delete capabilities.

## Key Features

- **NestService**: A generic service class (`NestService<DTO, Document>`) that provides:
    - **CRUD Operations**: `_find`, `_get`, `_create`, `_patch`, `_remove`.
    - **Advanced Querying**: Support for `$regex`, `$or`, and standard MongoDB operators.
    - **Pagination**: Built-in pagination logic using `skip` and `limit`.
    - **Soft Delete**: Configurable soft delete support (requires `@nest-extended/core` integration).
- **Utilities**:
    - `ensureObjectId`: Helper to validate and convert strings to MongoDB ObjectIds.
    - `nestify`: Query helper for applying filters, sorting, and pagination.

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
