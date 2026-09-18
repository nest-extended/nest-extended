---
name: nest-extended
description: 'NestExtended skill for AI agents. USE WHEN: working in a NestJS app that uses @nest-extended/core, @nest-extended/mongoose, @nest-extended/prisma, @nest-extended/typeorm, @nest-extended/cli, or @nest-extended/decorators. Provides complete API reference for generic CRUD services, Mongoose/Prisma/TypeORM integrations, pagination, soft-delete, service lifecycle events, exception filters, decorators, and the nest-cli scaffolding tool.'
---

# NestExtended

NestExtended supercharges NestJS development with generic CRUD services, controllers, Mongoose/Prisma/TypeORM integrations (pagination, soft-delete, query filtering), per-service lifecycle events, exception filters, decorators, and a scaffolding CLI.

**NPM packages**: `@nest-extended/core` · `@nest-extended/mongoose` · `@nest-extended/prisma` · `@nest-extended/typeorm` · `@nest-extended/cli` · `@nest-extended/decorators`

---

## `@nest-extended/core`

Core building blocks: generic CRUD controller, dynamic config module, CLS helpers, interceptors.

### Exports

| Export | Kind | Purpose |
|---|---|---|
| `NestController<T>` | Class | Generic CRUD controller — `find`, `get`, `create`, `patch`, `delete`. Auto-applies `@Public()` on `find`, `@ModifyBody(setCreatedBy())` on `create`, `@User()` on `delete`. |
| `NestExtendedModule` | Module | `NestExtendedModule.forRoot(config)` — provides global soft-delete config + auto-configures `qs` query parser. |
| `getCurrentUser<T>()` | Function | Get authenticated user from CLS context (`nestjs-cls`). Returns `undefined` if not set. |
| `NullResponseInterceptor` | Interceptor | Throws `NotFoundException` when a GET handler returns `null`/`undefined`. |
| `NestExtendedConfig` | Interface | `{ softDelete?, queryParser?, filters?, events? }` — `events: false` disables the event system app-wide. |
| `SoftDeleteConfig` | Interface | `{ getQuery: () => Record, getData: (user) => Record }` |
| `QueryParserConfig` | Interface | `{ depth?: number, arrayLimit?: number, allowDots?: boolean }` — defaults: 20, 100, false |
| `NEST_EXTENDED_CONFIG` | Symbol | Injection token for the config. |
| `ServiceOptions<T>` | Interface | `_find`, `_get`, `_create`, `_patch`, `_remove` contract (plus the optional non-underscore counterparts). |
| `NestServiceOptions` | Type | `{ multi?: boolean, softDelete?: boolean, pagination?: boolean, events?: boolean, broadcast?: string \| false }` |
| `NestServiceBase<D, E>` | Class | Base every ORM's `NestService` extends. Supplies `find`/`get`/`create`/`patch`/`remove`, `emit()`, `registerEvents()`, `whenSettled()`. |
| `NestServiceEvents<S, D>` | Class | Base for a `{name}.events.ts` class. `this.service` is typed `S` and assigned at boot. |
| `NestServiceHooks<S, D>` | Interface | The optional hooks: `beforeFind`/`onFind`, `beforeGet`/`onGet`, `beforeCreate`/`onCreate`, `beforePatch`/`onPatch`, `beforeRemove`/`onRemove`, `onError`. |
| `EventContext<S>` | Interface | `{ user?, service, hook?, id?, query?, data?, findOptions? }` — 2nd argument to every hook. |
| `ServiceEvents(ServiceClass)` | Decorator | Attaches an events class to its service. Pair with `@Injectable()`. |
| `PaginatedResponse<D>` | Interface | `{ total, $limit, $skip, data[] }` |
| `CLS_KEYS` | Const | `{ USER: 'user' }` |
| `WeekDays` | Enum | `sunday` through `saturday` |
| `EachSlotDurationInMinutes` | Const | `30` |

### Usage

```typescript
// app.module.ts
NestExtendedModule.forRoot({
  softDelete: {
    getQuery: () => ({ deleted: { $ne: true } }),
    getData: (user) => ({ deleted: true, deletedBy: user?._id, deletedAt: new Date() }),
  },
  // queryParser: { depth: 10, allowDots: true }  // custom qs options
  // queryParser: false                            // disable
})

// Generic controller
@Controller('cats')
export class CatsController extends NestController<Cat> {
  constructor(private readonly catsService: CatsService) {
    super(catsService);
  }
}

// Null response interceptor
providers: [{ provide: APP_INTERCEPTOR, useClass: NullResponseInterceptor }]

// CLS user helper
const user = getCurrentUser();
```

---

## Service Events

Every service has two versions of each operation. The `_`-prefixed ones (`_find`, `_get`,
`_create`, `_patch`, `_remove`) never fire events; the plain ones (`find`, `get`, `create`,
`patch`, `remove`) are otherwise identical but dispatch lifecycle hooks to a companion
`{name}.events.ts` class. Generated controllers call the plain ones; a service calling
another service should use the `_`-prefixed ones.

`nest-cli g service` creates the events file by default (`--skip-events` to opt out).

### The hooks

| Hook | Runs | Contract |
|---|---|---|
| `beforeFind` / `beforeGet` / `beforeCreate` / `beforePatch` / `beforeRemove` | inline, awaited | return a value to **replace the input**; throw to cancel (`beforeRemove`'s return is ignored) |
| `onFind` / `onGet` / `onCreate` / `onPatch` / `onRemove` | **detached**, after the response is sent | return value ignored; a throw is logged, never surfaced to the client |
| `onError` | on a detached hook failure | replaces the default logging |

All hooks receive `(payload, ctx)` where `ctx: EventContext` is
`{ user?, service, hook?, id?, query?, data?, findOptions? }`.

### Example

```typescript
// company.service.ts — the generator emits this shape
import type { CompanyEvents } from './company.events';   // type-only: avoids a runtime cycle

@Injectable()
export class CompanyService extends NestService<Company, CompanyDocument, CompanyEvents> {
  constructor(@InjectModel(Company.name) model: Model<CompanyDocument>) {
    super(model, { events: true });          // { events: false } opts this service out
  }

  async approve(id: string) {
    const doc = await this._patch(id, { status: 'approved' });
    this.emit('approve', doc);               // custom event, type-checked against CompanyEvents
    return doc;
  }
}

// company.events.ts
@Injectable()
@ServiceEvents(CompanyService)                // both decorators are required
export class CompanyEvents extends NestServiceEvents<CompanyService, CompanyDocument> {
  constructor(
    @InjectModel(CompanyProfile.name)
    private readonly profileModel: Model<CompanyProfileDocument>,   // inject anything
  ) {
    super();
  }

  beforeCreate(data: any, ctx: EventContext<CompanyService>) {
    return { ...data, slug: slugify(data.name) };   // replaces the input
  }

  async onCreate(company: CompanyDocument, ctx: EventContext<CompanyService>) {
    await this.profileModel.create({ company: company._id, createdBy: ctx.user?._id });
  }

  async approve(company: CompanyDocument) { ... }    // method name IS the event name
}

// company.module.ts
providers: [CompanyService, CompanyEvents]           // both must be providers
```

Requires `NestExtendedModule.forRoot()` in `app.module.ts` — that is what discovers and
wires `@ServiceEvents()` classes. Confirm with the boot log:
`[NestExtendedEvents] CompanyEvents -> CompanyService`.

### Global broadcast (optional)

With `@nestjs/event-emitter` installed and `EventEmitterModule.forRoot()` registered,
`super(model, { events: true, broadcast: 'company' })` also emits `company.create`,
`company.patch`, `company.remove`, and `company.<customEvent>` so other modules can
`@OnEvent(...)`. `nest-cli g service --broadcast` sets this up. Names use the operation
name, never past tense. Only `on*` and custom events broadcast.

### Testing

`on*` hooks are detached, so `await service.whenSettled()` before asserting on them.

---

## `@nest-extended/mongoose`

Generic CRUD service for Mongoose with pagination, soft-delete, and query filtering.

### `NestService<M, D>` Methods

| Method | Signature | Description |
|---|---|---|
| `_find` | `(query?, { pagination? }) → PaginatedResponse \| D[]` | Find with filters, sorting, pagination. `{ pagination: false }` returns raw array. |
| `_get` | `(id, query?) → D \| null` | Find single document by ID. |
| `_create` | `(data) → D` or `(data[]) → D[]` | Create one or bulk (requires `multi: true`). |
| `_patch` | `(id, data, query?) → D \| D[] \| null` | Update by ID or bulk update (id=null). |
| `_remove` | `(id, query?, user?) → D \| D[] \| null` | Soft or hard delete. User from param or CLS. |
| `find` / `get` / `create` / `patch` / `remove` | same signatures as the `_`-prefixed methods | Identical, but they dispatch lifecycle events. Use these in controllers, the underscore ones service-to-service. |
| `getCount` | `(filter) → number` | Count matching documents. |

**Constructor**: `new NestService(model, options?, softDeleteConfig?)`
- Defaults: `{ multi: false, softDelete: true, pagination: true }`

### Query Parameters

| Param | Effect |
|---|---|
| `$sort` | Sort — e.g. `{ createdAt: -1 }` |
| `$limit` | Max results (default: 20) |
| `$skip` | Offset (default: 0) |
| `$select` | Field projection (array/string/object) |
| `$populate` | Mongoose populate |
| `$regex` | Case-insensitive regex — `{ $regex: { field: 'pattern' } }` |
| `$or` | OR — `{ $or: [{ field1: val }, { field2: val }] }` |

**Operators**: `$in`, `$nin`, `$lt`, `$lte`, `$gt`, `$gte`, `$ne`, `$or`

### Exception Filter

`GlobalExceptionFilter` — handles `HttpException`, `MongooseError`, `ZodError`, `MongoServerError` (codes: 11000, 121, 66, 50, 16755, 40324, 8000, 31), unknown errors.

### Usage

```typescript
@Injectable()
export class CatsService extends NestService<Cat, CatDocument> {
  constructor(@InjectModel(Cat.name) model: Model<CatDocument>) {
    super(model);
    // super(model, { multi: true, softDelete: false, pagination: false });
  }
}

// In controller
await this.catsService._find({ status: 'active', $sort: { createdAt: -1 }, $limit: 10 });
await this.catsService._find({ name: { $regex: 'kit' }, $populate: 'owner' });

// Register filter
providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }]
```

---

## `@nest-extended/prisma`

Generic CRUD service for Prisma supporting PostgreSQL, MySQL, and SQLite. Same API shape as the Mongoose adapter.

### `NestService<T>` Methods

| Method | Description |
|---|---|
| `_find(query?, findOptions?)` | Find with filters, sorting, pagination → `PaginatedResponse<T>` or `T[]` |
| `_get(id, query?)` | Find by primary key |
| `_create(data)` | Create one or bulk (`multi: true`) |
| `_patch(id, data, query?)` | Update by ID or bulk (id=null) |
| `_remove(id, query?, user?)` | Soft or hard delete |
| `getCount(filter)` | Count matching records |
| `find` / `get` / `create` / `patch` / `remove` | Same signatures as the `_`-prefixed methods, but they dispatch lifecycle events |

**Constructor**: `new NestService(prismaModel, serviceOptions?, softDeleteConfig?)`

### Query Operators (FeathersJS-style → Prisma)

| Operator | Prisma Translation |
|---|---|
| `$eq` | Direct equality |
| `$ne` | `{ not: value }` |
| `$gt/$gte/$lt/$lte` | `{ gt/gte/lt/lte: value }` |
| `$in/$nin` | `{ in/notIn: [values] }` |
| `$like` | `{ contains: value }` |
| `$iLike` | `{ contains: value, mode: 'insensitive' }` (PostgreSQL only) |
| `$or/$and` | `{ OR/AND: [...conditions] }` |

### Special Parameters

| Param | Maps to |
|---|---|
| `$sort` | `orderBy` (`1` = asc, `-1` = desc) |
| `$limit` | `take` (default: 20) |
| `$skip` | `skip` (default: 0) |
| `$select` | `select: { field: true }` |
| `$include` | `include: { relation: true }` |

### Exception Filter

`GlobalExceptionFilter` — handles Prisma errors (P2002 duplicate, P2003 foreign key, P2025 not found, P2014 relation, P2011 null constraint, etc.), `ZodError`, `HttpException`.

### Usage

```typescript
@Injectable()
export class CatsService extends NestService<any> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.cat);
  }
}

await this.catsService._find({ name: { $iLike: 'kitty' }, $sort: { createdAt: -1 } });
await this.usersService._find({ $include: { posts: true } });

providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }]
```

---

## `@nest-extended/typeorm`

Generic CRUD service for TypeORM supporting PostgreSQL, MySQL, and SQLite. Same API shape and FeathersJS-style query language as the Prisma/Mongoose adapters.

### `NestService<T>` Methods

Same surface as Prisma/Mongoose: `_find(query?, findOptions?)`, `_get(id, query?)`, `_create(data)`, `_patch(id, data, query?)`, `_remove(id, query?, user?)`, `getCount(filter)`,
plus the event-firing `find`, `get`, `create`, `patch`, `remove`.

**Constructor**: `new NestService(repository, serviceOptions?, softDeleteConfig?)` — pass a TypeORM `Repository<T>` (via `@InjectRepository`).

### Query Operators (FeathersJS-style → TypeORM)

| Operator | TypeORM Translation |
|---|---|
| `$eq` | `Equal(value)` |
| `$ne` | `Not(value)` |
| `$gt/$gte/$lt/$lte` | `MoreThan/MoreThanOrEqual/LessThan/LessThanOrEqual(value)` |
| `$in/$nin` | `In([values])` / `Not(In([values]))` |
| `$like` | `Like('%value%')` |
| `$iLike` | `ILike('%value%')` (PostgreSQL only) |
| `$or/$and` | OR → array of `where` objects; AND → merged `where` object |

Multiple operators on one field combine via `And(...)`.

### Special Parameters

| Param | Maps to |
|---|---|
| `$sort` | `order` (`1` = `ASC`, `-1` = `DESC`) |
| `$limit` | `take` (default: 20) |
| `$skip` | `skip` (default: 0) |
| `$select` | `select: { field: true }` |
| `$include` | `relations: { relation: true }` |

### Exception Filter

`GlobalExceptionFilter` — handles TypeORM `QueryFailedError` (driver codes for unique/foreign-key/not-null/etc. across PostgreSQL/MySQL/SQLite), `EntityNotFoundError`, `ZodError`, `HttpException`. `handleTypeOrmError` translates driver error codes to user-friendly messages.

### Usage

```typescript
@Injectable()
export class CatsService extends NestService<Cat> {
  constructor(@InjectRepository(Cat) repo: Repository<Cat>) {
    super(repo);
  }
}

await this.catsService._find({ name: { $like: 'kitty' }, $sort: { createdAt: -1 } });
await this.usersService._find({ $include: { posts: true } });

providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }]
```

> Schema sync: generated TypeORM apps read `DB_SYNCHRONIZE` (default `false`). Run `npm run db:sync` to create tables manually, or set `DB_SYNCHRONIZE=true` to auto-sync on boot. Prefer real migrations (`migration:generate`/`migration:run`) for production.

---

## `@nest-extended/decorators`

Reusable param and method decorators.

### Exports

| Export | Kind | Purpose |
|---|---|---|
| `@User()` | Param Decorator | Extract `req.user` from HTTP request |
| `@Public()` | Method Decorator | Mark route as public — skips auth guard |
| `IS_PUBLIC_KEY` | Const | `'isPublic'` — metadata key for `@Public()` |
| `@ModifyBody(...fns)` | Param Decorator | Apply transform functions to request, return modified `body` |
| `setCreatedBy(key?)` | Function | Sets `body[key]` to `user._id` (default key: `'createdBy'`) |
| `RequestBody<TBody, TUser>` | Type | Typed request with `body` and `user` |
| `ModifyBodyFn<TBody, TUser>` | Type | Transform function signature |
| `@UseBefore(...handlers)` | Class/Method Decorator | Run handlers before the route handler — awaited, may mutate `ctx.body`/`ctx.query` |
| `@UseAfter(...handlers)` | Class/Method Decorator | Run handlers after the response — detached, cannot alter it, throws are logged |
| `UseHandler` | Type | `((ctx: ControllerContext) => any) \| Type<EventHandler>` — inline function or injectable class |
| `EventHandler` | Interface | `{ handle(ctx: ControllerContext): any }` |
| `ControllerContext` | Interface | `{ request, response, user?, params, query, body, result?, handler, controller }` |

### Usage

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';

@Controller('cats')
export class CatsController {
  @Public()
  @Get()
  findAll() { ... }

  @Post()
  create(@ModifyBody(setCreatedBy()) body: CreateCatDto) { ... }

  @Patch('/:id')
  update(@ModifyBody(setCreatedBy('updatedBy')) body: PatchCatDto) { ... }

  @Delete('/:id')
  remove(@User() user: any) { ... }
}
```

```typescript
import { UseBefore, UseAfter, EventHandler, ControllerContext } from '@nest-extended/decorators';

@Injectable()
export class NotifyHandler implements EventHandler {
  constructor(private readonly mail: MailService) {}
  async handle(ctx: ControllerContext) { await this.mail.send(ctx.result); }
}

@Controller('cats')
@UseAfter(AuditHandler)                       // whole controller
export class CatsController {
  @Post()
  @UseBefore((ctx) => { ctx.body.slug = slugify(ctx.body.name); })
  @UseAfter(NotifyHandler)                    // must be in the module's providers
  create(@Body() dto: CreateCatDto) { ... }
}
```

---

## `@nest-extended/cli`

Scaffolding CLI for generating NestJS apps, services, and auth modules.

```bash
npm install -g @nest-extended/cli
```

### Commands

| Command | Alias | Description |
|---|---|---|
| `nest-cli generate app <name> [options]` | `g app` | Scaffold a full NestJS app (DB selection, auth, soft-delete pre-wired) |
| `nest-cli generate auth` | `g auth` | Add JWT Auth + Users modules to an existing app |
| `nest-cli generate service <name> [options]` | `g service` | Generate a full resource (module, service, controller, schema/model, DTO, tests) |
| `nest-cli migration run` | `m run` | Run migration scripts |
| `nest-cli migration events` | `m events` | Rewrite controllers from `_find`/`_get`/… to the event-firing `find`/`get`/… |
| `nest-cli version` | `v` | Print version |

### `g app` — Scaffolds a complete app

All flags are optional — omit any flag to be prompted interactively for that option.

**Flags:**

| Flag | Short | Values | Behavior when omitted |
|---|---|---|---|
| `--pkg-manager <pm>` | `-p`, `--pm` | `npm` \| `yarn` \| `pnpm` | Prompts interactively |
| `--database <type>` | `-d`, `--db` | `PostgreSQL` \| `MySQL` \| `SQLite` \| `MongoDB` (legacy `Mongoose` accepted) | Prompts interactively |
| `--orm <type>` | `-o` | `prisma` \| `typeorm` \| `mongoose` | SQL → prompts (default Prisma); MongoDB → `mongoose`. `--db <sql>` with no `--orm` defaults to Prisma. |
| `--validator <type>` | `-v` | `zod` \| `class-validator` | Prompts interactively |
| `--auth` | — | boolean flag | Prompts interactively |
| `--skip-auth` | — | boolean flag | Prompts interactively |

**Examples:**

```bash
# Fully non-interactive
nest-cli g app my-api --db MongoDB --orm mongoose --validator zod --pm yarn --auth
nest-cli g app my-api --db PostgreSQL --orm typeorm --validator zod --pm npm --auth

# Mix of flags and prompts (SQL with no --orm defaults to Prisma)
nest-cli g app my-api --database PostgreSQL --skip-auth

# Fully interactive (prompts for database, then ORM, then the rest)
nest-cli g app my-api
```

**Generates:**
- Database + ORM choice: **Mongoose** (MongoDB), **Prisma** (PostgreSQL/MySQL/SQLite), or **TypeORM** (PostgreSQL/MySQL/SQLite)
- Validation library: `zod` or `class-validator`
- `ConfigModule`, `ClsModule`, `NestExtendedModule`, `GlobalExceptionFilter`, `NullResponseInterceptor` pre-configured
- `.env` with `MONGODB_URI`, `DATABASE_URL`, or (TypeORM SQLite) `DATABASE_PATH` + `DB_SYNCHRONIZE`
- TypeORM only: `src/database/data-source.ts` + `database.module.ts`, plus `db:sync`/`migration:*` scripts
- Optionally: JWT Auth + Users modules

### `g service <name>` — Generates a resource bundle

All flags are optional — omit any flag to be prompted interactively for that option.

**Flags:**

| Flag | Short | Values | Behavior when omitted |
|---|---|---|---|
| `--database <type>` | `-d`, `--db` | `PostgreSQL` \| `MySQL` \| `SQLite` \| `MongoDB` (legacy `Mongoose` accepted) | Prompts interactively |
| `--orm <type>` | `-o` | `prisma` \| `typeorm` \| `mongoose` | SQL → prompts (default Prisma); MongoDB → `mongoose` |
| `--validator <type>` | `-v` | `zod` \| `class-validator` | Prompts interactively |
| `--events` / `--skip-events` | — | generate `{name}.events.ts` | Prompts (default **yes**) |
| `--broadcast` / `--skip-broadcast` | — | broadcast via `@nestjs/event-emitter` | Prompts (default **no**) |

> Use the **same `--db`/`--orm`** as the app you're generating into.

**Examples:**

```bash
# Fully non-interactive
nest-cli g service category --db MongoDB --orm mongoose --validator zod
nest-cli g service order-item --db PostgreSQL --orm typeorm --validator zod

# Short flags
nest-cli g service user-profile -d PostgreSQL -o typeorm -v class-validator

# Mix — prompts only for what's missing (SQL with no --orm defaults to Prisma)
nest-cli g service category --db PostgreSQL

# Fully interactive
nest-cli g service user-profile

# Skip the events file, or wire up global broadcasting
nest-cli g service category --db MongoDB --orm mongoose -v zod --skip-events
nest-cli g service category --db MongoDB --orm mongoose -v zod --events --broadcast
```

For `nest-cli g service user-profile` → `UserProfile` / `userProfile`:

- The storage definition for the chosen ORM:
  - **Mongoose**: `src/schemas/userProfile.schema.ts` (soft-delete fields use `select: false`)
  - **Prisma**: a `model UserProfile { ... }` block appended to `prisma/schema.prisma`
  - **TypeORM**: `src/services/userProfile/entities/userProfile.entity.ts`
- `src/services/userProfile/userProfile.module.ts`
- `src/services/userProfile/userProfile.service.ts` — extends `NestService`
- `src/services/userProfile/userProfile.controller.ts` — full CRUD, calling the event-firing service methods
- `src/services/userProfile/userProfile.events.ts` — lifecycle hooks (unless `--skip-events`)
- `src/services/userProfile/dto/userProfile.dto.ts` — Zod or class-validator
- `src/services/userProfile/userProfile.*.spec.ts` — unit tests

**Supports nested paths**: `nest-cli g service qna/category --db MongoDB --orm mongoose -v zod` → `src/services/qna/category/`

**Auth-aware**: if `src/services/auth/` exists, schemas/models/entities automatically include `createdBy`, `updatedBy`, `deletedBy` fields.

---

## Guidelines for AI Agents

1. **Soft delete is ON by default** — `NestService` defaults to `softDelete: true`; all queries auto-exclude soft-deleted documents.
2. **Query parser is auto-configured** — `NestExtendedModule.forRoot()` sets up `qs` (depth: 20, arrayLimit: 100). Disable with `queryParser: false`.
3. **Auth-aware generation** — `g service` checks if `src/services/auth/` exists before adding `createdBy`/`updatedBy`/`deletedBy` fields.
4. **Schema `select: false`** — `deleted`, `deletedAt`, `deletedBy`, `updatedBy` are hidden from queries by default.
5. **Validator selection** — `g service` and `g app` prompt for `zod` or `class-validator`; missing packages are auto-installed.
6. **Naming conventions** — kebab-case CLI input → PascalCase classes → camelCase file names.
7. **Import via package names** — always use `@nest-extended/core`, `@nest-extended/mongoose`, `@nest-extended/typeorm`, etc.
8. **Bulk operations** — pass `multi: true` to the NestService constructor to enable array creates and bulk updates.
9. **Relations** — use `$include` (Prisma & TypeORM) instead of `$populate` (Mongoose) for eager-loading relations.
10. **Database + ORM selection** — pick a database first, then an ORM: SQL databases (PostgreSQL/MySQL/SQLite) support **Prisma or TypeORM**; MongoDB uses **Mongoose**. SQL + no `--orm` defaults to Prisma.
11. **TypeORM schema sync** — generated TypeORM apps default to `DB_SYNCHRONIZE=false`; run `npm run db:sync` (or set it `true`) to create tables. The service injects a TypeORM `Repository` via `@InjectRepository`.
12. **`_find` vs `find`** — the `_`-prefixed methods never fire events; the plain ones do. Call `_find`/`_create`/… when one service calls another, `find`/`create`/… from controllers. Generated controllers use the plain names; older projects migrate with `nest-cli m events`.
13. **`on*` hooks are detached** — they run after the response has been sent, so they cannot change it and their throws are logged rather than raised. Never rely on an `on*` hook having run by the time a request finishes; in tests, `await service.whenSettled()`.
14. **`before*` hooks are the only ones that can alter input** — they run inline and whatever they return replaces the payload. Throw to cancel the operation.
15. **Events require `NestExtendedModule.forRoot()`** — it registers the `ServiceEventsRegistry` that wires `@ServiceEvents()` classes, plus the `@UseBefore`/`@UseAfter` interceptor. Look for `[NestExtendedEvents] XEvents -> XService` in the boot log.
16. **An events class needs both decorators and a provider entry** — `@Injectable()` *and* `@ServiceEvents(TheService)`, listed in the module's `providers`. It imports the service as a **value**; the service imports it with `import type` so there is no runtime cycle.
17. **Custom events** — add a method to the events class and call `this.emit('methodName', payload)` from the service. Pass the events class as the third `NestService` generic to have `emit` type-checked.
