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
2. `nest-cli g service product --db <DB> --orm <ORM> --validator zod`
3. **DB prep:**
   - Prisma: `npx prisma generate` + `npx prisma db push`
   - TypeORM: `npm run db:sync` (the generated manual schema-sync script; `DB_SYNCHRONIZE` defaults to `false`)
   - Mongoose: none
   For server-backed DBs (PostgreSQL/MySQL/MongoDB) it ensures the server is reachable (see below).
4. Boot the server (`npm run start`, on a dedicated port) and wait until ready
5. Run the HTTP suite (11 checks), then kill the server

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
- Server logs are written to `.e2e-apps/<db>-<orm>-app.server.log` — check these if a
  server fails to start.
- The script picks dedicated app-server ports starting at `3100` to avoid
  clashing with a dev server on `3000`.
