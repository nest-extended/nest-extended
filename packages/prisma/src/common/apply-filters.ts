import { PrismaFilters, PrismaFilterOptions } from '../types/PrismaFilters';

/**
 * Applies filter parameters ($select, $include, $sort, $limit, $skip)
 * to a Prisma query options object.
 *
 * This is the Prisma equivalent of the Mongoose `nestify()` function.
 *
 * @param queryOptions - The Prisma findMany/findFirst options object to modify
 * @param filters - Extracted filter parameters
 * @param options - Default pagination options
 * @param isSingleOperation - If true, skip pagination (limit/skip)
 */
export function applyFilters(
    queryOptions: Record<string, any>,
    filters: PrismaFilters,
    options: PrismaFilterOptions,
    isSingleOperation: boolean = false,
): void {

    // Apply $select
    if (filters.$select) {
        if (Array.isArray(filters.$select)) {
            const selectFields = filters.$select.reduce<Record<string, boolean>>(
                (res, key) => {
                    res[key] = true;
                    return res;
                },
                {}
            );
            queryOptions['select'] = selectFields;
        } else if (typeof filters.$select === 'object') {
            queryOptions['select'] = filters.$select;
        }
    }

    // Apply $include (Prisma relations — replaces Mongoose $populate)
    if (filters.$include && options.defaultPagination) {
        // If both $select and $include are provided, Prisma doesn't allow both.
        // In that case, move included relations into $select.
        if (queryOptions['select']) {
            const include = filters.$include as Record<string, boolean | object>;
            for (const key in include) {
                if (include.hasOwnProperty(key)) {
                    queryOptions['select'][key] = include[key];
                }
            }
        } else {
            queryOptions['include'] = filters.$include;
        }
    }

    // Apply $sort → orderBy
    if (filters.$sort) {
        const sort = filters.$sort as Record<string, any>;
        // Convert to Prisma orderBy format: [{ field: 'asc' }, { field2: 'desc' }]
        const orderBy = Object.keys(sort).map(key => {
            const val = sort[key];
            const direction = val === -1 || val === '-1' || val === 'desc' ? 'desc' : 'asc';
            return { [key]: direction };
        });
        queryOptions['orderBy'] = orderBy.length === 1 ? orderBy[0] : orderBy;
    }

    // Apply pagination: $limit and $skip
    if (!isSingleOperation) {
        const limit = Number(filters.$limit) || options.defaultLimit;
        if (limit > 0) {
            queryOptions['take'] = limit;
        }

        const skip = Number(filters.$skip) || options.defaultSkip;
        if (skip > 0) {
            queryOptions['skip'] = skip;
        }
    }
}
