# `nest-cli` Command Reference

`@nest-extended/cli` installs a binary named **`nest-cli`** (defined in
[packages/cli/package.json](../packages/cli/package.json) under `bin`). It
scaffolds NestJS apps and resources wired for the NestExtended ecosystem.

> `nest-cli` is distinct from NestJS's own `nest` binary (`@nestjs/cli`).
> Internally `nest-cli` *calls* `@nestjs/cli` (via `npx @nestjs/cli new`) when
> generating an app.

## Installation

```bash
npm install -g @nest-extended/cli      # global -> `nest-cli` on PATH
# or
npm install -D @nest-extended/cli      # per-project dev dependency
```

## Command overview

| Command | Alias | Arguments | Purpose |
|---|---|---|---|
| `nest-cli generate app <name>` | `g app` | `<name>` (required) | Scaffold a complete NestJS app |
| `nest-cli generate service <name>` | `g service` | `<name>` (required) | Generate a CRUD resource bundle and register it |
| `nest-cli generate auth` | `g auth` | — | Add Auth + Users modules to an existing app |
| `nest-cli migration run` | `m run` | — | Run version-upgrade codemods on `src/**/*.ts` |
| `nest-cli version` | `v` | — | Print the CLI version |
| `nest-cli help` | — | — | Print a formatted help screen |

Shared choice values used by the flags below:

- **Database** (`--database` / `--db`): `Mongoose`, `PostgreSQL`, `MySQL`, `SQLite`
- **Validator** (`--validator`): `zod`, `class-validator`
- **Package manager** (`--pkg-manager` / `--pm`): `npm`, `yarn`, `pnpm`

> **Interactive vs. non-interactive:** every choice has both a flag and an
> interactive prompt. Omit a flag and the CLI prompts for it; pass it and the
> prompt is skipped. An **invalid** flag value prints an error and exits with
> code `1` — it does not fall back to a prompt.

---

## `nest-cli g app <name>`

Scaffolds a complete, runnable NestJS application.

### Flags

| Flag | Alias | Values | Default (prompt) |
|---|---|---|---|
| `--pkg-manager <pm>` | `--pm`, `-p` | `npm` \| `yarn` \| `pnpm` | `yarn` |
| `--database <type>` | `--db`, `-d` | `Mongoose` \| `PostgreSQL` \| `MySQL` \| `SQLite` | `Mongoose` |
| `--validator <type>` | `-v` | `zod` \| `class-validator` | `zod` |
| `--auth` | — | (boolean) | prompt defaults to **yes** |
| `--skip-auth` | — | (boolean) | — |

`--auth` forces auth generation; `--skip-auth` forces it off; if neither is
present the CLI prompts (default yes). If both prompts and flags are omitted you
will be asked for each.

### What it does, in order

1. **`npx @nestjs/cli new <name> --package-manager <pm>`** — creates the base NestJS app in `./<name>`.
2. **Installs runtime dependencies** into the new app:
   - Always: `@nestjs/config`, `nestjs-cls`, `qs`, `@nest-extended/core@<cliVersion>`, `@nest-extended/decorators@<cliVersion>`.
   - Mongoose: `@nestjs/mongoose`, `mongoose`, `@nest-extended/mongoose@<cliVersion>`.
   - Prisma (PostgreSQL/MySQL/SQLite): `@prisma/client`, a database-specific driver adapter (`@prisma/adapter-pg`, `@prisma/adapter-mariadb`, or `@prisma/adapter-better-sqlite3`), and `@nest-extended/prisma@<cliVersion>`.
   - Validator: `zod`, **or** `class-validator` + `class-transformer`.
   - With `--auth`: `@nestjs/jwt`, `bcrypt`.
3. **Installs dev dependencies**: `@types/qs`, plus `@types/bcrypt` (auth) and `prisma` (Prisma databases).
4. **Prisma only:** runs `npx prisma init --datasource-provider <postgresql|mysql|sqlite>`, normalizes the generator block for NestJS (`provider = "prisma-client"`, `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`), adds `/src/generated` to `.gitignore`, and creates `src/prisma/prisma.service.ts` + `src/prisma/prisma.module.ts`.
5. **Rewrites `src/app.module.ts`** to import and configure `ConfigModule`, `ClsModule`, `NestExtendedModule.forRoot({ softDelete, filters: [] })`, the database module (`MongooseModule.forRoot(...)` or `PrismaModule`), and registers `GlobalExceptionFilter` (`APP_FILTER`) and `NullResponseInterceptor` (`APP_INTERCEPTOR`).
6. **Writes `.env`** with the database URL and `JWT_SECRET=super-secret-jwt-key`.
7. **With auth:** generates the Auth and Users modules (Mongoose or Prisma variants).
8. **Runs `<pm> run lint`** in the new app.

The resulting app and its HTTP API are documented in
[generated-app.md](generated-app.md).

### Examples

```bash
# Interactive
nest-cli g app shop

# Mongoose, Zod, yarn, with auth — no prompts
nest-cli g app shop --db Mongoose --validator zod --pm yarn --auth

# PostgreSQL, class-validator, npm, no auth
nest-cli g app shop --db PostgreSQL --validator class-validator --pm npm --skip-auth
```

---

## `nest-cli g service <name>`

Run **inside an existing app** (`cwd` must be the app root). Generates a full CRUD
resource and registers its module in `src/app.module.ts`.

### Flags

| Flag | Alias | Values |
|---|---|---|
| `--database <type>` | `--db`, `-d` | `Mongoose` \| `PostgreSQL` \| `MySQL` \| `SQLite` |
| `--validator <type>` | `-v` | `zod` \| `class-validator` |

Omitted flags are prompted (defaults: `Mongoose`, `zod`).

### Name transformation

The `<name>` argument is split on `/` (the last segment is the resource name); the
last segment is split on `-` and each part is PascalCased.

| Input | Class (Pascal) | Variable (camel) | Files land under | `@Controller(...)` path |
|---|---|---|---|---|
| `product` | `Product` | `product` | `src/services/product/` | `product` |
| `user-profile` | `UserProfile` | `userProfile` | `src/services/userProfile/` | `user-profile` |
| `qna/category` | `Category` | `category` | `src/services/qna/category/` | `qna/category` |

Note the controller route uses the **raw** argument you typed (`user-profile`,
`qna/category`), while the folder/class use the transformed name.

### What it does

1. **Ensures validator packages** are installed (`zod`, or `class-validator` + `class-transformer`) — installs missing ones using the detected package manager (`yarn.lock`→yarn, `pnpm-lock.yaml`→pnpm, else npm).
2. **Prisma only:** ensures `@prisma/client`, the driver adapter, `@nest-extended/prisma`, and dev `prisma` are installed; runs `prisma init` if there is no `prisma/schema.prisma`; creates `src/prisma/prisma.service.ts` + `prisma.module.ts` if missing.
3. **Detects whether auth exists** (`src/services/auth/` present). If so, generated schemas/models include `createdBy` / `updatedBy` / `deletedBy` audit fields.
4. **Generates files:**

   **Mongoose:**
   - `src/schemas/<path>.schema.ts` — Mongoose schema (`timestamps: true`; `deleted`, `deletedAt`, and the audit fields use `select: false`)
   - `src/services/<path>/<name>.module.ts` — `MongooseModule.forFeature(...)`
   - `src/services/<path>/<name>.service.ts` — `extends NestService`
   - `src/services/<path>/<name>.controller.ts` — CRUD controller
   - `src/services/<path>/dto/<name>.dto.ts` — Zod schemas **or** class-validator DTOs
   - `src/services/<path>/<name>.service.spec.ts` and `<name>.controller.spec.ts`

   **Prisma:** same module/service/controller/dto/specs, but instead of a schema
   file it **appends a `model <Name> { ... }` block to `prisma/schema.prisma`**
   (skipped if that model already exists).
5. **Registers the module** in `src/app.module.ts` (import + `imports[]` entry; skipped if already present).
6. **Runs `<pm> run lint`**.

> **After generating a Prisma resource,** apply the new model to your database:
> `npx prisma generate && npx prisma db push` (or create a migration).

### Examples

```bash
nest-cli g service product                          # prompts for db + validator
nest-cli g service product --db Mongoose -v zod
nest-cli g service order-item --db PostgreSQL -v class-validator
nest-cli g service qna/category --db Mongoose       # nested under src/services/qna/
```

---

## `nest-cli g auth`

Adds authentication (Auth + Users modules) to an **existing** app. Run from the
app root.

What it does:

1. **Aborts with exit code `1`** if `src/services/auth/` already exists.
2. Installs `@nestjs/jwt` + `bcrypt` (and dev `@types/bcrypt`) with the detected package manager.
3. Generates the **Mongoose** Auth + Users modules, schema, service, controller, guard, and JWT constants.
4. Registers `AuthModule` and `UsersModule` in `app.module.ts`.
5. Patches the `NestExtendedModule.forRoot` soft-delete `getData` to also set `deletedBy: user?._id`.
6. Runs `<pm> run lint`.

> **Important limitation:** `g auth` generates the **Mongoose** auth stack only,
> and its `app.module.ts` patch matches the Mongoose-style soft-delete block. To
> add auth to a **Prisma** app, generate the app with auth up front
> (`nest-cli g app <name> --db PostgreSQL --auth`); there is no standalone Prisma
> `g auth` path.

The generated auth endpoints and files are documented in
[generated-app.md](generated-app.md#authentication).

---

## `nest-cli migration run` (`m run`)

A codemod runner for upgrading code between NestExtended versions. It globs
`src/**/*.ts` and rewrites imports.

Currently it performs one migration: it moves `ModifyBody`, `User`, `Public`, and
`setCreatedBy` from `@nest-extended/core` to `@nest-extended/decorators`
(these decorators were relocated to their own package). Imports are split so any
non-decorator symbols stay imported from `@nest-extended/core`.

```bash
cd my-app
nest-cli m run
# -> "Migration completed. Updated N files."
```

It prints each updated file and a final count. Files with no matching imports are
left untouched.

---

## `nest-cli version` / `nest-cli help`

```bash
nest-cli version      # or: nest-cli v   -> prints e.g. 0.0.2-beta-18
nest-cli help         # formatted command/option overview
nest-cli --help       # commander's built-in help
```
