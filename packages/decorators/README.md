# @nest-extended/decorators

This package provides reusable parameter decorators for NestJS applications in the **NestExtended** ecosystem. These decorators simplify request handling, authentication, and body modification.

## Key Features

- **`@User()`**: Parameter decorator that retrieves the current user from the request object (`req.user`). Works with JWT guards that attach the authenticated user to the request.
- **`@Public()`**: Method decorator that marks a route as public. Sets `isPublic` metadata which `AuthGuard` checks to bypass JWT verification. Uses the `IS_PUBLIC_KEY` constant.
- **`@ModifyBody(...fns)`**: Parameter decorator that intercepts and modifies the request body before it reaches the handler. Accepts one or more modifier functions that receive the full request and can mutate `req.body`.
- **`setCreatedBy(key?)`**: Built-in modifier function for `@ModifyBody()`. Sets `body[key]` (default: `'createdBy'`) to `req.user._id`. Can be customized with any key (e.g., `setCreatedBy('updatedBy')`).

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
