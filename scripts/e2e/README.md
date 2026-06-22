# Generated-app E2E test

`test-generated-app.mjs` verifies that an app scaffolded by `nest-cli` actually
**boots and serves working auth + CRUD endpoints**. It generates an app, adds a
CRUD resource, prepares the database, starts the server, and exercises the real
HTTP API. Run it after changing the generator or its templates to catch
regressions in the *emitted* code.

## What it does (per database)

1. `nest-cli g app <db>-app --db <DB> --validator zod --pm npm --auth`
2. `nest-cli g service product --db <DB> --validator zod`
3. **SQLite only:** `npx prisma generate` + `npx prisma db push`
   **Mongoose:** ensure a MongoDB is reachable (see below)
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
- **`nest-cli` on PATH** (globally linked). The CLI source is TypeScript built by
  Nx, so build before linking:
  ```bash
  yarn nx build cli
  cd dist/packages/cli && npm link
  ```
  (Or `cd packages/cli && npm link` if your build emits runnable JS in place.)
- **For the Mongoose run:** a MongoDB at `localhost:27017`, **or** Docker
  installed (the script starts a throwaway `mongo:7` container and removes it
  afterward). If neither is available, the Mongoose run is **skipped** (not
  failed).

## Usage

From the repo root (the npm script wires up the TypeScript loader via
`@swc-node/register`):

```bash
# Both databases (SQLite + Mongoose)
yarn test:e2e:generated         # or: npm run test:e2e:generated

# SQLite only — zero external dependencies, good for the fast inner loop
yarn test:e2e:generated --db SQLite

# Mongoose only
yarn test:e2e:generated --db Mongoose
```

Exit code is `0` only if every non-skipped database passes all checks.

## Output & artifacts

- Generated apps are kept under `.e2e-apps/<db>-app/` (gitignored) for
  inspection. Each run recreates them fresh.
- Server logs are written to `.e2e-apps/<db>-app.server.log` — check these if a
  server fails to start.
- The script picks dedicated ports starting at `3100` to avoid clashing with a
  dev server on `3000`.
