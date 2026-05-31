---
name: nest-extended
description: 'NestExtended skill for AI agents. USE WHEN: working in a NestJS app that uses @nest-extended/core, @nest-extended/mongoose, @nest-extended/prisma, @nest-extended/cli, or @nest-extended/decorators. Provides complete API reference for generic CRUD services, Mongoose/Prisma integrations, pagination, soft-delete, exception filters, decorators, and the nest-cli scaffolding tool.'
---

# NestExtended

NestExtended supercharges NestJS development with generic CRUD services, controllers, Mongoose/Prisma integrations (pagination, soft-delete, query filtering), exception filters, decorators, and a scaffolding CLI.

**NPM packages**: `@nest-extended/core` · `@nest-extended/mongoose` · `@nest-extended/prisma` · `@nest-extended/cli` · `@nest-extended/decorators`

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
| `NestExtendedConfig` | Interface | `{ softDelete?: SoftDeleteConfig, queryParser?: QueryParserConfig \| boolean }` |
| `SoftDeleteConfig` | Interface | `{ getQuery: () => Record, getData: (user) => Record }` |
| `QueryParserConfig` | Interface | `{ depth?: number, arrayLimit?: number, allowDots?: boolean }` — defaults: 20, 100, false |
| `NEST_EXTENDED_CONFIG` | Symbol | Injection token for the config. |
| `ServiceOptions<T>` | Interface | `_find`, `_get`, `_create`, `_patch`, `_remove` contract. |
| `NestServiceOptions` | Type | `{ multi?: boolean, softDelete?: boolean, pagination?: boolean }` |
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

---

## `@nest-extended/cli`

Scaffolding CLI for generating NestJS apps, services, and auth modules.

```bash
npm install -g @nest-extended/cli
```

### Commands

| Command | Alias | Description |
|---|---|---|
| `nest-cli generate app <name>` | `g app` | Scaffold a full NestJS app (DB selection, auth, soft-delete pre-wired) |
| `nest-cli generate auth` | `g auth` | Add JWT Auth + Users modules to an existing app |
| `nest-cli generate service <name>` | `g service` | Generate a full resource (module, service, controller, schema/model, DTO, tests) |
| `nest-cli migration run` | `m run` | Run migration scripts |
| `nest-cli version` | `v` | Print version |

### `g app` — Scaffolds a complete app with

- Database choice: **Mongoose**, **PostgreSQL**, **MySQL**, or **SQLite (Prisma)**
- Validation library: `zod` or `class-validator`
- `ConfigModule`, `ClsModule`, `NestExtendedModule`, `GlobalExceptionFilter`, `NullResponseInterceptor` pre-configured
- `.env` with `MONGODB_URI` or `DATABASE_URL`
- Optionally: JWT Auth + Users modules

### `g service <name>` — Generates a resource bundle

For `nest-cli g service user-profile` → `UserProfile` / `userProfile`:

- `src/schemas/userProfile.schema.ts` — Mongoose schema with soft-delete fields (`select: false`)
- `src/services/userProfile/userProfile.module.ts`
- `src/services/userProfile/userProfile.service.ts` — extends `NestService`
- `src/services/userProfile/userProfile.controller.ts` — full CRUD
- `src/services/userProfile/dto/userProfile.dto.ts` — Zod or class-validator
- `src/services/userProfile/userProfile.*.spec.ts` — unit tests

**Supports nested paths**: `nest-cli g service qna/category` → `src/services/qna/category/`

**Auth-aware**: if `src/services/auth/` exists, schemas automatically include `createdBy`, `updatedBy`, `deletedBy` fields.

---

## Guidelines for AI Agents

1. **Soft delete is ON by default** — `NestService` defaults to `softDelete: true`; all queries auto-exclude soft-deleted documents.
2. **Query parser is auto-configured** — `NestExtendedModule.forRoot()` sets up `qs` (depth: 20, arrayLimit: 100). Disable with `queryParser: false`.
3. **Auth-aware generation** — `g service` checks if `src/services/auth/` exists before adding `createdBy`/`updatedBy`/`deletedBy` fields.
4. **Schema `select: false`** — `deleted`, `deletedAt`, `deletedBy`, `updatedBy` are hidden from queries by default.
5. **Validator selection** — `g service` and `g app` prompt for `zod` or `class-validator`; missing packages are auto-installed.
6. **Naming conventions** — kebab-case CLI input → PascalCase classes → camelCase file names.
7. **Import via package names** — always use `@nest-extended/core`, `@nest-extended/mongoose`, etc.
8. **Bulk operations** — pass `multi: true` to the NestService constructor to enable array creates and bulk updates.
9. **Prisma vs Mongoose** — use `$include` (Prisma) instead of `$populate` (Mongoose) for eager-loading relations.
