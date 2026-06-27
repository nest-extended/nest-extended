# Soft Delete & Auditing

`NestService` (both the Mongoose and Prisma variants) treats deletion as a
**flag**, not a row removal, and records *who* created, updated, and deleted each
record. This page explains exactly what happens, how it is configured, and the
edge cases that aren't obvious from the API.

## The model

Records carry these fields (added to generated schemas/models automatically):

| Field | Type | Set by | Purpose |
|---|---|---|---|
| `deleted` | boolean | soft delete | `true` once soft-deleted |
| `deletedAt` | date | soft delete | timestamp of deletion |
| `deletedBy` | id ref | soft delete | who deleted it |
| `createdBy` | id ref | `POST` handler (`setCreatedBy()`) | who created it |
| `updatedBy` | id ref | `PATCH` handler (`setCreatedBy('updatedBy')`) | who last updated it |

In generated **Mongoose** schemas, `deleted`, `deletedAt`, `updatedBy`, and
`deletedBy` use `select: false` (excluded from query results unless explicitly
requested via [`$select`](querying.md#select--projection)); `createdBy` is
selectable. In generated **Prisma** models these are plain nullable columns
(`String?` / `Boolean?` / `DateTime?`) returned by default.

The audit fields (`createdBy` / `updatedBy` / `deletedBy`) are only added to a
generated resource when an `auth` module exists in the project at generation time
(`nest-cli` checks for `src/services/auth/`).

## Soft delete is on by default

`NestService`'s constructor options default to:

```
{ multi: false, softDelete: true, pagination: true }
```

With `softDelete: true`:

- **Reads and updates are filtered.** `_find`, `_get`, and `_patch` merge the
  soft-delete *query filter* into every query, so deleted records are invisible:
  - Mongoose: `{ deleted: { $ne: true } }`
  - Prisma: `{ deleted: { not: true } }`
- **`_remove` patches instead of deleting.** It flags the record rather than
  removing the row.

## What `_remove` actually does

```
_remove(id, query?, user?)
```

1. It first **fetches the record** (`_get(id, query)`) so it can return the
   pre-deletion document. (For a bulk remove with `id = null`, the returned value
   is `null`.)
2. If `softDelete` is enabled:
   - It resolves the acting user from the `user` argument, falling back to
     `getCurrentUser()` (the CLS user set by the auth guard).
   - It computes the soft-delete payload via `softDeleteConfig.getData(user)` and
     applies it with `_patch`.
   - It **returns the record as it was *before* deletion**.
3. If `softDelete` is disabled, it performs a real `deleteOne`/`deleteMany`
   (Mongoose) or `delete`/`deleteMany` (Prisma) and returns the pre-deletion record.

The default `getData(user)`:

- Mongoose: `{ deleted: true, deletedAt: new Date(), deletedBy: user?._id }`
- Prisma: `{ deleted: true, deletedAt: new Date(), deletedBy: user?.id ?? null }`

In a generated app the `DELETE /<resource>/:id` route passes the authenticated
`@User()` to `_remove`, so `deletedBy` is populated from the request's user.

## How `createdBy` / `updatedBy` get set

These are **not** set by the service — they are set by the
[`@ModifyBody`](../packages/decorators/README.md) decorator on the controller
before the body reaches the service:

- `POST` handlers use `@ModifyBody(setCreatedBy())` → sets `body.createdBy = user._id`.
- `PATCH` handlers use `@ModifyBody(setCreatedBy('updatedBy'))` → sets `body.updatedBy = user._id`.

> **Cross-database caveat:** `setCreatedBy()` reads `request.user?._id`. That is the
> Mongoose id field. In a **Prisma** app the user object's id field is `id`
> (cuid), so `createdBy` / `updatedBy` come out `undefined` with the generated
> controllers. `deletedBy`, by contrast, is populated correctly in both because
> the Prisma soft-delete `getData` reads `user?.id`. If you need `createdBy` /
> `updatedBy` in a Prisma app, set them yourself (e.g. a custom `ModifyBody`
> transform that reads `user.id`).

## Configuring soft-delete behavior

The active configuration is whatever you pass to the `NestService` constructor —
or its built-in default if you pass nothing:

```typescript
import { NestService } from '@nest-extended/mongoose';
import { SoftDeleteConfig } from '@nest-extended/core';

const softDelete: SoftDeleteConfig = {
  getQuery: () => ({ deleted: { $ne: true }, archived: { $ne: true } }),
  getData: (user) => ({ deleted: true, deletedAt: new Date(), deletedBy: user?._id }),
};

@Injectable()
export class CatsService extends NestService<Cat, CatDocument> {
  constructor(@InjectModel(Cat.name) model: Model<CatDocument>) {
    super(model, { softDelete: true }, softDelete); // 3rd arg = config
  }
}
```

`SoftDeleteConfig` (from `@nest-extended/core`) has two functions:

- `getQuery()` → the filter merged into reads/updates to hide deleted records.
- `getData(user)` → the payload written when soft-deleting.

To **turn soft delete off** for a service (so `_remove` hard-deletes and reads are
unfiltered):

```typescript
super(model, { softDelete: false });
```

> **Important — `NestExtendedModule.forRoot({ softDelete })` is not auto-wired into
> `NestService`.** The generated `app.module.ts` passes a `softDelete` block to
> `forRoot`, and the generated services call `super(model)` with no config. The
> effective behavior therefore comes from `NestService`'s built-in default (which
> is identical to what `forRoot` writes), **not** from `forRoot`. The `forRoot`
> value is stored under the `NEST_EXTENDED_CONFIG` injection token for your own
> consumption, but the service layer does not read it. To customize soft delete,
> pass the config to `super(...)` as shown above (or inject
> `NEST_EXTENDED_CONFIG` and forward it yourself).

## Reading or restoring deleted records

Because the soft-delete filter is applied inside `_find` / `_get` / `_patch`,
there is **no per-call flag** to include deleted records, and `_patch` cannot
un-delete a record (it filters deleted ones out before updating). To work with
deleted rows you have two options:

1. Use a service instance constructed with `{ softDelete: false }` (reads are then unfiltered and `_patch` can flip `deleted` back to `false`/`null`).
2. Query the underlying model/delegate directly (`this.model.find(...)` for
   Mongoose, `this.prisma.cat.findMany(...)` for Prisma), bypassing the service.

There is no built-in "restore" endpoint — implement one with either approach
above if your app needs it.

## Auth integration

When you generate auth (`g app --auth` or `g auth`), two things connect to this
system:

1. The global `AuthGuard` stores the authenticated user in CLS, so
   `getCurrentUser()` (and therefore `_remove`'s fallback when no `user` is passed)
   resolves it.
2. `nest-cli g auth` patches the `forRoot` soft-delete `getData` to include
   `deletedBy: user?._id` (Mongoose). For Prisma apps generated with `--auth`,
   the generator writes `deletedBy: user?.id` into `getData` from the start.

See [generated-app.md](generated-app.md#authentication) for the auth flow and
[querying.md](querying.md) for how the soft-delete filter interacts with list
queries.
