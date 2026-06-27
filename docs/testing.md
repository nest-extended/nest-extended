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
It covers a **database × ORM matrix**: Prisma and TypeORM each over **SQLite**,
**PostgreSQL**, **MySQL**, plus Mongoose over **MongoDB**. Each case is labelled
`DB+orm` (e.g. `SQLite+typeorm`).

For each case, in order:

1. Generate an app with auth:
   `nest-cli g app <db>-<orm>-app --db <DB> --orm <ORM> --validator zod --pm npm --auth`
2. Generate a CRUD resource:
   `nest-cli g service product --db <DB> --orm <ORM> --validator zod`
3. **Prepare the schema:**
   - Prisma: `npx prisma generate` then `npx prisma db push`
   - TypeORM: `npm run db:sync` (the generated manual schema-sync script; `DB_SYNCHRONIZE` defaults to `false`)
   - Mongoose: nothing
   (Prisma/TypeORM prep is retried up to 5 times — a freshly started DB can accept TCP before it accepts queries.)
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

The harness is **id-shape agnostic** (`_id` for Mongo, `id` for Prisma/TypeORM) and
**list-shape agnostic** (accepts a bare array or a `{ data: [...] }` pagination
envelope), so the same checks run unchanged across every case. Assertions are
collected rather than aborting on the first failure, so one run reports every
broken check.

## Running it

From the repo root (the npm script wires up the TypeScript loader via
`@swc-node/register`):

```bash
# Full matrix (Prisma + TypeORM + Mongoose)
yarn test:e2e:generated

# Narrow by database and/or ORM (either flag filters the matrix):
yarn test:e2e:generated --db SQLite                # SQLite cases (Prisma + TypeORM); no external services
yarn test:e2e:generated --orm typeorm              # all TypeORM cases
yarn test:e2e:generated --db SQLite --orm typeorm  # a single case, fast inner loop
yarn test:e2e:generated --db PostgreSQL --orm prisma
yarn test:e2e:generated --db MongoDB               # Mongoose
```

`--db` and `--orm` match case-insensitively (the legacy `--db Mongoose` is accepted
as `MongoDB`); an unknown value exits with code `2`. With no flag, the full matrix
runs.

By default the generated app installs the `@nest-extended/*` packages from the
**npm registry**, so a not-yet-published runtime package (e.g. a brand-new
`@nest-extended/typeorm`) can't be exercised that way. Use **`--local`** to pack
the workspace's packages from the current build and install them via `file:`
tarballs instead — validating the local source and unpublished packages:

```bash
yarn test:e2e:generated --orm typeorm --local            # all TypeORM cases, local build
yarn test:e2e:generated --db SQLite --orm typeorm --local  # one case, no external services
```

`--local` runs `nx run-many -t build`, `npm pack`s each `@nest-extended/*` package
into `.e2e-apps/.local-packages/<name>.tgz`, and sets `NEST_EXTENDED_LOCAL_DIR` so
the generator installs from those tarballs.

### Prerequisites

- **Node 20+** — the harness uses the built-in global `fetch`.
- **The generator.** The harness **builds the CLI from current source**
  (`nx build cli`) and runs `dist/packages/cli/src/index.js` directly, so it
  always validates this checkout rather than a stale globally-linked `nest-cli`.
  Set `E2E_USE_GLOBAL_CLI=1` to force the global link instead. If the build can't
  be produced and no global link exists, it exits with code `2`.
- **Database servers** for the non-SQLite databases. For each, the harness uses an
  existing instance on the standard port if one is reachable; otherwise it starts
  a throwaway Docker container (`docker run --rm`) and removes it afterward. If
  neither a local instance nor Docker is available, that database is **skipped**
  (reported `SKIP`, not failed).

  | Database | Needs | Docker image started | Port |
  |---|---|---|---|
  | SQLite | nothing (file-based) | — | — |
  | PostgreSQL | a server | `postgres:16` | 5432 |
  | MySQL | a server | `mariadb:11` (compatible with both Prisma `@prisma/adapter-mariadb` and TypeORM `mysql2`) | 3306 |
  | MongoDB | a server | `mongo:7` | 27017 |

  Container credentials (`user` / `password` / `mydb`) match the `DATABASE_URL` the
  generator writes, so the generated app connects to the same instance. If you want
  the Docker-backed databases to run, start the Docker daemon first
  (e.g. `open -a Docker` on macOS).

The fastest reliable loop while iterating on templates is
`yarn test:e2e:generated --db SQLite` — zero external services.

## Reading the output

- A per-case heading, then a `✓`/`✗` line per check, then a final **Summary**
  listing each `DB+orm` case as `PASS` / `FAIL` / `SKIP` (with `passed/total` counts).
- **Generated apps are kept** under `.e2e-apps/<db>-<orm>-app/` (gitignored) for
  inspection; each run recreates them fresh.
- **Server logs** are written to `.e2e-apps/<db>-<orm>-app.server.log` — check these
  first when a server fails to start or a request behaves unexpectedly.
- App-server **ports start at 3100** and increment per case, to avoid clashing
  with a dev server on 3000.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Every non-skipped case passed all checks |
| `1` | At least one case failed (or an unexpected error) |
| `2` | Bad `--db`/`--orm` value (or no matching case), or the CLI could not be resolved/built |

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
