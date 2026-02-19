# @nest-extended/core

This package provides the core building blocks for NestJS applications built with the **NestExtended** ecosystem. It includes generic controllers, decorators, and configuration interfaces designed to work seamlessly with `@nest-extended/mongoose`.

## Key Features

- **Generic Controller (`NestController`)**: A base controller class that handles common CRUD operations (`find`, `get`, `create`, `patch`, `delete`) by delegating to a service implementing `ServiceOptions`.
- **Decorators**:
    - `@User()`: Retrieves the current user from the request (integrates with `nestjs-cls` or request object).
    - `@Public()`: Marks a route as public (useful for authentication guards).
    - `@ModifyBody()`: Allows modification of the request body before validation (e.g., setting `createdBy`).
- **Configuration**: Interfaces for configuring soft delete behavior and other service options.

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

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/core';

@Public()
@Get()
findAll() { ... }

@Post()
create(@ModifyBody(setCreatedBy()) body: CreateDto) { ... }

@Get('profile')
getProfile(@User() user: any) { ... }
```
