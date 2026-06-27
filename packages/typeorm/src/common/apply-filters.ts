import { TypeOrmFilters, TypeOrmFilterOptions } from '../types/TypeOrmFilters';

/**
 * Applies filter parameters ($select, $include, $sort, $limit, $skip)
 * to a TypeORM find-options object (find / findAndCount / findOne).
 *
 * This is the TypeORM equivalent of the Prisma `applyFilters` /
 * Mongoose `nestify` helpers.
 *
 * @param findOptions - The TypeORM find-options object to modify
 * @param filters - Extracted filter parameters
 * @param options - Default pagination options
 * @param isSingleOperation - If true, skip pagination (take/skip)
 */
export function applyFilters(
    findOptions: Record<string, any>,
    filters: TypeOrmFilters,
    options: TypeOrmFilterOptions,
    isSingleOperation = false,
): void {

    // Apply $select → TypeORM `select`
    if (filters.$select) {
        if (Array.isArray(filters.$select)) {
            findOptions['select'] = filters.$select.reduce<Record<string, boolean>>(
                (res, key) => {
                    res[key] = true;
                    return res;
                },
                {},
            );
        } else if (typeof filters.$select === 'object') {
            findOptions['select'] = filters.$select;
        }
    }

    // Apply $include → TypeORM `relations` (eager-load related entities).
    if (filters.$include) {
        findOptions['relations'] = filters.$include;
    }

    // Apply $sort → TypeORM `order` ({ field: 'ASC' | 'DESC' })
    if (filters.$sort) {
        const sort = filters.$sort as Record<string, any>;
        const order: Record<string, 'ASC' | 'DESC'> = {};
        for (const key in sort) {
            if (Object.prototype.hasOwnProperty.call(sort, key)) {
                const val = sort[key];
                order[key] =
                    val === -1 || val === '-1' || val === 'desc' || val === 'DESC'
                        ? 'DESC'
                        : 'ASC';
            }
        }
        findOptions['order'] = order;
    }

    // Apply pagination: $limit → take, $skip → skip
    if (!isSingleOperation) {
        const limit = Number(filters.$limit) || options.defaultLimit;
        if (limit > 0) {
            findOptions['take'] = limit;
        }

        const skip = Number(filters.$skip) || options.defaultSkip;
        if (skip > 0) {
            findOptions['skip'] = skip;
        }
    }
}
