interface NestifyOptions {
    defaultLimit: number;
    defaultSkip: number;
    defaultPagination: boolean;
}

interface NestifyFilters {
    $select?: string | Record<string, 1 | 0> | string[];
    $populate?: string | PopulateOptions | (string | PopulateOptions)[];
    $sort?: Record<string, SortOrder>;
    $limit?: number | string;
    $skip?: number | string;
}