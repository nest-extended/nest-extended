import { Logger } from '@nestjs/common';
import { PaginatedResponse } from '../types/PaginatedResponse';

/**
 * Context passed as the second argument to every service event hook.
 *
 * Only the fields relevant to the operation are populated: `id` for get/patch/remove,
 * `data` for create/patch, `findOptions` for find.
 */
export interface EventContext<S = any> {
    /** The authenticated user, from the explicit argument or the CLS store. */
    user?: any;
    /** The service the event was dispatched from. */
    service: S;
    /** The name of the hook currently running. */
    hook?: string;
    /** The record id — get, patch and remove only. */
    id?: string | null;
    /** The query the operation ran with. */
    query?: Record<string, any>;
    /** The payload the operation ran with — create and patch only. */
    data?: any;
    /** The find options the operation ran with — find only. */
    findOptions?: { pagination?: boolean };
}

/**
 * The lifecycle hooks a service events class may implement. Every hook is optional.
 *
 * `before*` hooks run inline and are awaited: returning a value replaces the input.
 * `on*` hooks are detached — they run after the response has been sent, cannot change
 * it, and a throw is logged rather than surfaced to the caller.
 */
export interface NestServiceHooks<S = any, D = any> {
    beforeFind?(query: Record<string, any>, ctx: EventContext<S>): any;
    onFind?(result: PaginatedResponse<D> | D[], ctx: EventContext<S>): any;

    beforeGet?(query: Record<string, any>, ctx: EventContext<S>): any;
    onGet?(result: D | null, ctx: EventContext<S>): any;

    beforeCreate?(data: any, ctx: EventContext<S>): any;
    onCreate?(result: D | D[], ctx: EventContext<S>): any;

    beforePatch?(data: any, ctx: EventContext<S>): any;
    onPatch?(result: D | D[] | null, ctx: EventContext<S>): any;

    /** Return value is ignored — throw to cancel the removal. */
    beforeRemove?(id: string | null, ctx: EventContext<S>): any;
    onRemove?(result: D | D[] | null, ctx: EventContext<S>): any;

    /** Called instead of the default logger when a detached hook throws. */
    onError?(error: Error, ctx: EventContext<S>): any;
}

/**
 * The function-valued keys of a concrete events class — the set of names
 * `NestServiceBase#emit` accepts.
 */
export type EventNames<E> = Extract<
    {
        [K in keyof E]: NonNullable<E[K]> extends (...args: any[]) => any ? K : never;
    }[keyof E],
    string
>;

// Declaration merging: the interface supplies the optional hook members (a class body
// cannot declare optional methods), the class supplies the runtime members. This is the
// only way to give subclasses optional hooks without forcing them to implement all ten.
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface NestServiceEvents<S = any, D = any> extends NestServiceHooks<S, D> {}

/**
 * Base class for a `{name}.events.ts` file.
 *
 * Pair it with `@Injectable()` and `@ServiceEvents(TheService)`, and register it in the
 * feature module's `providers`.
 *
 * @typeParam S - the service this class is attached to, so `this.service` is typed
 * @typeParam D - the document/entity type, so hook payloads are typed
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- see above
export class NestServiceEvents<S = any, D = any> {
    /** The service this events class is attached to. Assigned by the registry at boot. */
    service!: S;

    protected readonly logger = new Logger(this.constructor.name);
}
