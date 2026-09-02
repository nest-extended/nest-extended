# @nest-extended/core

This package provides the core building blocks for NestJS applications built with the **NestExtended** ecosystem. It includes generic controllers, a dynamic configuration module, interceptors, CLS helpers, and type interfaces designed to work seamlessly with `@nest-extended/mongoose`.

## Key Features

- **Generic Controller (`NestController`)**: A base controller class that handles common CRUD operations (`find`, `get`, `create`, `patch`, `delete`) by delegating to a service implementing `ServiceOptions`. Auto-wires `@Public()`, `@ModifyBody(setCreatedBy())`, and `@User()` decorators.
- **Dynamic Module (`NestExtendedModule`)**: A global dynamic module configured via `NestExtendedModule.forRoot(config)` that provides app-wide soft delete configuration and automatic `qs` query parser setup. Injects `NEST_EXTENDED_CONFIG` token.
- **CLS Helpers**: Utilities for `nestjs-cls` (Continuation Local Storage):
    - `getCurrentUser<T>()` — retrieve the authenticated user from CLS context (set by AuthGuard).
    - `CLS_KEYS.USER` — constant for the CLS user key.
- **Service Events**: A per-service hooks class (`NestServiceEvents`) attached with `@ServiceEvents(TheService)` and wired at boot by `ServiceEventsRegistry`. `before*` hooks run inline and can reshape input; `on*` hooks run detached, after the response.
- **Interceptors**:
    - `NullResponseInterceptor` — throws `NotFoundException` on `null`/`undefined` GET responses.
    - `UseHooksInterceptor` — runs `@UseBefore` / `@UseAfter` from `@nest-extended/decorators`. Registered automatically by `forRoot()`.
- **Configuration Types**:
    - `NestExtendedConfig` — root config with `softDelete`, `queryParser`, `filters` and `events` settings.
    - `SoftDeleteConfig` — `getQuery()` and `getData(user)` for soft delete behavior.
    - `QueryParserConfig` — `depth`, `arrayLimit`, `allowDots` for `qs` query parser.
    - `NEST_EXTENDED_CONFIG` — injection token (`Symbol`).
- **Type Interfaces**:
    - `ServiceOptions<T>` — interface for `_find`, `_get`, `_create`, `_patch`, `_remove` (plus their optional event-firing counterparts).
    - `NestServiceOptions` — options for `multi`, `softDelete`, `pagination`, `events`, `broadcast`.
    - `EventContext<S>` — the context passed to every event hook.
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

### Service Events

Every `NestService` exposes two versions of each operation. `_find`/`_get`/`_create`/
`_patch`/`_remove` do the work; `find`/`get`/`create`/`patch`/`remove` do exactly the same
and additionally dispatch lifecycle events. Call the underscore ones when one service calls
another, the plain ones from controllers.

```typescript
import type { CompanyEvents } from './company.events';   // type-only: avoids a runtime cycle

@Injectable()
export class CompanyService extends NestService<Company, CompanyDocument, CompanyEvents> {
  constructor(@InjectModel(Company.name) model: Model<CompanyDocument>) {
    super(model, { events: true });   // default; { events: false } opts out
  }

  async approve(id: string) {
    const doc = await this._patch(id, { status: 'approved' });
    this.emit('approve', doc);        // custom event, type-checked against CompanyEvents
    return doc;
  }
}
```

```typescript
import { EventContext, NestServiceEvents, ServiceEvents } from '@nest-extended/core';
import { CompanyService } from './company.service';

@Injectable()
@ServiceEvents(CompanyService)
export class CompanyEvents extends NestServiceEvents<CompanyService, CompanyDocument> {
  constructor(
    @InjectModel(CompanyProfile.name)
    private readonly profileModel: Model<CompanyProfileDocument>,
  ) {
    super();
  }

  // Inline and awaited — what you return replaces the input.
  beforeCreate(data: any, ctx: EventContext<CompanyService>) {
    return { ...data, slug: slugify(data.name) };
  }

  // Detached — the response has already been sent. Return values are ignored and a
  // throw is logged, never surfaced to the client.
  async onCreate(company: CompanyDocument, ctx: EventContext<CompanyService>) {
    await this.profileModel.create({ company: company._id, createdBy: ctx.user?._id });
  }

  // The method name is the event name.
  async approve(company: CompanyDocument) { /* ... */ }
}
```

Both classes go in the module's `providers`, and the app must import
`NestExtendedModule.forRoot()` — that is what discovers and wires them:

```
[NestExtendedEvents] CompanyEvents -> CompanyService
```

Available hooks: `beforeFind`/`onFind`, `beforeGet`/`onGet`, `beforeCreate`/`onCreate`,
`beforePatch`/`onPatch`, `beforeRemove`/`onRemove`, and `onError`. All are optional and
receive `(payload, ctx)`.

Since `on*` hooks are detached, tests should `await service.whenSettled()` before asserting
on them.

#### Broadcasting to other modules

With `@nestjs/event-emitter` installed and `EventEmitterModule.forRoot()` registered:

```typescript
super(companyModel, { events: true, broadcast: 'company' });
```

```typescript
@OnEvent('company.create') handle(e: { payload: CompanyDocument; user?: any }) { /* ... */ }
```

Event names use the operation name — `company.create`, `company.patch`, `company.remove`,
and a custom `emit('approve')` becomes `company.approve`. `@nestjs/event-emitter` is never a
dependency of this package: without it, broadcasting is silently off.

### Decorators

Decorators have been moved to their own package.

```typescript
import { User, Public, ModifyBody, setCreatedBy, UseBefore, UseAfter } from '@nest-extended/decorators';
```

`@UseBefore` / `@UseAfter` are the controller-level counterpart to service events — use them
when you need the HTTP request or response. They are run by `UseHooksInterceptor`, which
`forRoot()` registers for you.

## Exported API

| Export | Type | Description |
|---|---|---|
| `NestController` | Class | Generic CRUD controller base class |
| `NestExtendedModule` | Module | Dynamic config module (`.forRoot()`) |
| `options` | Object | Default options (deleteKey, pagination, limits) |
| `getCurrentUser` | Function | Get user from CLS context |
| `CLS_KEYS` | Const | CLS key constants |
| `NullResponseInterceptor` | Interceptor | 404 on null GET responses |
| `UseHooksInterceptor` | Interceptor | Runs `@UseBefore` / `@UseAfter` (registered by `forRoot()`) |
| `NestServiceBase<D, E>` | Class | Base for every ORM's `NestService`; adds `find`/`get`/`create`/`patch`/`remove`, `emit()`, `whenSettled()` |
| `NestServiceEvents<S, D>` | Class | Base for a `{name}.events.ts` hooks class |
| `NestServiceHooks<S, D>` | Interface | The optional hook signatures |
| `EventContext<S>` | Interface | Context passed to every hook |
| `ServiceEvents(ServiceClass)` | Decorator | Attaches an events class to its service |
| `ServiceEventsRegistry` | Provider | Wires `@ServiceEvents()` classes at boot |
| `getEventBus` / `setEventBus` | Function | Optional `@nestjs/event-emitter` bus holder |
| `NestExtendedConfig` | Interface | Root configuration type |
| `SoftDeleteConfig` | Interface | Soft delete config type |
| `QueryParserConfig` | Interface | Query parser options (depth, arrayLimit, allowDots) |
| `NEST_EXTENDED_CONFIG` | Symbol | DI injection token |
| `ServiceOptions<T>` | Interface | Service method contract |
| `NestServiceOptions` | Type | Service behavior options |
| `PaginatedResponse<D>` | Interface | Paginated response type |
| `RequestBody` | Type | Re-exported typed request body |
