# Architecture & Contributing

How the monorepo is laid out, how the packages depend on each other, how the CLI
generates code, and how to build, test, release, and contribute.

## Monorepo at a glance

| Aspect | Value |
|---|---|
| Workspace | `@nest-extended/source` (private), MIT |
| Build tool | [Nx](https://nx.dev) `22.7.5` |
| Package manager | Yarn (v1) — `yarn.lock` is the lockfile |
| Node target | 20 (CI + E2E harness) |
| TypeScript | `5.9.3`; base `target: es2015`, `module: esnext`; packages emit CommonJS (`"type": "commonjs"`) |
| Packages dir | `packages/` (Nx `libsDir`; `appsDir` is `apps/`, currently empty) |

Key root files:

- [`nx.json`](../nx.json) — Nx plugins (`@nx/js/typescript` for build/typecheck, `@nx/eslint`, `@nx/webpack`) and workspace layout.
- [`tsconfig.base.json`](../tsconfig.base.json) — shared compiler options and the `@nest-extended/*` path aliases used across packages.
- [`eslint.config.mjs`](../eslint.config.mjs) — flat ESLint config with Nx module-boundary enforcement.
- [`package.json`](../package.json) — workspace scripts and the full dependency set.

### Path aliases

In-repo imports resolve through `tsconfig.base.json` `paths`, so packages import
each other by their public name during development:

```
@nest-extended/cli         -> packages/cli/src/index.ts
@nest-extended/core        -> packages/core/src/index.ts
@nest-extended/decorators  -> packages/decorators/src/index.ts
@nest-extended/mongoose    -> packages/mongoose/src/index.ts
@nest-extended/prisma      -> packages/prisma/src/index.ts
```

## Package dependency graph

```
@nest-extended/decorators   (tslib)                @nest-extended/cli  (standalone;
        ▲                                            emits code that imports the
        │ imported at runtime by core                others — not a build dep of them)
        │
@nest-extended/core   (qs, tslib)
        ▲
        ├───────────────────────┐
        │                       │
@nest-extended/mongoose   @nest-extended/prisma
 (core, zod, tslib)        (core, zod, tslib)
```

Declared runtime `dependencies` (from each package's `package.json`):

| Package | Declared dependencies |
|---|---|
| `core` | `qs`, `tslib` |
| `decorators` | `tslib` |
| `mongoose` | `tslib`, `@nest-extended/core`, `zod` |
| `prisma` | `tslib`, `@nest-extended/core`, `zod` |
| `cli` | `@nestjs/cli`, `chalk@4`, `commander@11`, `fs-extra`, `inquirer@8`, `tslib` |

Internal `@nest-extended/*` dependencies are pinned to the **exact** current
version and kept in sync by the release script (below).

### Things to know about the dependency declarations

These are accurate observations from the manifests — relevant if you touch
packaging:

- **Framework/host deps are not declared.** The packages expect the consuming app
  to already provide `@nestjs/common`, the ODM/ORM (`mongoose` + `@nestjs/mongoose`,
  or `@prisma/client` + a driver adapter), `nestjs-cls`, `lodash`, and `express`.
  None are listed as `dependencies` or `peerDependencies`. The
  [getting-started guide](getting-started.md#path-b--add-to-an-existing-app)
  tells consumers to install them.
- **`@nest-extended/core` imports `@nest-extended/decorators`** (in `NestController`)
  but does not declare it — consumers must install `@nest-extended/decorators`.
- **The CLI uses `glob`** (in `migration.ts`) but `glob` is not in
  `packages/cli/package.json` — it is a root dependency. Keep this in mind if the
  published CLI's `m run` ever fails to resolve `glob`.
- **`zod` version skew:** `mongoose`/`prisma` declare `zod ^3.22.4` while the
  workspace root uses `zod ^4.3.6`. The exception filters use `error.issues`,
  which exists in both major versions.

## How the CLI generates code

The CLI is the most involved package. Its source ([packages/cli/src](../packages/cli/src)):

```
src/
├── index.ts                 # commander program: version, help, generate, migration
├── commands/
│   ├── generate.ts          # `g` command group: app / service / auth subcommands + flags
│   ├── generate-app.ts      # `g app` — runs `nest new`, installs deps, rewrites app.module.ts
│   ├── generate-service.ts  # `g service` — name transform, file emit, model/schema, registration
│   ├── generate-auth.ts     # `g auth` — Mongoose auth stack into an existing app
│   └── migration.ts         # `m run` — import-rewrite codemods
├── lib/
│   ├── create-file.ts                 # mkdir -p + write
│   ├── update-app-module.ts           # bracket-matching insert of a module import + imports[] entry
│   ├── configure-prisma-generator.ts  # normalize the Prisma 7 generator block + gitignore
│   ├── generate-auth-services.ts      # writes the Mongoose auth/users files
│   └── generate-prisma-auth-services.ts  # writes the Prisma auth/users files + appends Users model
└── templates/               # functions returning source code as strings
```

**Templates are functions that return strings.** A template like
`getController(Name, name, url, depth, fullPath)` returns the text of a `.ts`
file; the command writes that text to disk in the *target* app. The strings in
`packages/cli/src/templates/` are therefore **not** compiled or type-checked as
part of this repo — they are emitted into generated apps. Editing generated output
means editing these templates.

Template naming convention:

- `*.template.ts` without a prefix → Mongoose variant (e.g. `controller.template.ts`, `schema.template.ts`).
- `prisma-*.template.ts` → Prisma variant (e.g. `prisma-controller.template.ts`, `prisma-model.template.ts`, `prisma-setup.template.ts`).
- `*-class-validator.template.ts` → the class-validator DTO alternative to the Zod DTO.

Because templates emit code rather than run it, the safety net is the **E2E test**
(below), which generates an app from the templates, boots it, and exercises the
HTTP API.

## Build

Nx builds each package with `@nx/js:tsc` (config: each package's
`tsconfig.lib.json`) to `dist/packages/<name>/`:

```bash
yarn nx run-many -t build        # build everything
yarn nx build core               # build one package (core | mongoose | prisma | cli | decorators)
yarn nx run-many -t lint         # lint all
yarn nx run-many -t typecheck    # typecheck all
```

`tsconfig.lib.json` emits declarations (`declaration: true`). The CLI build also
copies `*.md` and `package.json` as assets; library builds copy `*.md`. Output
layout matches what the publish workflow expects (`dist/packages/<name>`).

## Test

The repository's automated test is the **generated-app end-to-end suite**, not
unit tests:

```bash
yarn test:e2e:generated                 # all four databases
yarn test:e2e:generated --db SQLite     # one database (SQLite needs no services)
```

It runs `scripts/e2e/test-generated-app.ts`, which generates an app, generates a
CRUD resource, prepares the database, boots the server, and runs 11 HTTP
assertions covering auth + full CRUD + soft delete. **Run it after any change to
the generator or its templates** — it is the only thing that catches regressions
in emitted code, and CI does not run it.

There are no unit tests today (`nx test` has nothing to run). See
**[testing.md](testing.md)** for the full picture: the check list, prerequisites,
the database/Docker matrix, output artifacts, exit codes, the CI relationship, and
how to add checks. The harness's own README lives at
[`../scripts/e2e/README.md`](../scripts/e2e/README.md).

## Release

Releases are version-tag driven. The script bumps every package in lockstep:

```bash
yarn release 0.0.2-beta-19         # node scripts/release.js <version>
git push && git push --tags        # pushing the tag triggers publishing
```

[`scripts/release.js`](../scripts/release.js):

1. Sets `version` in the root `package.json` and all five package manifests.
2. Rewrites internal `@nest-extended/*` dependency versions to match (keeps the pinned internal deps in sync).
3. `git add . && git commit -m "chore: release v<version>"` and creates tag `v<version>`.

It does **not** push — you push the commit and tag yourself.

## CI/CD

Two GitHub Actions workflows (`.github/workflows/`):

- **[`ci.yml`](../.github/workflows/ci.yml)** — on push/PR to `main`: Node 20, cache
  `node_modules`/yarn and `.nx/cache`, `yarn install --frozen-lockfile`,
  `yarn nx run-many -t build`, then list `dist/packages/`. Concurrency cancels
  superseded runs for the same PR/ref.
- **[`publish.yml`](../.github/workflows/publish.yml)** — on pushing a tag matching
  `v*`: a `build` job builds all packages and uploads `dist` as an artifact; then
  five parallel jobs (`core`, `mongoose`, `prisma`, `cli`, `decorators`) download
  the artifact and run `npm publish --access public` from `dist/packages/<name>`,
  authenticated with the `NPM_TOKEN` secret.

So: **merge to `main` builds; pushing a `v*` tag publishes.** Use
`yarn release <version>` to produce the tag.

[`dependabot.yml`](../.github/dependabot.yml) opens weekly (Monday) update PRs for
npm and GitHub Actions, grouping `@nestjs/*`, `nx`/`@nx/*`, and `@types/*`.

## Contributing workflow

1. Branch off `main`.
2. Make changes. For library code, run `yarn nx run-many -t lint typecheck build`.
3. For any CLI/template change, run `yarn test:e2e:generated` (at minimum
   `--db SQLite`, which needs no external services) and confirm all checks pass.
4. Keep the docs honest — if you change the generated output, the query language,
   or the CLI flags, update the relevant file in this `docs/` folder (and
   [`../AGENT_CONTEXT.md`](../AGENT_CONTEXT.md) / the package READMEs as needed).
5. Open a PR to `main`; CI must build green.
6. Releases are cut by a maintainer via `yarn release <version>` + pushing the tag.
