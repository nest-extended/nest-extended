import { Logger } from '@nestjs/common';
import { getCurrentUser } from '../common/cls.helper';
import { PaginatedResponse } from '../types/PaginatedResponse';
import { NestServiceOptions } from '../types/ServiceOptions';
import { getEventBus } from './event-bus';
import { EventContext, EventNames, NestServiceEvents } from './nest-service-events';

/** Maps a hook name to the suffix used when broadcasting it. */
const BROADCAST_NAMES: Record<string, string> = {
    onFind: 'find',
    onGet: 'get',
    onCreate: 'create',
    onPatch: 'patch',
    onRemove: 'remove',
};

/** Guard against a hook that emits itself forever. */
const MAX_SETTLE_PASSES = 10;

/**
 * Shared event dispatch for every ORM adapter's `NestService`.
 *
 * Each adapter implements the raw `_find`/`_get`/`_create`/`_patch`/`_remove` operations;
 * this class layers the public `find`/`get`/`create`/`patch`/`remove` methods on top,
 * which are identical except that they dispatch lifecycle events.
 *
 * Call the underscore methods for internal service-to-service work you do not want
 * events for; call the public ones from controllers.
 */
export abstract class NestServiceBase<
    D = any,
    E extends NestServiceEvents<any, D> = NestServiceEvents<any, D>,
> {
    protected options: NestServiceOptions = {};
    protected events?: E;

    private readonly pending = new Set<Promise<unknown>>();
    private readonly eventsLogger = new Logger('NestExtendedEvents');

    // ---- raw, event-free operations, implemented by each ORM adapter ----

    abstract _find<P extends boolean = true>(
        query?: Record<string, any>,
        findOptions?: { pagination?: P },
    ): Promise<P extends true ? PaginatedResponse<D> : D[]>;

    abstract _get(id: string, query?: Record<string, any>): Promise<D | null>;

    abstract _create(data: Partial<D>): Promise<D>;
    abstract _create(data: Partial<D>[]): Promise<D[]>;
    abstract _create(data: Partial<D> | Partial<D>[]): Promise<D | D[]>;

    abstract _patch(
        id: string | null,
        data: Record<any, any>,
        query?: Record<string, any>,
    ): Promise<D | D[] | null>;

    abstract _remove(
        id: string | null,
        query?: Record<string, any>,
        user?: any,
    ): Promise<D | D[] | null>;

    // ---- public, event-firing operations ----

    async find<P extends boolean = true>(
        query: Record<string, any> = {},
        findOptions?: { pagination?: P },
    ): Promise<P extends true ? PaginatedResponse<D> : D[]> {
        const nextQuery = (await this.run('beforeFind', query, { query, findOptions })) ?? query;
        const result = await this._find<P>(nextQuery, findOptions);
        this.detach('onFind', result, { query: nextQuery, findOptions });
        return result;
    }

    async get(id: string, query: Record<string, any> = {}): Promise<D | null> {
        const nextQuery = (await this.run('beforeGet', query, { id, query })) ?? query;
        const result = await this._get(id, nextQuery);
        this.detach('onGet', result, { id, query: nextQuery });
        return result;
    }

    async create(data: Partial<D>): Promise<D>;
    async create(data: Partial<D>[]): Promise<D[]>;
    async create(data: Partial<D> | Partial<D>[]): Promise<D | D[]>;
    async create(data: Partial<D> | Partial<D>[]): Promise<D | D[]> {
        const nextData = (await this.run('beforeCreate', data, { data })) ?? data;
        const result = await this._create(nextData);
        this.detach('onCreate', result, { data: nextData });
        return result;
    }

    async patch(
        id: string | null,
        data: Record<any, any>,
        query: Record<string, any> = {},
    ): Promise<D | D[] | null> {
        const nextData = (await this.run('beforePatch', data, { id, data, query })) ?? data;
        const result = await this._patch(id, nextData, query);
        this.detach('onPatch', result, { id, data: nextData, query });
        return result;
    }

    async remove(
        id: string | null,
        query: Record<string, any> = {},
        user?: any,
    ): Promise<D | D[] | null> {
        await this.run('beforeRemove', id, { id, query }, user);
        const result = await this._remove(id, query, user);
        this.detach('onRemove', result, { id, query }, user);
        return result;
    }

    // ---- event plumbing ----

    /**
     * Attaches an events class instance. Called by `ServiceEventsRegistry` at boot;
     * you should not need to call it yourself.
     */
    registerEvents(events?: E): void {
        if (!events) return;
        this.events = events;
        (events as NestServiceEvents<unknown, D>).service = this;
    }

    /**
     * Dispatches a custom event to the events class. Fire-and-forget, like every `on*`
     * hook — the event name is the name of the method to call on the events class.
     *
     * ```ts
     * async approve(id: string) {
     *   const doc = await this._patch(id, { status: 'approved' });
     *   this.emit('approve', doc);
     *   return doc;
     * }
     * ```
     */
    protected emit<K extends EventNames<E>>(
        event: K,
        payload?: any,
        ctx: Partial<EventContext> = {},
    ): void {
        this.detach(event, payload, ctx);
    }

    /**
     * Resolves once every detached hook dispatched so far has settled.
     * Intended for tests — production code should never need to wait on an `on*` hook.
     */
    async whenSettled(): Promise<void> {
        for (let pass = 0; pass < MAX_SETTLE_PASSES && this.pending.size; pass++) {
            await Promise.allSettled([...this.pending]);
        }
    }

    /** Runs a `before*` hook inline. Its return value replaces the input. */
    protected async run(
        hook: string,
        payload: any,
        ctx: Partial<EventContext> = {},
        user?: any,
    ): Promise<any> {
        const handler = this.resolveHook(hook);
        if (!handler) return undefined;
        return await handler.call(this.events, payload, this.buildContext(hook, ctx, user));
    }

    /**
     * Runs an `on*` hook detached from the request.
     *
     * Scheduled on `setImmediate` so the current macrotask — including response
     * serialization — completes first, which is what keeps events off the API thread.
     * Nothing it does can alter the response, and a throw is reported rather than raised.
     */
    protected detach(
        hook: string,
        payload: any,
        ctx: Partial<EventContext> = {},
        user?: any,
    ): void {
        if (this.options.events === false) return;

        const handler = this.resolveHook(hook);
        const bus = this.options.broadcast ? getEventBus() : undefined;
        if (!handler && !bus) return;

        // Built synchronously: the CLS store is only guaranteed to be present on this tick.
        const context = this.buildContext(hook, ctx, user);

        const task = new Promise<void>((resolve) => setImmediate(resolve))
            .then(() => handler?.call(this.events, payload, context))
            .then(() => {
                if (!bus) return;
                const name = BROADCAST_NAMES[hook] ?? hook;
                bus.emit(`${this.options.broadcast}.${name}`, { payload, ...context });
            })
            .catch((error: Error) => this.reportHookError(hook, error, context));

        this.pending.add(task);
        task.finally(() => this.pending.delete(task));
    }

    private resolveHook(hook: string): ((...args: any[]) => any) | undefined {
        if (this.options.events === false || !this.events) return undefined;
        const handler = (this.events as unknown as Record<string, unknown>)[hook];
        return typeof handler === 'function' ? (handler as (...args: any[]) => any) : undefined;
    }

    private buildContext(
        hook: string,
        ctx: Partial<EventContext>,
        user?: any,
    ): EventContext<this> {
        return { ...ctx, user: user ?? getCurrentUser(), service: this, hook };
    }

    private reportHookError(hook: string, error: Error, context: EventContext<any>): void {
        const owner = this.events?.constructor?.name ?? 'ServiceEvents';
        const onError = this.resolveHook('onError');

        if (onError && hook !== 'onError') {
            try {
                const handled = onError.call(this.events, error, context);
                Promise.resolve(handled).catch((err: Error) =>
                    this.eventsLogger.error(`${owner}.onError failed: ${err.message}`, err.stack),
                );
            } catch (err) {
                const failure = err as Error;
                this.eventsLogger.error(
                    `${owner}.onError failed: ${failure.message}`,
                    failure.stack,
                );
            }
            return;
        }

        this.eventsLogger.error(`${owner}.${hook} failed: ${error.message}`, error.stack);
    }
}
