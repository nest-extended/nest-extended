# Getting Started

There are two ways to use NestExtended. Pick the one that matches your situation:

- **[Path A — Scaffold a new app](#path-a--scaffold-a-new-app)** with the CLI. Fastest way to a running, authenticated CRUD API.
- **[Path B — Add the packages to an existing NestJS app](#path-b--add-to-an-existing-app)** and wire them yourself.

## Prerequisites

- **Node.js 20+** (the CI and the generated-app E2E harness target Node 20; the E2E harness relies on the global `fetch` added in Node 18+).
- A package manager: **npm**, **yarn**, or **pnpm**.
- A database, depending on your choice:
  - **MongoDB** (Mongoose) → a MongoDB reachable at `mongodb://localhost:27017/test` (or set `MONGODB_URI`).
  - **PostgreSQL / MySQL / SQLite** (via **Prisma** or **TypeORM**) → a reachable server for PostgreSQL/MySQL; SQLite needs nothing (file-based).

> **Binary name:** `@nest-extended/cli` installs a binary called **`nest-cli`**.
> This is *not* the NestJS `nest` binary from `@nestjs/cli`. The two coexist; this
> doc always uses `nest-cli`.

---

## Path A — Scaffold a new app

### 1. Install the CLI

```bash
npm install -g @nest-extended/cli
# or, as a dev dependency in a workspace:
npm install -D @nest-extended/cli
```

### 2. Generate the app

Interactive (prompts for package manager, database, validator, and auth):

```bash
nest-cli g app my-app
```

Non-interactive (every choice supplied as a flag — useful for CI/scripts):

```bash
nest-cli g app my-app --db MongoDB   --orm mongoose --validator zod --pm npm --auth
nest-cli g app my-app --db PostgreSQL --orm typeorm  --validator zod --pm npm --auth
nest-cli g app my-app --db PostgreSQL --orm prisma   --validator zod --pm npm --auth
```

You choose a **database** and then an **ORM** — SQL databases (PostgreSQL/MySQL/SQLite)
work with **Prisma or TypeORM**; MongoDB uses **Mongoose**.

This runs `@nestjs/cli`'s `nest new` under the hood, installs the NestExtended
packages plus your database/validator/auth dependencies, and rewrites
`src/app.module.ts` to wire everything up. For the full flag list see
[cli-reference.md](cli-reference.md); for everything the command produces see
[generated-app.md](generated-app.md).

### 3. Point the app at your database

The generator writes a `.env` in the new app:

- **Mongoose** → `MONGODB_URI=mongodb://localhost:27017/test`
- **Prisma PostgreSQL** → `DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"`
- **Prisma MySQL** → `DATABASE_URL="mysql://user:password@localhost:3306/mydb"`
- **Prisma SQLite** → `DATABASE_URL="file:./dev.db"`
- **TypeORM PostgreSQL / MySQL** → `DATABASE_URL="postgresql://..."` / `"mysql://..."`
- **TypeORM SQLite** → `DATABASE_PATH=dev.db`
- **TypeORM (any)** → `DB_SYNCHRONIZE=false`

Edit `.env` to match your actual database, or start one that matches these values.

For **Prisma** databases you must create the schema before the first run:

```bash
cd my-app
npx prisma generate
npx prisma db push
```

For **TypeORM** databases create the schema before the first run (`DB_SYNCHRONIZE`
defaults to `false`):

```bash
cd my-app
npm run db:sync     # or set DB_SYNCHRONIZE=true in .env to auto-sync on boot
```

### 4. Run it

```bash
cd my-app          # if you aren't already there
npm run start      # or: yarn start / pnpm start
```

The app listens on `http://localhost:3000` by default.

### 5. Verify (if you generated auth with `--auth`)

```bash
# Register a user (this endpoint is public) and capture the token
curl -s -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"secret","firstName":"A","lastName":"B","role":1}'

# Log in
curl -s -X POST http://localhost:3000/authentication \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"local","email":"a@b.com","password":"secret"}'
```

Both return `{ "accessToken": "...", "user": { ... } }`. Use the token as
`Authorization: Bearer <token>` on protected routes. The full generated HTTP API
(including how to add your own resources with `nest-cli g service`) is documented
in [generated-app.md](generated-app.md).

### 6. Add a CRUD resource

```bash
cd my-app
nest-cli g service product --db PostgreSQL --orm typeorm --validator zod
```

Use the **same `--db`/`--orm`** as the app. This generates a
module/service/controller/DTO/specs plus the storage definition (Mongoose schema,
Prisma model, or TypeORM entity) and registers the module in `app.module.ts`. See
[cli-reference.md](cli-reference.md#nest-cli-g-service-name) for details.

---

## Path B — Add to an existing app

Use this when you already have a NestJS app and want the generic service,
controller, query language, and soft delete without scaffolding.

### 1. Install

The packages declare only `tslib`/`qs`/`zod`/internal packages as runtime
dependencies — the NestJS framework, your ODM/ORM, and `nestjs-cls` are expected
to already be in your app. Install the set for your database:

```bash
# Mongoose (MongoDB)
yarn add @nest-extended/core @nest-extended/mongoose @nest-extended/decorators nestjs-cls

# Prisma (PostgreSQL / MySQL / SQLite)
yarn add @nest-extended/core @nest-extended/prisma @nest-extended/decorators nestjs-cls

# TypeORM (PostgreSQL / MySQL / SQLite)
yarn add @nest-extended/core @nest-extended/typeorm @nest-extended/decorators nestjs-cls
```

You should already have `@nestjs/common`, `@nestjs/core`, and your data layer:
`@nestjs/mongoose` + `mongoose`, **or** `@prisma/client` (+ a Prisma driver adapter),
**or** `@nestjs/typeorm` + `typeorm` (+ a driver such as `pg` / `mysql2` / `better-sqlite3`).

> **Note:** `@nest-extended/core` imports from `@nest-extended/decorators` at
> runtime, but does not list it as a dependency — install `@nest-extended/decorators`
> explicitly (as shown above).

### 2. Register `NestExtendedModule`

`NestExtendedModule.forRoot()` is a global module that, on application bootstrap,
installs the `qs` query parser (so nested/bracketed query strings parse into
objects) and registers any exception filters you pass. Add it to your root module,
along with `ClsModule` (used by the `@User` decorator / CLS user helper):

```typescript
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { NestExtendedModule, NullResponseInterceptor } from '@nest-extended/core';
import { GlobalExceptionFilter } from '@nest-extended/mongoose'; // or '@nest-extended/prisma' / '@nest-extended/typeorm'

@Module({
  imports: [
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    NestExtendedModule.forRoot({
      // qs query parser is enabled by default; pass `queryParser: false` to disable.
      queryParser: { depth: 20, arrayLimit: 100, allowDots: false },
    }),
    // ... your feature modules
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: NullResponseInterceptor },
  ],
})
export class AppModule {}
```

`NullResponseInterceptor` turns a `null`/`undefined` result from a `GET` handler
into a `404 Not Found`. `GlobalExceptionFilter` maps ODM/ORM and Zod errors to
clean HTTP responses (see [generated-app.md](generated-app.md#error-handling)).

### 3. Create a service

Extend `NestService` to get `_find`, `_get`, `_create`, `_patch`, `_remove`, and
`getCount` for free.

**Mongoose:**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NestService } from '@nest-extended/mongoose';
import { Cat, CatDocument } from './schemas/cat.schema';

@Injectable()
export class CatsService extends NestService<Cat, CatDocument> {
  constructor(@InjectModel(Cat.name) catModel: Model<CatDocument>) {
    super(catModel);
  }
}
```

**Prisma:**

```typescript
import { Injectable } from '@nestjs/common';
import { NestService } from '@nest-extended/prisma';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class CatsService extends NestService<any> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.cat); // pass the Prisma delegate
  }
}
```

**TypeORM:**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestService } from '@nest-extended/typeorm';
import { Cat } from './entities/cat.entity';

@Injectable()
export class CatsService extends NestService<Cat> {
  constructor(@InjectRepository(Cat) repo: Repository<Cat>) {
    super(repo); // pass the TypeORM repository
  }
}
```

The `super()` constructor accepts options: `super(model, { multi, softDelete,
pagination }, softDeleteConfig?)`. Defaults are `multi: false`, `softDelete: true`,
`pagination: true`. See [soft-delete-and-auditing.md](soft-delete-and-auditing.md).

### 4. Create a controller

Either write a normal controller that calls the service methods, or extend the
generic `NestController` to expose standard REST endpoints automatically:

```typescript
import { Controller } from '@nestjs/common';
import { NestController } from '@nest-extended/core';
import { CatsService } from './cats.service';
import { Cat } from './schemas/cat.schema';

@Controller('cats')
export class CatsController extends NestController<Cat> {
  constructor(catsService: CatsService) {
    super(catsService);
  }
}
```

`NestController` exposes `GET /` (find, marked `@Public()`), `GET /:id`,
`POST /` (with `setCreatedBy()`), `PATCH /:id`, and `DELETE /:id` (passing the
authenticated `@User()` to soft delete). See
[generated-app.md](generated-app.md#the-generic-nestcontroller) for the exact
behavior and how it differs from the controller `nest-cli g service` emits.

### 5. Query it

Once a controller is wired, you can drive the service through URL query strings:

```
GET /cats?$limit=10&$skip=0&$sort[createdAt]=-1&age[$gt]=2
```

The full query language for both databases is documented in
[querying.md](querying.md).
