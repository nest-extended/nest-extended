import { SetMetadata, Type } from '@nestjs/common';

/** Metadata key holding the handlers registered with `@UseBefore`. */
export const USE_BEFORE = 'nest-extended:use-before';
/** Metadata key holding the handlers registered with `@UseAfter`. */
export const USE_AFTER = 'nest-extended:use-after';

/** The context handed to every `@UseBefore` / `@UseAfter` handler. */
export interface ControllerContext<TBody = any, TResult = any> {
    request: any;
    response: any;
    /** The authenticated user, if the request carries one. */
    user?: any;
    params: Record<string, any>;
    query: Record<string, any>;
    /** Mutate this in a `@UseBefore` handler to reshape the request payload. */
    body: TBody;
    /** The handler's return value. Populated for `@UseAfter` only. */
    result?: TResult;
    /** The route handler the hooks are attached to. */
    handler: (...args: any[]) => any;
    /** The controller class the route belongs to. */
    controller: Type<any>;
}

/** Implement this on a provider to use it as a `@UseBefore` / `@UseAfter` handler. */
export interface EventHandler<TBody = any, TResult = any> {
    handle(ctx: ControllerContext<TBody, TResult>): any;
}

/** Either an inline function or an injectable class implementing `EventHandler`. */
export type UseHandler = ((ctx: ControllerContext) => any) | Type<EventHandler>;

/**
 * Runs handlers before the route handler. Awaited — mutate `ctx.body` or `ctx.query`
 * to reshape the request.
 *
 * Valid on a method or on a whole controller class; class-level handlers run first.
 *
 * ```ts
 * @UseBefore((ctx) => { ctx.body.slug = slugify(ctx.body.name); })
 * @UseBefore(ValidateCompanyHandler)
 * ```
 */
export const UseBefore = (...handlers: UseHandler[]) => SetMetadata(USE_BEFORE, handlers);

/**
 * Runs handlers after the route handler returns. Detached — they cannot change the
 * response and a throw is logged rather than surfaced to the client.
 *
 * Valid on a method or on a whole controller class; class-level handlers run first.
 *
 * ```ts
 * @UseAfter(NotifyHandler, (ctx) => logger.log(ctx.result))
 * ```
 */
export const UseAfter = (...handlers: UseHandler[]) => SetMetadata(USE_AFTER, handlers);
