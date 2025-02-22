export interface ServiceOptions<T> {
    _find: (query: Record<string, any>) => Promise<any>;
    _get: (id: string, query: Record<string, any>) => Promise<any>;
    _create: (dto: T) => Promise<any>;
    _patch: (id: string, dto: Partial<T>, query: Record<string, any>) => Promise<any>;
    _remove: (id: string, query: Record<string, any>, user: any) => Promise<any>;
}

export type NestServiceOptions = {
    multi: boolean;
    softDelete: boolean;
};
