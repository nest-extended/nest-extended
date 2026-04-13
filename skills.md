# NestExtended — AI Agent Skills

> Install this skill to give your AI agent complete knowledge of the **NestExtended** ecosystem.

```bash
npx skills add nest-extended/nest-extended
```

---

## What is NestExtended?

NestExtended is a set of NPM packages and a CLI that supercharge NestJS development. It provides generic CRUD services, controllers, decorators, Mongoose integrations with pagination/soft-delete, exception filters, and a scaffolding CLI to generate entire NestJS applications with optional JWT authentication.

**Version**: `0.0.2-beta-14` | **License**: MIT | **Runtime**: Node 20+ | **Module**: CommonJS

---

## Workspace Structure

```
nest-extended/
├── packages/
│   ├── core/          → @nest-extended/core
│   ├── mongoose/      → @nest-extended/mongoose
│   ├── cli/           → @nest-extended/cli
│   └── decorators/    → @nest-extended/decorators
├── scripts/
│   └── release.js     → Version bump + git tag
├── .github/workflows/
│   ├── ci.yml         → Build & verify on push/PR to main
│   └── publish.yml    → Tag-triggered NPM publish
├── AGENT_CONTEXT.md   → Full agent context (read this for complete details)
├── README.md          → Project overview and usage guide
├── skills.md          → This file (AI agent skill)
├── nx.json            → Nx workspace config
├── tsconfig.base.json → Base TypeScript config with path aliases
└── package.json       → Root workspace config (Yarn + Nx)
```

---

## Package: `@nest-extended/core`

**Path**: `packages/core` | **README**: [`packages/core/README.md`](packages/core/README.md)

Core building blocks for NestJS apps. Provides a generic controller, dynamic configuration module, CLS helpers, interceptors, and type interfaces.

### Exports

| Export | Kind | Purpose |
|---|---|---|
| `NestController<T>` | Class | Generic CRUD controller — exposes `find`, `get`, `create`, `patch`, `delete` endpoints. Auto-applies `@Public()` on `find`, `@ModifyBody(setCreatedBy())` on `create`, `@User()` on `delete`. |
| `NestExtendedModule` | Module | Dynamic module — `NestExtendedModule.forRoot(config)` provides global soft delete configuration and automatic `qs` query parser via `NEST_EXTENDED_CONFIG` injection token. |
| `options` | Object | Defaults: `deleteKey='deleted'`, `defaultPagination=true`, `defaultLimit=20`, `defaultSkip=0`, `multi=false`. |
| `getCurrentUser<T>()` | Function | Retrieve authenticated user from CLS context (`nestjs-cls`). Returns `undefined` if unavailable. |
| `CLS_KEYS` | Const | `{ USER: 'user' }` — CLS storage key constants. |
| `NullResponseInterceptor` | Interceptor | Throws `NotFoundException` when GET handlers return `null`/`undefined`. |
| `NestExtendedConfig` | Interface | `{ softDelete?: SoftDeleteConfig, queryParser?: QueryParserConfig \| boolean }` |
| `SoftDeleteConfig` | Interface | `{ getQuery: () => Record, getData: (user) => Record }` |
| `QueryParserConfig` | Interface | `{ depth?: number, arrayLimit?: number, allowDots?: boolean }` — defaults: 20, 100, false |
| `NEST_EXTENDED_CONFIG` | Symbol | Injection token for `NestExtendedConfig`. |
| `ServiceOptions<T>` | Interface | Contract: `_find`, `_get`, `_create`, `_patch`, `_remove`. |
| `NestServiceOptions` | Type | `{ multi?: boolean, softDelete?: boolean, pagination?: boolean }` |
| `PaginatedResponse<D>` | Interface | `{ total, $limit, $skip, data[] }` |
| `RequestBody` | Type | Re-export from `@nest-extended/decorators`. |
| `WeekDays` | Enum | `sunday` through `saturday`. |
| `EachSlotDurationInMinutes` | Const | `30` |

### Usage

```typescript
// Generic controller
import { NestController } from '@nest-extended/core';

@Controller('cats')
export class CatsController extends NestController<Cat> {
  constructor(private readonly catsService: CatsService) {
    super(catsService);
  }
}

// Dynamic module with soft delete config and query parser
NestExtendedModule.forRoot({
  softDelete: {
    getQuery: () => ({ deleted: { $ne: true } }),
    getData: (user) => ({ deleted: true, deletedBy: user?._id, deletedAt: new Date() }),
  },
  // queryParser enabled by default (depth: 20, arrayLimit: 100)
  // queryParser: { depth: 10, allowDots: true },  // custom options
  // queryParser: false,                            // disable
})

// CLS helper in services
import { getCurrentUser } from '@nest-extended/core';
const user = getCurrentUser();

// Null response interceptor
import { NullResponseInterceptor } from '@nest-extended/core';
providers: [{ provide: APP_INTERCEPTOR, useClass: NullResponseInterceptor }]
```

---

## Package: `@nest-extended/mongoose`

**Path**: `packages/mongoose` | **README**: [`packages/mongoose/README.md`](packages/mongoose/README.md)

Mongoose integrations with a generic CRUD service, query utilities, and exception filters.

### NestService Methods

| Method | Signature | Description |
|---|---|---|
| `_find` | `(query?, { pagination? }) → PaginatedResponse \| D[]` | Find with filters, sorting, pagination. Pass `{ pagination: false }` for raw array. |
| `_get` | `(id, query?) → D \| null` | Find single document by ID. |
| `_create` | `(data) → D` or `(data[]) → D[]` | Create one or bulk (requires `multi: true`). |
| `_patch` | `(id, data, query?) → D \| D[] \| null` | Update by ID (`findOneAndUpdate`) or bulk (`updateMany` when id=null). |
| `_remove` | `(id, query?, user?) → D \| D[] \| null` | Soft delete (default) or hard delete. User from param or CLS. |
| `getCount` | `(filter) → number` | Count matching documents. |

**Constructor**: `new NestService(model, options?, softDeleteConfig?)`
- Defaults: `{ multi: false, softDelete: true, pagination: true }`

### Query Parameters

| Param | Effect |
|---|---|
| `$sort` | Sort order — `{ createdAt: -1 }` |
| `$limit` | Max docs (default: 20) |
| `$skip` | Skip count (default: 0) |
| `$select` | Field projection (array/string/object) |
| `$populate` | Mongoose populate |
| `$regex` | Regex filter — `{ $regex: { field: 'pattern' } }` (case-insensitive) |
| `$or` | OR query — `{ $or: [{ field1: val }, { field2: val }] }` |

**Supported operators**: `$in`, `$nin`, `$lt`, `$lte`, `$gt`, `$gte`, `$ne`, `$or`

### Other Exports

| Export | Kind | Purpose |
|---|---|---|
| `nestify` | Function | Apply $select/$populate/$sort/$limit/$skip to Mongoose query |
| `rawQuery` | Function | Convert query params to MongoDB filter with auto-ObjectId |
| `assignFilters` | Function | Extract filter params from query |
| `filterQuery` | Function | Full query parser with operator validation |
| `cleanQuery` | Function | Validate `$` operators, throw on invalid |
| `FILTERS` | Object | Filter converter definitions |
| `OPERATORS` | Array | Valid MongoDB operator list |
| `EnsureObjectId` | Function | Validate/convert string to `Types.ObjectId` |
| `GlobalExceptionFilter` | Filter | Catch-all: HttpException, MongooseError, ZodError, MongoServerError, unknown |
| `handleMongoError` | Function | Translate MongoDB error codes to human messages |

### MongoDB Error Codes Handled

`11000` (duplicate key), `121` (validation), `66` (immutable field), `50` (timeout), `16755` (invalid pipeline), `40324` (invalid index), `8000` (transaction), `31` (memory limit)

### Usage

```typescript
import { NestService } from '@nest-extended/mongoose';

@Injectable()
export class CatsService extends NestService<Cat, CatDocument> {
  constructor(@InjectModel(Cat.name) catModel: Model<CatDocument>) {
    super(catModel); // defaults: softDelete=true, pagination=true, multi=false
  }
}

// Custom options
super(catModel, { multi: true, softDelete: false, pagination: false });

// Query with filters
await this.catsService._find({ name: { $regex: 'kitty' }, $sort: { createdAt: -1 }, $limit: 10 });

// Register global exception filter
providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }]
```

---

## Package: `@nest-extended/prisma`

**Path**: `packages/prisma` | **README**: [`packages/prisma/README.md`](packages/prisma/README.md) | **NPM**: `@nest-extended/prisma`

Prisma database adapter supporting **PostgreSQL**, **MySQL**, and **SQLite**. Same API as Mongoose package.

### `NestService<T>` — Generic CRUD Service for Prisma

| Method | Description |
|---|---|
| `_find(query?, findOptions?)` | Find with filters, sorting, pagination. Returns `PaginatedResponse<T>` or `T[]` |
| `_get(id, query?)` | Find single record by primary key |
| `_create(data)` | Create single or bulk (`multi: true` for arrays) |
| `_patch(id, data, query?)` | Update by ID or bulk (id=null) |
| `_remove(id, query?, user?)` | Soft/hard delete depending on config |
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
| `$notLike` | `{ not: { contains: value } }` |
| `$iLike` | `{ contains: value, mode: 'insensitive' }` (PostgreSQL) |
| `$notILike` | `{ not: { contains: value, mode: 'insensitive' } }` |
| `$or/$and` | `{ OR/AND: [...conditions] }` |

### Special Parameters

- `$sort` → `orderBy` (`1` = asc, `-1` = desc)
- `$limit` → `take` (default: 20)
- `$skip` → `skip` (default: 0)
- `$select` → `select: { field: true }`
- `$include` → `include: { relation: true }` (replaces Mongoose `$populate`)

### Exception Filters

- `GlobalExceptionFilter` — handles Prisma errors (P2002, P2003, P2025, etc.), Zod, and HTTP exceptions
- `handlePrismaError(exception)` — translates Prisma error codes to human-readable messages

### DB-Specific Notes

| Database | `$iLike` Support | Connection URL Example |
|---|---|---|
| PostgreSQL | ✅ Full support | `postgresql://user:password@localhost:5432/mydb` |
| MySQL | ⚠️ Case-insensitive by default | `mysql://user:password@localhost:3306/mydb` |
| SQLite | ❌ No case-insensitive mode | `file:./dev.db` |

### Quick Start

```typescript
// Service
@Injectable()
export class CatsService extends NestService<any> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.cat);
  }
}

// Query with FeathersJS-style operators
await this.catsService._find({ name: { $iLike: 'kitty' }, $sort: { createdAt: -1 }, $limit: 10 });

// Eager-load relations
await this.usersService._find({ $include: { posts: true } });

// Register global exception filter
providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }]
```

---

## Package: `@nest-extended/cli`

**Path**: `packages/cli` | **README**: [`packages/cli/README.md`](packages/cli/README.md) | **Binary**: `nest-cli`

CLI for scaffolding NestJS apps, services, and auth modules.

### Commands

| Command | Alias | Description |
|---|---|---|
| `nest-cli generate app <name>` | `g app` | Scaffold complete NestJS app with database selection (Mongoose/PostgreSQL/MySQL/SQLite), CLS, soft-delete, optional JWT auth |
| `nest-cli generate auth` | `g auth` | Add Auth + Users modules to existing app |
| `nest-cli generate service <name>` | `g service` | Generate resource bundle (module, service, controller, schema/model, DTO, specs) with database selection |
| `nest-cli migration run` | `m run` | Run migration scripts (moves decorator imports to `@nest-extended/decorators`) |
| `nest-cli version` | `v` | Print version |
| `nest-cli help` | — | Display help |

### `g app` — What Gets Generated

1. Runs `nest new` via `@nestjs/cli`
2. Prompts for database: `Mongoose`, `PostgreSQL`, `MySQL`, or `SQLite`
3. Prompts for validation library: `zod` or `class-validator`
4. **Mongoose**: Installs `@nestjs/mongoose`, `mongoose`, `@nest-extended/mongoose` + configures `MongooseModule`
5. **Prisma (PostgreSQL/MySQL/SQLite)**: Installs `@prisma/client`, `prisma`, `@nest-extended/prisma` + runs `prisma init` + creates `PrismaModule`/`PrismaService`
6. Configures `app.module.ts` with ConfigModule, ClsModule, NestExtendedModule, GlobalExceptionFilter, NullResponseInterceptor
7. Creates `.env` with appropriate `DATABASE_URL` or `MONGODB_URI`
8. Optionally generates Auth + Users modules (compatible with selected database)

### `g auth` — Auth Files Generated

- `src/services/auth/auth.module.ts` — JWT config (365d expiry), global AuthGuard
- `src/services/auth/auth.service.ts` — `signInLocal(email, password)` with bcrypt
- `src/services/auth/auth.controller.ts` — `POST /authentication` + `GET /authentication/verify`
- `src/services/auth/auth.guard.ts` — JWT Bearer guard with CLS user injection
- `src/services/auth/constants/jwt-constants.ts` — Secret from env or random fallback
- `src/services/users/users.*` — Full Users CRUD with password hashing, sanitization, block endpoint
- `src/schemas/users.schema.ts` — firstName, lastName, email (unique), password (select:false), phone, role

### `g service <name>` — Resource Bundle Generated

For `nest-cli g service user-profile` → PascalCase `UserProfile`, camelCase `userProfile`:

1. Prompts for validation library: `zod` or `class-validator`
2. Auto-installs missing validator packages (detects yarn/npm/pnpm)
3. Generates:

- `src/schemas/userProfile.schema.ts` — Mongoose schema with timestamps + soft delete fields (`select: false` on `deleted`, `deletedAt`, `deletedBy`, `updatedBy`)
- `src/services/userProfile/userProfile.module.ts` — Module with MongooseModule.forFeature
- `src/services/userProfile/userProfile.service.ts` — NestService extension
- `src/services/userProfile/userProfile.controller.ts` — CRUD with @ModifyBody, @User
- `src/services/userProfile/dto/userProfile.dto.ts` — Zod validations or class-validator DTOs (based on selection)
- `src/services/userProfile/userProfile.service.spec.ts` — Unit test
- `src/services/userProfile/userProfile.controller.spec.ts` — Unit test

**Nested paths**: `nest-cli g service qna/category` → `src/services/qna/category/`

**Auth-aware**: If `src/services/auth/` exists, schemas include `createdBy`, `updatedBy`, `deletedBy` fields.

**Schema `select: false`**: Fields `deleted`, `deletedAt`, `deletedBy`, `updatedBy` hidden from queries by default.

---

## Package: `@nest-extended/decorators`

**Path**: `packages/decorators` | **README**: [`packages/decorators/README.md`](packages/decorators/README.md)

Reusable parameter and method decorators for NestJS.

### Exports

| Export | Kind | Purpose |
|---|---|---|
| `@User()` | Param Decorator | Extract `req.user` from HTTP request |
| `@Public()` | Method Decorator | Mark route public — skip auth guard |
| `IS_PUBLIC_KEY` | Const (`'isPublic'`) | Metadata key used by `@Public()` |
| `@ModifyBody(...fns)` | Param Decorator | Apply transform functions to request, return modified `body` |
| `setCreatedBy(key?)` | Function | Transform for `@ModifyBody` — sets `body[key]` to `user._id` (default: `'createdBy'`) |
| `RequestBody<TBody, TUser>` | Type | Typed request with `body` and `user` |
| `ModifyBodyFn<TBody, TUser>` | Type | Transform function type |

### Usage

```typescript
import { User, Public, ModifyBody, setCreatedBy } from '@nest-extended/decorators';

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

---

## Package Inter-Dependencies

```
@nest-extended/decorators  (standalone)
        ↑
@nest-extended/core  (depends on decorators)
        ↑
@nest-extended/mongoose  (depends on core)

@nest-extended/cli  (standalone — generates code using core, mongoose, decorators)
```

---

## Build & Release

```bash
# Build all packages
yarn nx run-many -t build

# Build single package
yarn nx build core

# Release (bumps all versions, creates git tag)
node scripts/release.js <version>
git push && git push --tags
```

**CI**: Push/PR to `main` → build & verify
**Publish**: Push tag `v*` → build → parallel `npm publish` for all 4 packages

---

## Key Configuration

### TypeScript Path Aliases

```json
{
  "@nest-extended/cli": ["packages/cli/src/index.ts"],
  "@nest-extended/core": ["packages/core/src/index.ts"],
  "@nest-extended/decorators": ["packages/decorators/src/index.ts"],
  "@nest-extended/mongoose": ["packages/mongoose/src/index.ts"]
}
```

### Key Dependencies

`@nestjs/common@^11`, `@nestjs/mongoose@^11`, `mongoose@^9`, `nestjs-cls@^6`, `commander@^14`, `inquirer@^13`, `chalk@^4`, `zod@^4`, `lodash@^4`, `nx@22.5`

---

## Guidelines for AI Agents

1. **Read `AGENT_CONTEXT.md`** for complete file-level reference with exact paths.
2. **Soft delete is ON by default** — `NestService` defaults to `softDelete: true`, all queries auto-exclude deleted docs.
3. **Auth-aware code generation** — CLI checks if `src/services/auth/` exists before adding `createdBy`/`updatedBy`/`deletedBy`.
4. **Template files are code generators** — `packages/cli/src/templates/*.ts` generate string output, not runtime code.
5. **Follow naming conventions** — kebab-case input → PascalCase classes → camelCase files.
6. **Use path aliases** — always import via `@nest-extended/*`.
7. **Version sync** — use `node scripts/release.js` to keep all packages in sync.
8. **Build before publish** — run `yarn nx run-many -t build` to verify.
9. **Query parser is auto-configured** — `NestExtendedModule.forRoot()` sets up `qs` (depth: 20, arrayLimit: 100). Disable with `queryParser: false`.
10. **Validator selection** — `g service` and `g app` prompt for `zod` or `class-validator`. Missing packages auto-install.
11. **Schema select: false** — generated schemas hide `deleted`, `deletedAt`, `deletedBy`, `updatedBy` from default queries.
