# The Generated Application

This describes what `nest-cli g app` produces, how to run it, and the exact HTTP
API it exposes — including the optional authentication layer. For the flags that
control generation, see [cli-reference.md](cli-reference.md). For the query
language used by every list endpoint, see [querying.md](querying.md).

The generator supports two database families that share the same API surface but
differ in a few details:

- **Mongoose** (MongoDB) — uses `@nest-extended/mongoose`, document `_id`s.
- **Prisma** (PostgreSQL / MySQL / SQLite) — uses `@nest-extended/prisma`, string `id`s (cuid).

Differences are called out inline.

---

## Project layout

A generated app is a standard NestJS app (created by `nest new`) plus:

```
my-app/
├── .env                          # MONGODB_URI or DATABASE_URL, JWT_SECRET
├── src/
│   ├── app.module.ts             # rewritten by the generator (see below)
│   ├── main.ts                   # stock Nest bootstrap (listens on PORT || 3000)
│   ├── prisma/                   # Prisma databases only
│   │   ├── prisma.service.ts     # extends PrismaClient, wires the driver adapter
│   │   └── prisma.module.ts      # @Global() module exporting PrismaService
│   ├── schemas/                  # Mongoose only
│   │   ├── users.schema.ts       # with auth
│   │   └── <resource>.schema.ts  # per `g service`
│   └── services/
│       ├── auth/                 # with auth
│       │   ├── auth.module.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.guard.ts
│       │   └── constants/jwt-constants.ts
│       ├── users/                # with auth
│       │   ├── users.module.ts
│       │   ├── users.service.ts
│       │   ├── users.controller.ts
│       │   └── dto/users.dto.ts
│       └── <resource>/           # per `g service`
│           ├── <resource>.module.ts
│           ├── <resource>.service.ts
│           ├── <resource>.controller.ts
│           ├── <resource>.service.spec.ts
│           ├── <resource>.controller.spec.ts
│           └── dto/<resource>.dto.ts
└── prisma/schema.prisma          # Prisma databases only (models appended per `g service`)
```

---

## `app.module.ts` wiring

The generator prepends imports and injects providers/config into the imports
array. The wired-up modules are:

| Module / provider | Role |
|---|---|
| `ConfigModule.forRoot({ envFilePath: ['.env'], isGlobal: true })` | Loads `.env` globally |
| `ClsModule.forRoot({ global: true, middleware: { mount: true } })` | Continuation-Local Storage; the `AuthGuard` stores the user here so `@User()` / `getCurrentUser()` work |
| `NestExtendedModule.forRoot({ softDelete: {...}, filters: [] })` | Installs the `qs` query parser on bootstrap; holds the soft-delete config (see note below) |
| `MongooseModule.forRoot(process.env.MONGODB_URI \|\| 'mongodb://localhost:27017/test')` *(Mongoose)* or `PrismaModule` *(Prisma)* | Database connection |
| `APP_FILTER` → `GlobalExceptionFilter` | From `@nest-extended/mongoose` or `@nest-extended/prisma` |
| `APP_INTERCEPTOR` → `NullResponseInterceptor` | Turns `null`/`undefined` GET results into `404` |
| `AuthModule`, `UsersModule` | Only when generated with auth |

The `softDelete` block the generator writes into `NestExtendedModule.forRoot`:

- **Mongoose:** `getQuery: () => ({ deleted: { $ne: true } })`, `getData: (user) => ({ deleted: true, deletedAt: new Date(), [deletedBy: user?._id] })`
- **Prisma:** `getQuery: () => ({ deleted: { not: true } })`, `getData: (user) => ({ deleted: true, deletedAt: new Date(), [deletedBy: user?.id] })`

> **Where soft-delete config actually takes effect:** the generated services call
> `super(model)` with no config, so the soft-delete behavior at runtime comes from
> `NestService`'s built-in default (which is identical to the block above). The
> `softDelete` value in `forRoot` is provided under the `NEST_EXTENDED_CONFIG`
> injection token for your own use but is **not** read automatically by
> `NestService`. To customize soft delete, pass a config to `super(model, options,
> softDeleteConfig)`. See [soft-delete-and-auditing.md](soft-delete-and-auditing.md).

---

## Environment variables

The generated `.env`:

| Variable | Databases | Default written |
|---|---|---|
| `MONGODB_URI` | Mongoose | `mongodb://localhost:27017/test` |
| `DATABASE_URL` | PostgreSQL | `postgresql://user:password@localhost:5432/mydb?schema=public` |
| `DATABASE_URL` | MySQL | `mysql://user:password@localhost:3306/mydb` |
| `DATABASE_URL` | SQLite | `file:./dev.db` |
| `JWT_SECRET` | any (used by auth) | `super-secret-jwt-key` |

`JWT_SECRET` is read by `src/services/auth/constants/jwt-constants.ts`; if unset it
falls back to a random 32-byte hex value **generated at process start** (which
invalidates all tokens on restart). Set a stable `JWT_SECRET` for anything beyond
local experiments.

---

## Running a generated app

```bash
cd my-app
# Prisma databases only — create the schema first:
npx prisma generate
npx prisma db push

npm run start        # or yarn start / pnpm start  -> http://localhost:3000
```

`main.ts` is the stock Nest bootstrap, listening on `process.env.PORT ?? 3000`.

### Prisma client location & gotcha

For Prisma apps the generated client is emitted to `src/generated/prisma`
(`moduleFormat = "cjs"`, kept inside `src/` so the compiled output stays under
`dist/`), and `PrismaService` imports `PrismaClient` from
`../generated/prisma/client`. The directory is gitignored — always run
`npx prisma generate` after cloning or after changing `schema.prisma`. The driver
adapter is chosen per database:

| Database | Adapter package | Adapter class |
|---|---|---|
| PostgreSQL | `@prisma/adapter-pg` | `PrismaPg` |
| MySQL | `@prisma/adapter-mariadb` | `PrismaMariaDb` |
| SQLite | `@prisma/adapter-better-sqlite3` | `PrismaBetterSqlite3` |

---

## Authentication

Generated when you pass `--auth` (or answer yes to the prompt) to `g app`, or via
`nest-cli g auth` on a Mongoose app.

### How it works

- **JWT**, signed with `jwtConstants.secret` (`JWT_SECRET` env or a random fallback), **expiry `365d`**.
- **`AuthGuard` is registered globally** (`APP_GUARD`). Every route requires a valid `Authorization: Bearer <token>` header **unless** the handler/class is marked `@Public()`.
- On a valid token the guard loads the user via `UsersService._get(...)`, attaches it to `request.user`, and stores it in CLS under the key `user` (so `@User()` and `getCurrentUser()` resolve it).

### Auth & Users HTTP API

| Method & path | Auth | Body | Returns |
|---|---|---|---|
| `POST /users` | **public** | `{ email, password, firstName, lastName, phone?, role? }` | `{ accessToken, user }` — hashes the password (bcrypt, 10 rounds), creates the user, returns a signed token. `400` if `email` or `password` is missing. |
| `POST /authentication` | **public** | `{ strategy: 'local', email, password }` | `200` `{ accessToken, user }`. `400` for any `strategy` other than `local`; `401` on bad credentials. |
| `GET /authentication/verify` | required | — | `{ user }` (sanitized — password stripped) |
| `GET /users` | required | — | Paginated list (see [querying.md](querying.md)) |
| `GET /users/:id` | required | — | A single user |
| `PATCH /users/:id` | required | partial user | Updates the user; **`email` is stripped from the patch**; a supplied `password` is re-hashed |
| `PATCH /users/:id/block` | required | `{ blocked?: boolean }` | Patches `blocked` (defaults to `true`) |

> Registration is `POST /users`, not a separate `/register` route, and it is the
> only public write endpoint. `sanitizeUser()` removes the `password` field from
> responses (the schema also marks `password` as `select: false`).

### The Users model (Mongoose)

`firstName` (required), `lastName` (required), `email` (required, unique),
`password` (required, `select: false`), `phone` (optional), `role`
(`enum [1, 2, 3]`, default `1`). `timestamps: true`.

> **Note on `PATCH /users/:id/block`:** the generated Mongoose `Users` schema does
> not declare a `blocked` field, so with Mongoose's default `strict` mode the
> `blocked` value will not persist unless you add the field to the schema. The
> endpoint and handler exist; the schema field does not.

---

## Resource endpoints (from `g service`)

Each resource controller is mounted at the route you passed to `g service` (the
raw argument — e.g. `product`, `user-profile`, `qna/category`) and exposes:

| Method & path | Service call | Notes |
|---|---|---|
| `GET /<resource>` | `_find(query)` | List with filtering/sorting/pagination — see [querying.md](querying.md) |
| `GET /<resource>/:id` | `_get(id, query)` | Single record; `null` result becomes `404` via the interceptor |
| `POST /<resource>` | `_create(dto)` | Request body runs through `@ModifyBody(setCreatedBy())`, which sets `createdBy` to the authenticated user's id |
| `PATCH /<resource>/:id` | `_patch(id, dto, query)` | Body runs through `@ModifyBody(setCreatedBy('updatedBy'))`, setting `updatedBy` |
| `DELETE /<resource>/:id` | `_remove(id, query, user)` | Soft delete by default — see [soft-delete-and-auditing.md](soft-delete-and-auditing.md) |

> **These endpoints are protected** when auth is present: the generated resource
> controller does **not** mark `find` as `@Public()`, so the global `AuthGuard`
> requires a token on every resource route (verified by the E2E suite — an
> unauthenticated `GET /<resource>` returns `401`). This differs from the generic
> `NestController` below.

### The generic `NestController`

`@nest-extended/core` ships a `NestController<T>` you can extend directly (it is
*not* what `g service` emits, but is available to hand-written code). It exposes
the same five endpoints with two behavioral differences:

- `find` is annotated `@Public()` (so listing is open even under a global auth guard).
- `create` uses `@ModifyBody(setCreatedBy())`; `delete` passes `@User()` to `_remove`.

Use the generated controller when you want list endpoints behind auth; extend
`NestController` when you want a zero-boilerplate controller with a public list.

---

## Validation (DTOs)

`g service` and the auth generator emit DTOs in your chosen style:

- **Zod** (`dto/<name>.dto.ts`): exports `Create<Name>Validation`, `Patch<Name>Validation`, `Remove<Name>Validation` schemas plus inferred types. The file includes a comment showing how to wrap them in a `ZodValidationPipe`. **The generated controllers do not auto-apply these pipes** — wire validation in yourself where you want it.
- **class-validator**: emits decorated DTO classes (requires `class-validator` + `class-transformer`, which the CLI installs).

Validation errors (Zod or class-validator/Mongoose) are formatted by the
`GlobalExceptionFilter` — see below.

---

## Error handling

The app registers `GlobalExceptionFilter` (`APP_FILTER`) from your database
package. It is a catch-all (`@Catch()`) that maps exceptions to clean responses:

**Mongoose (`@nest-extended/mongoose`):**

| Exception | Response |
|---|---|
| `HttpException` | passthrough (original status + body) |
| Mongoose `ValidationError` | `400` `{ message: 'Validation failed', errors: { field: msg } }` |
| Other Mongoose errors | `400` `{ message }` |
| `ZodError` | `400` `{ message: 'Validation failed', errors: { path: msg } }` |
| `MongoServerError` | `400` with a human message mapped from the error code (e.g. `11000` → "must be unique") |
| Anything else | `500` `{ statusCode, timestamp, error: { name, message, stack }, path }` |

Mongo codes translated by `handleMongoError`: `11000` (duplicate key), `121`
(document validation), `66` (immutable field), `50` (timeout), `16755`
(invalid pipeline), `40324` (invalid index options), `8000` (transaction), `31`
(memory limit).

**Prisma (`@nest-extended/prisma`):**

| Exception | Response |
|---|---|
| `HttpException` | passthrough |
| `PrismaClientKnownRequestError` | `400` with a human message mapped from the Prisma error code |
| `PrismaClientValidationError` | `400` with the validation message |
| `ZodError` | `400` |
| Anything else | `500` `{ statusCode, timestamp, error: { name, message, stack }, path }` |

Prisma codes translated by `handlePrismaError`: `P2002` (unique constraint),
`P2003` (foreign key), `P2025` (record not found), `P2014` (relation violation),
`P2000` (value too long), `P2006` (invalid value), `P2011` (null constraint),
`P2024` (pool timeout), `P2021` (table missing), `P2022` (column missing).

> In both filters the `500` branch and (Prisma) error `details` include the stack
> / raw message only when `NODE_ENV !== 'production'`. The Mongoose filter's `500`
> branch currently always includes the stack — set `NODE_ENV=production` and
> consider a custom filter if you need to guarantee it is hidden.
