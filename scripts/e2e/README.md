# Generated-app E2E test

`test-generated-app.ts` verifies that an app scaffolded by `nest-cli` actually
**boots and serves working auth + CRUD endpoints**. It generates an app, adds a
CRUD resource, prepares the database, starts the server, and exercises the real
HTTP API. Run it after changing the generator or its templates to catch
regressions in the *emitted* code.

It covers **all four supported databases**: `SQLite`, `PostgreSQL`, `MySQL`
(all Prisma-based) and `Mongoose`.

## What it does (per database)

1. `nest-cli g app <db>-app --db <DB> --validator zod --pm npm --auth`
2. `nest-cli g service product --db <DB> --validator zod`
3. **Prisma DBs (SQLite/PostgreSQL/MySQL):** `npx prisma generate` + `npx prisma db push`
   **All server DBs (PostgreSQL/MySQL/Mongoose):** ensure the server is reachable (see below)
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
- **The generator** — the script prefers a globally-linked `nest-cli`; if none is
  on PATH it automatically builds the CLI from the current source
  (`nx build cli`) and runs `dist/packages/cli/src/index.js`. No linking
  required. (If you *do* link, make sure it reflects your current source.)
- **Database servers** — needed for the server-backed DBs. For each, the script
  uses an existing instance on the standard port if present, otherwise starts a
  throwaway Docker container (and removes it afterward). If neither a local
  instance nor Docker is available, that database is **skipped** (not failed).

  | DB | Needs | Docker image the script starts | Default port |
  |----|-------|-------------------------------|--------------|
  | SQLite | nothing (file-based) | — | — |
  | PostgreSQL | server | `postgres:16` | 5432 |
  | MySQL | server | `mariadb:11` (compatible with the generated `@prisma/adapter-mariadb`) | 3306 |
  | Mongoose | server | `mongo:7` | 27017 |

  The container credentials match the `DATABASE_URL` the generator writes
  (`user`/`password`/`mydb`), so the generated app connects to the same instance.

## Usage

From the repo root (the npm script wires up the TypeScript loader via
`@swc-node/register`):

```bash
# All four databases
yarn test:e2e:generated              # or: npm run test:e2e:generated

# A single database (fast inner loop). SQLite needs no external services:
yarn test:e2e:generated --db SQLite
yarn test:e2e:generated --db PostgreSQL
yarn test:e2e:generated --db MySQL
yarn test:e2e:generated --db Mongoose
```

If you want the Docker-backed DBs to run, make sure the Docker daemon is up
first (e.g. `open -a Docker` on macOS).

Exit code is `0` only if every non-skipped database passes all checks.

## Output & artifacts

- Generated apps are kept under `.e2e-apps/<db>-app/` (gitignored) for
  inspection. Each run recreates them fresh.
- Server logs are written to `.e2e-apps/<db>-app.server.log` — check these if a
  server fails to start.
- The script picks dedicated app-server ports starting at `3100` to avoid
  clashing with a dev server on `3000`.
