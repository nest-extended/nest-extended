export interface PrismaFilterOptions {
    defaultLimit: number;
    defaultSkip: number;
    defaultPagination: boolean;
}

export interface PrismaFilters {
    $select?: Record<string, boolean> | string[];
    $include?: Record<string, boolean | object>;
    $sort?: Record<string, 'asc' | 'desc'> | Record<string, number>;
    $limit?: number | string;
    $skip?: number | string;
}
