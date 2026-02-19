import { PopulateOptions, SortOrder } from 'mongoose';

export interface NestifyOptions {
    defaultLimit: number;
    defaultSkip: number;
    defaultPagination: boolean;
}

export interface NestifyFilters {
    $select?: string | Record<string, 1 | 0> | string[];
    $populate?: string | PopulateOptions | (string | PopulateOptions)[];
    $sort?: Record<string, SortOrder>;
    $limit?: number | string;
    $skip?: number | string;
}