export interface ServiceOptions<T> {
    _find(query: Record<string, any>, findOptions?: any): Promise<any>;
    _get(id: string, query: Record<string, any>, getOptions?: any): Promise<any>;
    _create(data: Partial<T>, needsMulti?: boolean): Promise<any>;
    _patch(
        id: string | null,
        data: Partial<T>,
        query: Record<string, any>,
        patchOptions?: any,
    ): Promise<any>;
    _remove(
        id: string | null,
        query: Record<string, any>,
        removeOptions?: any,
    ): Promise<any>;

    // Event-firing counterparts. Optional so that a hand-rolled service implementing
    // only the underscore contract still satisfies this interface.
    find?(query: Record<string, any>, findOptions?: any): Promise<any>;
    get?(id: string, query: Record<string, any>, getOptions?: any): Promise<any>;
    create?(data: Partial<T>, needsMulti?: boolean): Promise<any>;
    patch?(
        id: string | null,
        data: Partial<T>,
        query: Record<string, any>,
        patchOptions?: any,
    ): Promise<any>;
    remove?(
        id: string | null,
        query: Record<string, any>,
        removeOptions?: any,
    ): Promise<any>;
}

export type NestServiceOptions = Partial<{
    multi: boolean;
    softDelete: boolean;
    pagination: boolean;
    /** Dispatch lifecycle events to the attached events class. Defaults to true. */
    events: boolean;
    /**
     * Prefix for globally broadcast events, e.g. 'company' emits `company.create`.
     * Requires `@nestjs/event-emitter` to be installed and registered. Defaults to false.
     */
    broadcast: string | false;
}>;
