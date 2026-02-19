export declare interface PaginatedResponse<D> {
    total: number;
    $limit: number;
    $skip: number;
    data: D[];
}