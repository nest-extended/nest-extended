# Generated-app E2E test

`test-generated-app.ts` verifies that an app scaffolded by `nest-cli` actually
**boots and serves working auth + CRUD endpoints**. It generates an app, adds a
CRUD resource, prepares the database, starts the server, and exercises the real
HTTP API. Run it after changing the generator or its templates to catch
regressions in the *emitted* code.

It covers a **database × ORM matrix**:

- Prisma → `SQLite`, `PostgreSQL`, `MySQL`
- TypeORM → `SQLite`, `PostgreSQL`, `MySQL`
- Mongoose → `MongoDB`

Each case is identified by a `DB+orm` label (e.g. `SQLite+typeorm`).

> **Note:** by default the generated app installs the published `@nest-extended/*`
> packages from npm, so a not-yet-published runtime package (e.g. a first
> `@nest-extended/typeorm` release) can't be exercised that way. Pass **`--local`**
> to pack the workspace packages from the current build and install them via
> `file:` tarballs instead — see Usage below.

## What it does (per case)

1. `nest-cli g app <db>-<orm>-app --db <DB> --orm <ORM> --validator zod --pm npm --auth`
2. `nest-cli g service product --db <DB> --orm <ORM> --validator zod --events --skip-broadcast`
   then **instruments** the generated `product.events.ts` and `product.controller.ts` so the
   HTTP suite can observe service events and `@UseBefore` / `@UseAfter` firing (see
   *Service events* below)
3. **DB prep:**
   - Prisma: `npx prisma generate` + `npx prisma db push`
     > **Running the suite through an AI agent?** Prisma 7.10+ refuses `db push` when it
     > detects an agent invoked it, and asks for explicit human consent. Export
     > `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<your consent message>"` before the run,
     > or run the Prisma cases yourself. The target is always the throwaway database in
     > `.e2e-apps/<db>-<orm>-app/`, recreated on every run.
   - TypeORM: `npm run db:sync` (the generated manual schema-sync script; `DB_SYNCHRONIZE` defaults to `false`)
   - Mongoose: none
   For server-backed DBs (PostgreSQL/MySQL/MongoDB) it ensures the server is reachable (see below).
4. Boot the server (`npm run start`, on a dedicated port) and wait until ready
5. Run the HTTP suite (16 checks), then kill the server

### HTTP checks

1. `POST /users` — register a user (201, token, no password)
2. `POST /authentication` — login (200, token)
3. `GET /authentication/verify` — verify token
4. `GET /product` without token — rejected (401)
5. `POST /product` — create (201, id)
6. `GET /product` — list contains the record
7. `GET /product/:id` — get one
8. `PATCH /product/:id` — update
9. `DELETE /product/:id` — soft-delete (2xx)
10. `GET /product/:id` — confirm the soft-deleted record is hidden
11. `GET /users` — list includes the registered user
12. `POST /product` succeeds (201) even though the instrumented `onCreate` throws
13. `beforeCreate` reshapes the payload before it is written
14. `@UseBefore` reshapes the request body before the handler runs
15. Every service hook fired, and `ctx.service` was back-assigned by the registry
16. `@UseBefore` plus both `@UseAfter` forms (injectable class + inline function) ran

### Service events

Checks 12–16 replace the generated `product.events.ts` with an instrumented version that
appends each hook it receives to `<appDir>/.events.log`, reshapes a probe payload, and
throws from `onCreate`. The controller's create handler gets `@UseBefore` / `@UseAfter`
added, and an `AuditHandler` provider is registered in the resource module.

Together they verify the parts a unit test cannot: `@ServiceEvents` discovery, the
`ServiceEventsRegistry` wiring at boot, the module providers, the controller calling the
non-underscore methods, and a detached hook being unable to break a response.

For the dispatcher's own contract (`before*` vs `on*`, `whenSettled()`, `emit()`,
`events: false`) there is a separate, database-free test:

```bash
yarn test:events    # scripts/e2e/test-service-events.ts, ~1s
```

## Prerequisites

- **Node 20+** (uses the built-in global `fetch`).
- **The generator** — the script **builds the CLI from the current source**
  (`nx build cli`) and runs `dist/packages/cli/src/index.js`, so it always tests
  this checkout (never a stale globally-linked `nest-cli`). Set
  `E2E_USE_GLOBAL_CLI=1` to force the globally-linked `nest-cli` instead; if the
  build can't be produced it falls back to a global link when present.
- **Database servers** — needed for the server-backed DBs. For each, the script
  uses an existing instance on the standard port if present, otherwise starts a
  throwaway Docker container (and removes it afterward). If neither a local
  instance nor Docker is available, that database is **skipped** (not failed).

  | DB | Needs | Docker image the script starts | Default port |
  |----|-------|-------------------------------|--------------|
  | SQLite | nothing (file-based) | — | — |
  | PostgreSQL | server | `postgres:16` | 5432 |
  | MySQL | server | `mariadb:11` (compatible with both the Prisma `@prisma/adapter-mariadb` and TypeORM `mysql2` drivers) | 3306 |
  | MongoDB | server | `mongo:7` | 27017 |

  The container credentials match the `DATABASE_URL` the generator writes
  (`user`/`password`/`mydb`), so the generated app connects to the same instance.

## Usage

From the repo root (the npm script wires up the TypeScript loader via
`@swc-node/register`):

```bash
# Full matrix (Prisma + TypeORM + Mongoose)
yarn test:e2e:generated              # or: npm run test:e2e:generated

# Narrow by database and/or ORM (either flag filters the matrix):
yarn test:e2e:generated --db SQLite               # SQLite cases (Prisma + TypeORM); no external services
yarn test:e2e:generated --orm typeorm             # all TypeORM cases
yarn test:e2e:generated --db SQLite --orm typeorm # one case, zero external services (fast inner loop)
yarn test:e2e:generated --db PostgreSQL --orm prisma
yarn test:e2e:generated --db MongoDB              # Mongoose

# Validate the LOCAL build (and packages not yet published, e.g. a new @nest-extended/typeorm):
yarn test:e2e:generated --orm typeorm --local
yarn test:e2e:generated --db SQLite --orm typeorm --local   # no external services
```

`--local` builds all packages, `npm pack`s each `@nest-extended/*` into
`.e2e-apps/.local-packages/`, and makes the generated apps install them via
`file:` tarballs (instead of the registry) by setting `NEST_EXTENDED_LOCAL_DIR`.

If you want the Docker-backed DBs to run, make sure the Docker daemon is up
first (e.g. `open -a Docker` on macOS).

Exit code is `0` only if every non-skipped case passes all checks.

## Output & artifacts

- Generated apps are kept under `.e2e-apps/<db>-<orm>-app/` (gitignored) for
  inspection. Each run recreates them fresh.
- `.e2e-apps/<db>-<orm>-app/.events.log` records every lifecycle hook the instrumented
  events class and controller received, in order — useful when checks 12–16 fail.
- Server logs are written to `.e2e-apps/<db>-<orm>-app.server.log` — check these if a
  server fails to start.
- The script picks dedicated app-server ports starting at `3100` to avoid
  clashing with a dev server on `3000`.
