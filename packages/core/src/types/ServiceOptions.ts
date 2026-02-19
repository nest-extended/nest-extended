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
}

export type NestServiceOptions = Partial<{
    multi: boolean;
    softDelete: boolean;
    pagination: boolean;
}>;