# Service Events

Every generated service can have a companion **events class** — `{name}.events.ts` —
holding the logic that should run around its CRUD operations. It replaces the habit of
putting side effects in the controller, where they are invisible to any other caller.

```ts
@Injectable()
@ServiceEvents(CompanyService)
export class CompanyEvents extends NestServiceEvents<CompanyService, CompanyDocument> {
  constructor(
    @InjectModel(CompanyProfile.name)
    private readonly companyProfileModel: Model<CompanyProfileDocument>,
  ) {
    super();
  }

  async onCreate(company: CompanyDocument, ctx: EventContext<CompanyService>) {
    await this.companyProfileModel.create({ company: company._id, createdBy: ctx.user?._id });
  }
}
```

## `_find` vs `find`

Each `NestService` now exposes two versions of every operation:

| Method | Fires events | Use it from |
|---|---|---|
| `_find`, `_get`, `_create`, `_patch`, `_remove` | no | inside a service, calling another service |
| `find`, `get`, `create`, `patch`, `remove` | yes | controllers, and anywhere events should fire |

They are otherwise identical — same arguments, same return types. Generated controllers
call the event-firing versions; existing projects switch over with
[`nest-cli migration events`](cli-reference.md#migration-events).

This split is the whole point: `AuthService` looking a user up with
`usersService._find(...)` should not fire the users service's `onFind` hook.

## The hooks

Every hook is optional. All receive `(payload, ctx)`.

| Hook | Payload | When |
|---|---|---|
| `beforeFind` / `onFind` | the query / the result | around `find()` |
| `beforeGet` / `onGet` | the query / the record or `null` | around `get()` |
| `beforeCreate` / `onCreate` | the input / the created record(s) | around `create()` |
| `beforePatch` / `onPatch` | the patch / the updated record(s) | around `patch()` |
| `beforeRemove` / `onRemove` | the id / the removed record(s) | around `remove()` |
| `onError` | the error | a detached hook threw |

### `before*` runs inline

`before*` hooks are awaited before the database is touched, and **whatever they return
replaces the input**. Return nothing to leave it alone.

```ts
beforeCreate(data: any) {
  return { ...data, slug: slugify(data.name) };
}
```

Throwing from a `before*` hook aborts the operation and the exception reaches the client —
that is how you cancel. `beforeRemove`'s return value is ignored; throw to cancel it.

### `on*` runs detached

`on*` hooks run **after the response has been sent**. They are scheduled on `setImmediate`,
so the request finishes first. This means:

- Their return value is ignored — an `on*` hook **cannot change the response**.
- A throw is caught and logged, never surfaced to the client.
- The work is **not transactional** with the operation, and is lost if the process dies
  before it runs. For guaranteed delivery, write to an outbox or a queue from the hook.

```
[NestExtendedEvents] CompanyEvents.onCreate failed: connection refused
```

Define `onError(error, ctx)` on the events class to handle those yourself instead.

## The context object

```ts
interface EventContext<S> {
  user?: any;              // from the explicit argument, else the CLS store
  service: S;              // the service that dispatched the event
  hook?: string;           // the hook currently running
  id?: string | null;      // get, patch, remove
  query?: Record<string, any>;
  data?: any;              // create, patch
  findOptions?: { pagination?: boolean };
}
```

`ctx.user` is resolved from `getCurrentUser()` ([soft-delete-and-auditing.md](soft-delete-and-auditing.md)),
which the generated `AuthGuard` populates. It is captured synchronously before a hook is
detached, so it is still correct by the time the hook runs.

`this.service` on the events class is the same object as `ctx.service`, typed via the
class's first generic parameter — use it to call back into the service.

## Custom events

The method name on the events class **is** the event name. Add a method, then `emit` it
from a custom service method:

```ts
// company.service.ts
async approve(id: string) {
  const doc = await this._patch(id, { status: 'approved' });
  this.emit('approve', doc);   // fire-and-forget, like every on* hook
  return doc;
}

// company.events.ts
async approve(company: CompanyDocument, ctx: EventContext<CompanyService>) {
  await this.mailService.send(company.ownerEmail, 'approved');
}
```

`emit` is type-checked against the events class, so a misspelled name is a compile error —
provided the service names it as the third generic, which the generator does for you:

```ts
export class CompanyService extends NestService<Company, CompanyDocument, CompanyEvents> {
```

## `@UseBefore` / `@UseAfter` on controllers

Service events fire for every caller and know nothing about HTTP. When you need the
request or response, use the controller decorators from `@nest-extended/decorators`
instead. They accept an inline function, an injectable class, or a mix, on a single
handler or on a whole controller (class-level handlers run first).

```ts
@Controller('company')
@UseAfter(AuditHandler)
export class CompanyController {
  @Post()
  @UseBefore((ctx) => { ctx.body.slug = slugify(ctx.body.name); })
  @UseAfter(NotifyHandler, (ctx) => logger.log(ctx.result))
  create(@Body() dto: CreateCompanyDto) { ... }
}

@Injectable()
export class NotifyHandler implements EventHandler {
  constructor(private readonly mail: MailService) {}
  async handle(ctx: ControllerContext) { await this.mail.send(ctx.result); }
}
```

An injectable handler must be listed in the module's `providers` like any other.

`@UseBefore` is awaited and can mutate `ctx.body` / `ctx.query`. `@UseAfter` is detached,
matching the `on*` rule; each handler runs independently, so one failure does not stop the
others.

```ts
interface ControllerContext {
  request; response; user?;
  params; query; body;
  result?;                 // @UseAfter only
  handler; controller;
}
```

`@ModifyBody(setCreatedBy())` still works and is what generated controllers use;
`@UseBefore` is the general-purpose version of the same idea.

## Turning events off

| Scope | How |
|---|---|
| One service | `super(model, { events: false })` |
| Whole app | `NestExtendedModule.forRoot({ events: false })` |
| One call | use the underscore method (`_create` instead of `create`) |

`events: false` disables `before*` and `on*` alike.

## Broadcasting to the rest of the app

With `@nestjs/event-emitter` installed and `EventEmitterModule.forRoot()` registered, a
service can also broadcast its events so **other** modules can subscribe:

```ts
super(companyModel, { events: true, broadcast: 'company' });
```

```ts
@Injectable()
export class AuditListener {
  @OnEvent('company.create') handle(e: { payload: CompanyDocument; user?: any }) { ... }
}
```

Event names are the operation name, never past tense — `company.create`, `company.patch`,
`company.remove`, and a custom `emit('approve')` becomes `company.approve`. Only `on*` and
custom events broadcast; `before*` does not.

`nest-cli g service --broadcast` installs the package, registers the module, and sets the
option for you. `@nestjs/event-emitter` is never a dependency of `@nest-extended/core`: if
it is absent, broadcasting is silently off and everything else still works.

## Requirements and limitations

- **`NestExtendedModule.forRoot()` must be in `app.module.ts`.** It is what discovers
  `@ServiceEvents()` classes and wires them. Generated apps already have it.
- **Both classes must be in the module's `providers`** — the generator does this.
- Wiring happens at `onModuleInit`, so a call made from *another* provider's
  `onModuleInit` may run before the hooks are attached. Look for the boot log line
  confirming each wiring:
  ```
  [NestExtendedEvents] CompanyEvents -> CompanyService
  ```
- **Request-scoped** services and events classes are not supported; the registry logs a
  warning and skips them.
- A soft delete fires `onRemove` only, not `onPatch` — `remove()` calls `_patch`
  internally, which is on the event-free path.

## Testing hooks

`on*` hooks are detached, so a test cannot assert on them immediately after an operation.
`whenSettled()` waits for every hook dispatched so far:

```ts
await service.create({ name: 'Acme' });
await service.whenSettled();
expect(mailer.send).toHaveBeenCalled();
```

See [testing.md](testing.md) for the end-to-end harness, which exercises the full wiring
against a running app.
