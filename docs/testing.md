# Testing

This project's automated test is an **end-to-end (E2E) suite that generates real
apps and exercises their HTTP API** — not unit tests. This page explains why,
what the suite covers, how to run it, how to read its output, and how to extend
it.

For the harness's own README (kept next to the code), see
[`../scripts/e2e/README.md`](../scripts/e2e/README.md). This doc is the
docs-folder entry point and adds the testing philosophy, the CI relationship, and
how to add checks.

## Why E2E is the safety net

The CLI generates code by emitting **strings** (see
[architecture.md](architecture.md#how-the-cli-generates-code)). Those template
strings are never compiled or type-checked as part of this repo, so a broken
template — a bad import, a malformed `app.module.ts` rewrite, a wrong endpoint —
would not be caught by building the packages.

The E2E harness closes that gap: it runs the generator end to end, boots the
generated app, and calls its real endpoints over HTTP. If the emitted code does
not compile, wire up, or behave correctly, the suite fails.

> **There are currently no unit tests.** The root `package.json` defines
> `"test": "nx test"`, but no project declares a `test` target and there is no
> Jest config, so `yarn test` / `nx test` has nothing to run. The `*.spec.template.ts`
> files under the CLI are templates that emit specs into *generated* apps — they
> are not run here. The E2E suite is the test to run before merging.

## What the suite does

Source: [`../scripts/e2e/test-generated-app.ts`](../scripts/e2e/test-generated-app.ts).
It covers all four supported databases: **SQLite**, **PostgreSQL**, **MySQL**
(all Prisma), and **Mongoose**.

For each database, in order:

1. Generate an app with auth:
   `nest-cli g app <db>-app --db <DB> --validator zod --pm npm --auth`
2. Generate a CRUD resource:
   `nest-cli g service product --db <DB> --validator zod`
3. **Prisma databases only:** `npx prisma generate` then `npx prisma db push`
   (retried up to 5 times — a freshly started DB can accept TCP before it accepts queries).
4. Boot the server (`npm run start` on a dedicated port) and wait until it responds (up to 90s).
5. Run the HTTP assertion suite, then kill the server.

### The HTTP checks (11)

Run against each booted app by `runApiSuite`:

| # | Request | Asserts |
|---|---|---|
| 1 | `POST /users` | 201, returns `accessToken` + user, no `password` in the response |
| 2 | `POST /authentication` | 200, returns `accessToken` |
| 3 | `GET /authentication/verify` | 200, returns the user matching the registered email |
| 4 | `GET /product` (no token) | 401 — the global auth guard rejects unauthenticated access |
| 5 | `POST /product` | 201, returns an id |
| 6 | `GET /product` | 200, list contains the created record |
| 7 | `GET /product/:id` | 200, returns the record |
| 8 | `PATCH /product/:id` | 200, the update is applied |
| 9 | `DELETE /product/:id` | 2xx (soft delete) |
| 10 | `GET /product/:id` | 404 / null — the soft-deleted record is hidden |
| 11 | `GET /users` | 200, list includes the registered user |

The harness is **id-shape agnostic** (`_id` for Mongo, `id` for Prisma) and
**list-shape agnostic** (accepts a bare array or a `{ data: [...] }` pagination
envelope), so the same checks run unchanged across databases. Assertions are
collected rather than aborting on the first failure, so one run reports every
broken check.

## Running it

From the repo root (the npm script wires up the TypeScript loader via
`@swc-node/register`):

```bash
# All four databases
yarn test:e2e:generated

# A single database (fast inner loop). SQLite needs no external services:
yarn test:e2e:generated --db SQLite
yarn test:e2e:generated --db PostgreSQL
yarn test:e2e:generated --db MySQL
yarn test:e2e:generated --db Mongoose
```

`--db` matches case-insensitively; an unknown value exits with code `2`. With no
flag, all four run in order (SQLite, PostgreSQL, MySQL, Mongoose).

### Prerequisites

- **Node 20+** — the harness uses the built-in global `fetch`.
- **The generator.** The harness prefers a globally-linked `nest-cli` on `PATH`.
  If none is found it builds the CLI from current source (`nx build cli`) and runs
  `dist/packages/cli/src/index.js` directly — no linking required. (If you *do*
  link `nest-cli`, make sure it reflects your current source, or the test
  validates stale code.) A failed build or missing dist exits with code `2`.
- **Database servers** for the non-SQLite databases. For each, the harness uses an
  existing instance on the standard port if one is reachable; otherwise it starts
  a throwaway Docker container (`docker run --rm`) and removes it afterward. If
  neither a local instance nor Docker is available, that database is **skipped**
  (reported `SKIP`, not failed).

  | Database | Needs | Docker image started | Port |
  |---|---|---|---|
  | SQLite | nothing (file-based) | — | — |
  | PostgreSQL | a server | `postgres:16` | 5432 |
  | MySQL | a server | `mariadb:11` (compatible with the generated `@prisma/adapter-mariadb`) | 3306 |
  | Mongoose | a server | `mongo:7` | 27017 |

  Container credentials (`user` / `password` / `mydb`) match the `DATABASE_URL` the
  generator writes, so the generated app connects to the same instance. If you want
  the Docker-backed databases to run, start the Docker daemon first
  (e.g. `open -a Docker` on macOS).

The fastest reliable loop while iterating on templates is
`yarn test:e2e:generated --db SQLite` — zero external services.

## Reading the output

- A per-database heading, then a `✓`/`✗` line per check, then a final **Summary**
  listing each database as `PASS` / `FAIL` / `SKIP` (with `passed/total` counts).
- **Generated apps are kept** under `.e2e-apps/<db>-app/` (gitignored) for
  inspection; each run recreates them fresh.
- **Server logs** are written to `.e2e-apps/<db>-app.server.log` — check these
  first when a server fails to start or a request behaves unexpectedly.
- App-server **ports start at 3100** and increment per database, to avoid clashing
  with a dev server on 3000.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Every non-skipped database passed all checks |
| `1` | At least one database failed (or an unexpected error) |
| `2` | Bad `--db` value, or the CLI could not be resolved/built |

A `SKIP` (no database available) does **not** fail the run.

## Relationship to CI

CI does **not** run this suite. [`ci.yml`](../.github/workflows/ci.yml) only builds
all packages on push/PR to `main`, and [`publish.yml`](../.github/workflows/publish.yml)
builds and publishes on a `v*` tag. The E2E suite is a **local/manual gate** —
run it yourself before opening or merging a PR that touches the generator or its
templates. (Running it in CI would require provisioning the database servers in
the workflow; that is not configured today.)

## Extending the suite

- **Add an HTTP assertion:** add a `suite.check('label', <condition>, '<detail>')`
  call inside `runApiSuite` in `test-generated-app.ts`. `check` records the result
  and never throws, so later checks still run. Use the `idOf()` and `asArray()`
  helpers to stay id-shape and list-shape agnostic across databases.
- **Change the generated resource:** `RESOURCE` (default `product`) controls the
  resource name and its `@Controller('<RESOURCE>')` route.
- **Add a database server:** extend the `DB_SERVERS` map with the container image,
  port, env, and an optional readiness command. SQLite stays absent (file-based).
- **Tune timeouts:** `SERVER_READY_TIMEOUT_MS` (90s) for server boot and
  `DB_READY_TIMEOUT_MS` (120s) for container start.

After any change to the CLI commands, lib helpers, or templates
([architecture.md](architecture.md#how-the-cli-generates-code)), rerun the suite —
it is the only thing that validates the *emitted* code.
