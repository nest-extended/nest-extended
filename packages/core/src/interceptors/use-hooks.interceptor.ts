import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
    Type,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import {
    ControllerContext,
    EventHandler,
    USE_AFTER,
    USE_BEFORE,
    UseHandler,
} from '@nest-extended/decorators';
import { from, Observable } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';

/**
 * Runs the handlers registered by `@UseBefore` and `@UseAfter`.
 *
 * Registered globally by `NestExtendedModule.forRoot()`; routes without either decorator
 * pay only two reflector lookups.
 */
@Injectable()
export class UseHooksInterceptor implements NestInterceptor {
    private readonly logger = new Logger('NestExtendedHooks');

    constructor(
        private readonly reflector: Reflector,
        private readonly moduleRef: ModuleRef,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        if (context.getType() !== 'http') return next.handle();

        const before = this.collect(USE_BEFORE, context);
        const after = this.collect(USE_AFTER, context);
        if (!before.length && !after.length) return next.handle();

        const ctx = this.buildContext(context);

        // `before` handlers are awaited so they can reshape the request.
        const handled$ = before.length
            ? from(this.runAll(before, ctx)).pipe(mergeMap(() => next.handle()))
            : next.handle();

        if (!after.length) return handled$;

        // `after` handlers are detached, matching the `on*` service hook contract:
        // they cannot alter the response and a throw never reaches the client.
        // Each runs independently so one bad handler cannot swallow the rest.
        return handled$.pipe(
            tap((result) => {
                setImmediate(() => {
                    void this.runDetached(after, { ...ctx, result });
                });
            }),
        );
    }

    /** Class-level handlers run before method-level ones. */
    private collect(key: string, context: ExecutionContext): UseHandler[] {
        const fromClass = this.reflector.get<UseHandler[]>(key, context.getClass()) ?? [];
        const fromHandler = this.reflector.get<UseHandler[]>(key, context.getHandler()) ?? [];
        return [...fromClass, ...fromHandler];
    }

    private buildContext(context: ExecutionContext): ControllerContext {
        const http = context.switchToHttp();
        const request = http.getRequest();
        return {
            request,
            response: http.getResponse(),
            user: request.user,
            params: request.params ?? {},
            query: request.query ?? {},
            body: request.body,
            handler: context.getHandler() as (...args: any[]) => any,
            controller: context.getClass(),
        };
    }

    /** Runs handlers in order, stopping at the first failure. Used for `before`. */
    private async runAll(handlers: UseHandler[], ctx: ControllerContext): Promise<void> {
        for (const handler of handlers) {
            await this.invoke(handler, ctx);
        }
    }

    /** Runs handlers in order, reporting failures without stopping. Used for `after`. */
    private async runDetached(handlers: UseHandler[], ctx: ControllerContext): Promise<void> {
        for (const handler of handlers) {
            try {
                await this.invoke(handler, ctx);
            } catch (err) {
                const error = err as Error;
                this.logger.error(
                    `@UseAfter handler on ${ctx.controller.name}.${ctx.handler.name} failed: ${error.message}`,
                    error.stack,
                );
            }
        }
    }

    private async invoke(handler: UseHandler, ctx: ControllerContext): Promise<void> {
        if (this.isHandlerClass(handler)) {
            await this.resolve(handler).handle(ctx);
            return;
        }
        await (handler as (ctx: ControllerContext) => any)(ctx);
    }

    private resolve(handler: Type<EventHandler>): EventHandler {
        try {
            return this.moduleRef.get<EventHandler>(handler, { strict: false });
        } catch {
            throw new Error(
                `${handler.name} is not registered in the DI container — ` +
                    `add it to the providers of the module that uses it.`,
            );
        }
    }

    /**
     * An `EventHandler` class carries `handle` on its prototype; an inline arrow
     * function has no prototype at all.
     */
    private isHandlerClass(handler: UseHandler): handler is Type<EventHandler> {
        const proto = (handler as Type<EventHandler>).prototype;
        return typeof proto?.handle === 'function';
    }
}
