# The Query Language

Every `NestService._find` (and the list endpoints built on it) accepts a query
object that mixes **field filters** with **special `$`-prefixed parameters** for
sorting, pagination, projection, and relations. The same object can be expressed
as an HTTP URL query string, because `NestExtendedModule` installs the
[`qs`](https://github.com/ljharb/qs) parser on bootstrap.

This guide covers all three data layers. The shape is FeathersJS-inspired and
largely shared; where Mongoose, Prisma, and TypeORM differ, each is shown.

## How query strings become objects

`NestExtendedModule.forRoot()` replaces Express's default query parser with `qs`
(defaults: `depth: 20`, `arrayLimit: 100`, `allowDots: false`). That means
bracketed query strings parse into nested objects and arrays:

| Query string | Parsed object |
|---|---|
| `?name=kitty` | `{ name: 'kitty' }` |
| `?$limit=10&$skip=20` | `{ $limit: '10', $skip: '20' }` |
| `?$sort[createdAt]=-1` | `{ $sort: { createdAt: '-1' } }` |
| `?age[$gt]=5` | `{ age: { $gt: '5' } }` |
| `?$select[]=name&$select[]=price` | `{ $select: ['name', 'price'] }` |
| `?$or[0][status]=active&$or[1][status]=pending` | `{ $or: [{ status: 'active' }, { status: 'pending' }] }` |

Values arrive as **strings**; the database layer coerces them (Mongoose casts by
schema type; Prisma by the model's field types; the numeric `$limit`/`$skip` are
parsed with `parseInt`/`Math.abs`).

> You can pass the same object directly when calling `_find` in code —
> `service._find({ name: 'kitty', $limit: 10 })` — without going through HTTP.

## Special parameters

| Parameter | Mongoose | Prisma | TypeORM | Meaning |
|---|---|---|---|---|
| `$limit` | ✅ | ✅ | ✅ | Max rows to return (default `20`) |
| `$skip` | ✅ | ✅ | ✅ | Rows to skip (default `0`) |
| `$sort` | ✅ | ✅ | ✅ | Sort spec, e.g. `{ createdAt: -1 }` |
| `$select` | ✅ | ✅ | ✅ | Field projection (array / string / object) |
| `$populate` | ✅ | — | — | Mongoose relation population |
| `$include` | — | ✅ | ✅ | Relation eager-loading (Prisma `include` / TypeORM `relations`; the analogue of `$populate`) |
| `$regex` | ✅ | — | — | Case-insensitive regex match (Mongoose) |
| `$or` | ✅ | ✅ | ✅ | Logical OR of sub-queries |
| `$and` | — | ✅ | ✅ | Logical AND of sub-queries |

### `$limit` / `$skip` — pagination window

```
GET /product?$limit=10&$skip=20
```

Both are run through `Math.abs(parseInt(...))`. The default limit is `20` and
default skip `0` (from `@nest-extended/core`'s `options`). See
[the pagination envelope](#pagination-and-the-response-envelope) below.

### `$sort`

`{ field: -1 }` = descending, `{ field: 1 }` = ascending.

```
GET /product?$sort[createdAt]=-1&$sort[name]=1
```

- **Mongoose** passes the parsed sort spec to `.sort()` (numeric values are `parseInt`ed).
- **Prisma** converts it to `orderBy`: `-1`/`'-1'`/`'desc'` → `'desc'`, otherwise `'asc'`.
- **TypeORM** converts it to `order`: `-1`/`'-1'`/`'desc'` → `'DESC'`, otherwise `'ASC'`.

### `$select` — projection

Three accepted forms:

```
GET /product?$select[]=name&$select[]=price      # array
GET /product?$select=name price                  # space/comma-separated string (Prisma)
GET /product?$select[name]=1&$select[price]=1    # object
```

- **Mongoose** array → `{ name: 1, price: 1 }`; a string or object is passed straight to `.select()`.
- **Prisma** any form is normalized to `{ name: true, price: true }` for Prisma `select`.
- **TypeORM** any form is normalized to `{ name: true, price: true }` for TypeORM `select`.

> Fields declared `select: false` in a Mongoose schema (e.g. `password`,
> `deleted`, `deletedAt`, audit fields) are excluded by default; request them
> explicitly via `$select` if you need them.

### `$populate` (Mongoose) / `$include` (Prisma, TypeORM) — relations

```
# Mongoose
GET /product?$populate=owner
GET /product?$populate[]=owner&$populate[]=category

# Prisma / TypeORM
GET /product?$include[owner]=true
GET /product?$include[]=owner&$include[]=category
```

- **Mongoose** passes `$populate` to `.populate()` (string, object, or array).
- **Prisma** passes `$include` to Prisma's `include`. If you use **both** `$select`
  and `$include`, Prisma forbids combining `select` + `include`, so the service
  merges the included relations into `select` for you.
- **TypeORM** normalizes `$include` (array / string / object) to a `relations`
  object (e.g. `{ owner: true }`) on the find-options.

### `$or` / `$and`

```
# Mongoose: OR
GET /product?$or[0][status]=active&$or[1][status]=pending

# Prisma: OR and AND
GET /product?$or[0][status]=active&$or[1][status]=pending
GET /product?$and[0][price][$gte]=10&$and[1][price][$lte]=100
```

- **Mongoose** builds a native `$or` (each sub-query is recursively parsed). `$and` is not specially handled — use MongoDB's native nesting if required.
- **Prisma** maps `$or` → `OR` and `$and` → `AND` (each sub-query recursively parsed).
- **TypeORM** maps `$or` to an **array of `where` objects** (TypeORM's OR form) and `$and` to a single merged `where` object. Top-level fields are distributed across each OR branch — `{ status: 'active', $or: [{ a: 1 }, { b: 2 }] }` becomes `[{ status: 'active', a: 1 }, { status: 'active', b: 2 }]`.

### `$regex` (Mongoose only)

Case-insensitive substring/pattern match:

```
GET /product?$regex[name]=kit
```

Becomes `{ name: { $regex: /kit/i } }`. For Prisma, use `$like` / `$iLike`
instead (below).

## Field operators

### Mongoose

Mongoose passes recognized operators straight through to MongoDB. The validated
operator list is `$in`, `$nin`, `$lt`, `$lte`, `$gt`, `$gte`, `$ne`, `$or`:

```
GET /product?price[$gte]=10&price[$lte]=100
GET /product?status[$in][]=active&status[$in][]=pending
GET /product?archived[$ne]=true
```

> **ObjectId coercion:** in Mongoose queries, any plain field value that *looks
> like* a valid 24-character ObjectId is automatically converted to an
> `ObjectId`. This is what makes `GET /product?owner=<id>` work without manual
> casting — but be aware a 24-hex string is always treated as an id.

### Prisma

Prisma uses FeathersJS-style operators that are translated to Prisma `where`
clauses:

| Operator | Prisma translation | Example |
|---|---|---|
| `$eq` | `field: value` | `?status[$eq]=active` |
| `$ne` | `{ not: value }` | `?status[$ne]=archived` |
| `$gt` | `{ gt: value }` | `?price[$gt]=10` |
| `$gte` | `{ gte: value }` | `?price[$gte]=10` |
| `$lt` | `{ lt: value }` | `?price[$lt]=100` |
| `$lte` | `{ lte: value }` | `?price[$lte]=100` |
| `$in` | `{ in: [values] }` | `?status[$in][]=a&status[$in][]=b` |
| `$nin` | `{ notIn: [values] }` | `?status[$nin][]=a` |
| `$like` | `{ contains: value }` | `?name[$like]=kit` |
| `$notLike` | `{ not: { contains: value } }` | `?name[$notLike]=kit` |
| `$iLike` | `{ contains: value, mode: 'insensitive' }` | `?name[$iLike]=kit` |
| `$notILike` | `{ not: { contains: value, mode: 'insensitive' } }` | `?name[$notILike]=kit` |

You can combine operators on one field: `?price[$gte]=10&price[$lte]=100` →
`{ price: { gte: '10', lte: '100' } }`.

> **`$iLike` / `$notILike` are PostgreSQL-only.** Prisma's `mode: 'insensitive'`
> is supported on PostgreSQL (and MongoDB) but **not** on MySQL or SQLite — using
> it there will error or be ignored depending on the connector. For MySQL/SQLite,
> rely on `$like` (collation usually makes it case-insensitive) or normalize case
> in your data.

### TypeORM

TypeORM uses the same FeathersJS-style operators, translated to TypeORM
`FindOperator`s in the `where` clause:

| Operator | TypeORM translation | Example |
|---|---|---|
| `$eq` | `Equal(value)` | `?status[$eq]=active` |
| `$ne` | `Not(value)` | `?status[$ne]=archived` |
| `$gt` | `MoreThan(value)` | `?price[$gt]=10` |
| `$gte` | `MoreThanOrEqual(value)` | `?price[$gte]=10` |
| `$lt` | `LessThan(value)` | `?price[$lt]=100` |
| `$lte` | `LessThanOrEqual(value)` | `?price[$lte]=100` |
| `$in` | `In([values])` | `?status[$in][]=a&status[$in][]=b` |
| `$nin` | `Not(In([values]))` | `?status[$nin][]=a` |
| `$like` | `Like('%value%')` | `?name[$like]=kit` |
| `$notLike` | `Not(Like('%value%'))` | `?name[$notLike]=kit` |
| `$iLike` | `ILike('%value%')` | `?name[$iLike]=kit` |
| `$notILike` | `Not(ILike('%value%'))` | `?name[$notILike]=kit` |

Combining operators on one field (`?price[$gte]=10&price[$lte]=100`) wraps them in
TypeORM's `And(...)`: `{ price: And(MoreThanOrEqual('10'), LessThanOrEqual('100')) }`.

> **`$iLike` / `$notILike` emit `ILIKE`, which is PostgreSQL-only.** On MySQL,
> `$like` is usually case-insensitive (collation-dependent); on SQLite use `$like`.

## Pagination and the response envelope

By default `_find` is paginated and returns an **envelope**:

```json
{
  "total": 42,
  "$limit": 20,
  "$skip": 0,
  "data": [ /* up to $limit rows */ ]
}
```

`total` is a full count of matching rows (respecting the soft-delete filter).
`$limit` / `$skip` echo the effective window.

To get a **bare array** instead, disable pagination:

- Per service: construct it with `super(model, { pagination: false })`.
- Per call (in code): `service._find(query, { pagination: false })` → returns `T[]`.

The controllers `nest-cli` generates always call `_find(query)` (no per-call
override), so over HTTP the envelope is controlled by the service's `pagination`
option.

## Invalid / unknown parameters

`NestService._find`, `_get`, and `_patch` extract the known `$` filters and build
the database query directly. They do **not** run the exported `cleanQuery` /
`filterQuery` validators, so an **unknown `$`-prefixed parameter is silently
ignored**, not rejected — Mongoose's `rawQuery` skips unrecognized `$` keys, and
the Prisma/TypeORM `rawQuery` skip unknown top-level `$` keys.

If you want strict rejection of unknown operators (a `400 BadRequestException:
Invalid query parameter: $foo`), apply the exported helpers yourself before
calling the service:

```typescript
import { filterQuery } from '@nest-extended/mongoose'; // or '@nest-extended/prisma' / '@nest-extended/typeorm'

const { query: cleaned } = filterQuery(req.query); // throws on unknown $ operators
const result = await this.service._find(cleaned);
```

Both packages export `rawQuery`, `assignFilters`, `filterQuery`, `cleanQuery`,
`FILTERS`, and `OPERATORS` for building or validating queries manually — see the
package READMEs for the full list.

## End-to-end examples

```
# Page 2 of active products, 10 per page, newest first, name + price only
GET /product?status=active&$sort[createdAt]=-1&$limit=10&$skip=10&$select[]=name&$select[]=price

# Mongoose: case-insensitive name search with a price range, populate the owner
GET /product?$regex[name]=phone&price[$gte]=100&price[$lte]=500&$populate=owner

# Prisma: case-insensitive name search (Postgres), include the owner relation
GET /product?name[$iLike]=phone&$include[owner]=true

# TypeORM: name search with a price range, eager-load the owner relation
GET /product?name[$like]=phone&price[$gte]=100&price[$lte]=500&$include[owner]=true

# Any: match one of several statuses
GET /product?status[$in][]=active&status[$in][]=draft
```

All of these run behind the auth guard in a generated app — send
`Authorization: Bearer <token>`. See
[generated-app.md](generated-app.md#authentication).
