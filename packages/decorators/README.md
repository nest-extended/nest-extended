# @nest-extended/decorators

This package provides reusable parameter, method, and class decorators for NestJS applications in the **NestExtended** ecosystem. They simplify request handling, authentication, body modification, and running logic around route handlers.

## Key Features

- **`@User()`**: Parameter decorator that retrieves the current user from the request object (`req.user`). Works with JWT guards that attach the authenticated user to the request.
- **`@Public()`**: Method decorator that marks a route as public. Sets `isPublic` metadata which `AuthGuard` checks to bypass JWT verification. Uses the `IS_PUBLIC_KEY` constant.
- **`@ModifyBody(...fns)`**: Parameter decorator that intercepts and modifies the request body before it reaches the handler. Accepts one or more modifier functions that receive the full request and can mutate `req.body`.
- **`setCreatedBy(key?)`**: Built-in modifier function for `@ModifyBody()`. Sets `body[key]` (default: `'createdBy'`) to `req.user._id`. Can be customized with any key (e.g., `setCreatedBy('updatedBy')`).
- **`@UseBefore(...handlers)` / `@UseAfter(...handlers)`**: Run handlers around a route handler. Each handler is an inline function or an injectable class implementing `EventHandler`. Valid on a single method or a whole controller (class-level handlers run first). `@UseBefore` is awaited and may reshape the request; `@UseAfter` is detached — it cannot alter the response and its failures are logged per handler.

> `@UseBefore` / `@UseAfter` are executed by `UseHooksInterceptor` in `@nest-extended/core`, which `NestExtendedModule.forRoot()` registers globally. For logic that should run for *every* caller — not just HTTP requests — use service events instead (`NestServiceEvents` in `@nest-extended/core`).

## Installation

```bash
npm install @nest-extended/decorators
```

## Usage

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';
import { Controller, Get, Post, Patch } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Public()
  @Get()
  findAll() { ... }

  @Post()
  create(@ModifyBody(setCreatedBy()) body: CreateDto) { ... }

  @Patch('/:id')
  update(@ModifyBody(setCreatedBy('updatedBy')) body: PatchDto) { ... }

  @Get('profile')
  getProfile(@User() user: any) { ... }
}
```

### `@UseBefore` / `@UseAfter`

```typescript
import {
  UseBefore, UseAfter, EventHandler, ControllerContext,
} from '@nest-extended/decorators';

@Injectable()
export class NotifyHandler implements EventHandler {
  constructor(private readonly mail: MailService) {}
  async handle(ctx: ControllerContext) { await this.mail.send(ctx.result); }
}

@Controller('cats')
@UseAfter(AuditHandler)                     // applies to every handler in the controller
export class CatsController {
  @Post()
  @UseBefore((ctx) => { ctx.body.slug = slugify(ctx.body.name); })
  @UseAfter(NotifyHandler, (ctx) => logger.log(ctx.result))
  create(@Body() dto: CreateDto) { ... }
}
```

An injectable handler must be listed in the module's `providers` like any other. The context
each handler receives:

```typescript
interface ControllerContext {
  request; response; user?;
  params; query; body;
  result?;              // @UseAfter only
  handler; controller;
}
```

## Exported API

| Export | Type | Description |
|---|---|---|
| `User` | Decorator | Extract `req.user` from request |
| `Public` | Decorator | Mark route as public (skip auth) |
| `IS_PUBLIC_KEY` | Const | Metadata key used by `@Public()` (`'isPublic'`) |
| `ModifyBody` | Decorator | Modify request body with transform functions |
| `setCreatedBy` | Function | Body modifier — sets `createdBy`/custom key to user ID |
| `RequestBody<TBody, TUser>` | Type | Typed request with `body` and `user` |
| `ModifyBodyFn<TBody, TUser>` | Type | Function signature for `@ModifyBody()` transforms |
| `UseBefore` | Decorator | Run handlers before the route handler (awaited, may reshape the request) |
| `UseAfter` | Decorator | Run handlers after the response (detached, cannot alter it) |
| `UseHandler` | Type | `((ctx: ControllerContext) => any) \| Type<EventHandler>` |
| `EventHandler` | Interface | `{ handle(ctx: ControllerContext): any }` |
| `ControllerContext` | Interface | Context passed to `@UseBefore` / `@UseAfter` handlers |
| `USE_BEFORE` / `USE_AFTER` | Const | Metadata keys read by `UseHooksInterceptor` |
