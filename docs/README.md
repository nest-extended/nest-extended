# NestExtended Documentation

NestExtended is a TypeScript monorepo of packages and a CLI that extend NestJS with
generic CRUD services, a generic controller, a FeathersJS-style query language,
soft-delete/auditing, exception filters, and an end-to-end app scaffolder.

This `docs/` folder holds **task- and audience-oriented guides**. For flat,
per-symbol API reference, the package READMEs and `AGENT_CONTEXT.md` remain the
source of truth — this folder links to them rather than repeating them.

## Start here

| If you want to… | Read |
|---|---|
| Scaffold a new app or add the packages to an existing one | [getting-started.md](getting-started.md) |
| Look up a `nest-cli` command, flag, or prompt | [cli-reference.md](cli-reference.md) |
| Understand the app that `nest-cli g app` produces (structure, HTTP API, auth) | [generated-app.md](generated-app.md) |
| Write queries over HTTP (`$limit`, `$sort`, operators, pagination) | [querying.md](querying.md) |
| Understand or configure soft delete and audit fields | [soft-delete-and-auditing.md](soft-delete-and-auditing.md) |
| Run or extend the end-to-end test suite | [testing.md](testing.md) |
| Build, release, or contribute to the monorepo | [architecture.md](architecture.md) |

## The packages

All packages are published under the `@nest-extended/*` scope (currently
`0.0.2-beta-18`, MIT). The per-package READMEs are the canonical API reference:

| Package | npm | What it provides | Reference |
|---|---|---|---|
| Core | `@nest-extended/core` | `NestController`, `NestExtendedModule`, `NullResponseInterceptor`, CLS helper, shared types | [packages/core/README.md](../packages/core/README.md) |
| Mongoose | `@nest-extended/mongoose` | `NestService<M, D>` + Mongoose query utils + exception filters | [packages/mongoose/README.md](../packages/mongoose/README.md) |
| Prisma | `@nest-extended/prisma` | `NestService<T>` for Prisma (PostgreSQL/MySQL/SQLite) + exception filters | [packages/prisma/README.md](../packages/prisma/README.md) |
| Decorators | `@nest-extended/decorators` | `@User`, `@Public`, `@ModifyBody`, `setCreatedBy` | [packages/decorators/README.md](../packages/decorators/README.md) |
| CLI | `@nest-extended/cli` (binary `nest-cli`) | App / auth / resource scaffolding | [packages/cli/README.md](../packages/cli/README.md) |

## How the pieces fit together

```
@nest-extended/decorators        @nest-extended/cli  (scaffolder — emits code
        │ (used by core)                              that imports the others)
        ▼
@nest-extended/core   ◄── NestExtendedModule, NestController, soft-delete types
        │
        ├──────────────┬──────────────┐
        ▼              ▼
@nest-extended/    @nest-extended/
   mongoose            prisma        ◄── NestService (generic CRUD per database)
```

A typical app either:

1. **Is generated** by `nest-cli g app` — you get a wired NestJS app (auth + CRUD)
   and add resources with `nest-cli g service`. See [generated-app.md](generated-app.md).
2. **Adopts the packages manually** — you extend `NestController` and `NestService`
   in your own NestJS app. See [getting-started.md](getting-started.md).

## Other references in this repo

- [`../README.md`](../README.md) — project overview and package summaries.
- [`../AGENT_CONTEXT.md`](../AGENT_CONTEXT.md) — single-file API reference written for AI agents (note: some version/path details lag the source; the source files and this `docs/` folder are authoritative).
- [`../scripts/e2e/README.md`](../scripts/e2e/README.md) — the generated-app end-to-end test harness.
- [`../skills/SKILL.md`](../skills/SKILL.md) — installable AI-agent skill describing the ecosystem.
