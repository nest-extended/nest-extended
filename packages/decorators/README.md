# @nest-extended/decorators

This package provides useful decorators for NestJS applications.

## Key Features

- **`@User()`**: Retrieves the current user from the request (integrates with `nestjs-cls` or request object).
- **`@Public()`**: Marks a route as public (useful for authentication guards).
- **`@ModifyBody()`**: Allows modification of the request body before validation (e.g., setting `createdBy`).

## Installation

```bash
npm install @nest-extended/decorators
```

## Usage

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';
import { Controller, Get, Post } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Public()
  @Get()
  findAll() { ... }

  @Post()
  create(@ModifyBody(setCreatedBy()) body: CreateDto) { ... }

  @Get('profile')
  getProfile(@User() user: any) { ... }
}
```
