# @nest-extended/core

This package provides the core building blocks for NestJS applications built with the **NestExtended** ecosystem. It includes generic controllers, decorators, and configuration interfaces designed to work seamlessly with `@nest-extended/mongoose`.

## Key Features

- **Generic Controller (`NestController`)**: A base controller class that handles common CRUD operations (`find`, `get`, `create`, `patch`, `delete`) by delegating to a service implementing `ServiceOptions`.
- **Decorators**: Moved to `@nest-extended/decorators`.
    - `@User()`
    - `@Public()`
    - `@ModifyBody()`

## Usage

### NestController

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

### Decorators

Decorators have been moved to their own package.

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';
```
