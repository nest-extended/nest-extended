/**
 * Holder for the optional `@nestjs/event-emitter` bus.
 *
 * `@nestjs/event-emitter` is never a dependency of this package. The registry resolves
 * it at boot if the host app happens to have it installed and registered; otherwise the
 * bus stays undefined and `broadcast` is silently a no-op.
 */
export interface EventBus {
    emit(event: string, payload: any): unknown;
}

let bus: EventBus | undefined;

export const setEventBus = (next?: EventBus): void => {
    bus = next;
};

export const getEventBus = (): EventBus | undefined => bus;
