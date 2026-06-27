export interface TypeOrmFilterOptions {
    defaultLimit: number;
    defaultSkip: number;
    defaultPagination: boolean;
}

export interface TypeOrmFilters {
    $select?: Record<string, boolean> | string[];
    $include?: Record<string, boolean | object> | string[];
    $sort?: Record<string, 'ASC' | 'DESC'> | Record<string, number>;
    $limit?: number | string;
    $skip?: number | string;
}
