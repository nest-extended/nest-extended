# @nest-extended/core

This package provides the core building blocks for NestJS applications built with the **NestExtended** ecosystem. It includes generic controllers, a dynamic configuration module, interceptors, CLS helpers, and type interfaces designed to work seamlessly with `@nest-extended/mongoose`.

## Key Features

- **Generic Controller (`NestController`)**: A base controller class that handles common CRUD operations (`find`, `get`, `create`, `patch`, `delete`) by delegating to a service implementing `ServiceOptions`. Auto-wires `@Public()`, `@ModifyBody(setCreatedBy())`, and `@User()` decorators.
- **Dynamic Module (`NestExtendedModule`)**: A global dynamic module configured via `NestExtendedModule.forRoot(config)` that provides app-wide soft delete configuration and automatic `qs` query parser setup. Injects `NEST_EXTENDED_CONFIG` token.
- **CLS Helpers**: Utilities for `nestjs-cls` (Continuation Local Storage):
    - `getCurrentUser<T>()` — retrieve the authenticated user from CLS context (set by AuthGuard).
    - `CLS_KEYS.USER` — constant for the CLS user key.
- **Interceptors**:
    - `NullResponseInterceptor` — throws `NotFoundException` on `null`/`undefined` GET responses.
- **Configuration Types**:
    - `NestExtendedConfig` — root config with `softDelete` and `queryParser` settings.
    - `SoftDeleteConfig` — `getQuery()` and `getData(user)` for soft delete behavior.
    - `QueryParserConfig` — `depth`, `arrayLimit`, `allowDots` for `qs` query parser.
    - `NEST_EXTENDED_CONFIG` — injection token (`Symbol`).
- **Type Interfaces**:
    - `ServiceOptions<T>` — interface for `_find`, `_get`, `_create`, `_patch`, `_remove`.
    - `NestServiceOptions` — options for `multi`, `softDelete`, `pagination`.
    - `PaginatedResponse<D>` — typed response with `total`, `$limit`, `$skip`, `data`.
    - `RequestBody` — re-export from `@nest-extended/decorators`.
- **Default Options**: Configurable defaults for `deleteKey` (`'deleted'`), `defaultPagination` (`true`), `defaultLimit` (`20`), `defaultSkip` (`0`), `multi` (`false`).
- **Constants**: `WeekDays` enum and `EachSlotDurationInMinutes` (30).
- **Decorators**: Moved to `@nest-extended/decorators` — use `@User()`, `@Public()`, `@ModifyBody()`, `setCreatedBy()`.

## Usage

### NestExtendedModule

Configure soft delete behavior and query parser globally:

```typescript
import { NestExtendedModule } from '@nest-extended/core';

@Module({
  imports: [
    NestExtendedModule.forRoot({
      softDelete: {
        getQuery: () => ({ deleted: { $ne: true } }),
        getData: (user) => ({
          deleted: true,
          deletedBy: user?._id,
          deletedAt: new Date(),
        }),
      },
      // Query parser is enabled by default with qs (depth: 20, arrayLimit: 100)
      // Customize or disable:
      // queryParser: { depth: 10, arrayLimit: 50, allowDots: true },
      // queryParser: false, // disable qs, use Express default
    }),
  ],
})
export class AppModule {}
```

#### Query Parser

The module automatically configures `qs` as the Express query parser on application bootstrap. This enables proper parsing of deeply nested query objects and arrays (required by `@nest-extended/mongoose` query features like `$populate`, `$sort`, etc.).

| Option | Type | Default | Description |
|---|---|---|---|
| `depth` | `number` | `20` | Maximum nesting depth for query objects |
| `arrayLimit` | `number` | `100` | Maximum number of array elements |
| `allowDots` | `boolean` | `false` | Allow dot notation in query keys |

- **Enabled by default**: No configuration needed — just use `NestExtendedModule.forRoot()`.
- **Custom options**: Pass a `QueryParserConfig` object to `queryParser`.
- **Disable**: Set `queryParser: false` to use Express's default query parser.

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

### NullResponseInterceptor

Register globally to auto-throw 404 on null GET responses:

```typescript
import { NullResponseInterceptor } from '@nest-extended/core';
import { APP_INTERCEPTOR } from '@nestjs/core';

providers: [
  { provide: APP_INTERCEPTOR, useClass: NullResponseInterceptor },
]
```

### CLS Helper

Retrieve the authenticated user from CLS context (useful in services):

```typescript
import { getCurrentUser } from '@nest-extended/core';

const user = getCurrentUser();
```

### Decorators

Decorators have been moved to their own package.

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';
```

## Exported API

| Export | Type | Description |
|---|---|---|
| `NestController` | Class | Generic CRUD controller base class |
| `NestExtendedModule` | Module | Dynamic config module (`.forRoot()`) |
| `options` | Object | Default options (deleteKey, pagination, limits) |
| `getCurrentUser` | Function | Get user from CLS context |
| `CLS_KEYS` | Const | CLS key constants |
| `NullResponseInterceptor` | Interceptor | 404 on null GET responses |
| `NestExtendedConfig` | Interface | Root configuration type |
| `SoftDeleteConfig` | Interface | Soft delete config type |
| `QueryParserConfig` | Interface | Query parser options (depth, arrayLimit, allowDots) |
| `NEST_EXTENDED_CONFIG` | Symbol | DI injection token |
| `ServiceOptions<T>` | Interface | Service method contract |
| `NestServiceOptions` | Type | Service behavior options |
| `PaginatedResponse<D>` | Interface | Paginated response type |
| `RequestBody` | Type | Re-exported typed request body |
