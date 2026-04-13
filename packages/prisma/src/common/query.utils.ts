import { BadRequestException } from '@nestjs/common';
import * as _ from 'lodash';

export const FILTERS = {
    $sort: (value: any) => convertSort(value),
    $limit: (value: any, options: any) => getLimit(parse(value), options?.paginate),
    $skip: (value: any) => parse(value),
    $select: (value: any) => convertSelect(value),
    $include: (value: any) => value,
};

export function parse(number?: any) {
    if (typeof number !== 'undefined') {
        return Math.abs(parseInt(number, 10));
    }

    return undefined;
}

function getLimit(limit: any, paginate: any) {
    if (paginate && paginate.default) {
        const lower =
            typeof limit === 'number' && !isNaN(limit) ? limit : paginate.default;
        const upper =
            typeof paginate.max === 'number' ? paginate.max : Number.MAX_VALUE;

        return Math.min(lower, upper);
    }

    return limit;
}

/**
 * Converts $select to Prisma select format.
 * Accepts: string[], Record<string, 1 | 0>, or string
 * Returns: Record<string, boolean> for Prisma
 */
function convertSelect(value: any): Record<string, boolean> | undefined {
    if (!value) return undefined;

    if (Array.isArray(value)) {
        return value.reduce((acc: Record<string, boolean>, key: string) => {
            acc[key] = true;
            return acc;
        }, {});
    }

    if (typeof value === 'string') {
        return value
            .split(/[\s,]+/)
            .filter(Boolean)
            .reduce((acc: Record<string, boolean>, key: string) => {
                acc[key] = true;
                return acc;
            }, {});
    }

    if (typeof value === 'object') {
        return Object.keys(value).reduce((acc: Record<string, boolean>, key: string) => {
            acc[key] = Boolean(value[key]);
            return acc;
        }, {});
    }

    return undefined;
}

/**
 * Converts sort object from FeathersJS format (1/-1) to Prisma format (asc/desc).
 * Input: { createdAt: -1, name: 1 }
 * Output: { createdAt: 'desc', name: 'asc' }
 */
function convertSort(sort: any): Record<string, 'asc' | 'desc'> | undefined {
    if (!sort || typeof sort !== 'object' || Array.isArray(sort)) {
        return undefined;
    }

    return Object.keys(sort).reduce((result: Record<string, 'asc' | 'desc'>, key) => {
        const val = parseInt(sort[key], 10);
        result[key] = val === -1 ? 'desc' : 'asc';
        return result;
    }, {});
}

/**
 * Valid Prisma query operators (FeathersJS-style).
 */
export const OPERATORS = [
    '$eq',
    '$ne',
    '$gte',
    '$gt',
    '$lte',
    '$lt',
    '$in',
    '$nin',
    '$like',
    '$notLike',
    '$iLike',
    '$notILike',
    '$or',
    '$and',
];

/**
 * Converts a single operator expression to Prisma where clause.
 */
function convertOperator(key: string, value: any): any {
    switch (key) {
        case '$eq':
            return value;
        case '$ne':
            return { not: value };
        case '$gt':
            return { gt: value };
        case '$gte':
            return { gte: value };
        case '$lt':
            return { lt: value };
        case '$lte':
            return { lte: value };
        case '$in':
            return { in: Array.isArray(value) ? value : [value] };
        case '$nin':
            return { notIn: Array.isArray(value) ? value : [value] };
        case '$like':
            return { contains: value };
        case '$notLike':
            return { not: { contains: value } };
        case '$iLike':
            return { contains: value, mode: 'insensitive' };
        case '$notILike':
            return { not: { contains: value, mode: 'insensitive' } };
        default:
            return value;
    }
}

/**
 * Converts a FeathersJS-style query object to a Prisma `where` clause.
 *
 * Examples:
 *   rawQuery({ name: 'John' })
 *   → { name: 'John' }
 *
 *   rawQuery({ age: { $gt: 18 } })
 *   → { age: { gt: 18 } }
 *
 *   rawQuery({ $or: [{ name: 'John' }, { name: 'Jane' }] })
 *   → { OR: [{ name: 'John' }, { name: 'Jane' }] }
 *
 *   rawQuery({ name: { $like: 'John' } })
 *   → { name: { contains: 'John' } }
 *
 *   rawQuery({ name: { $iLike: 'john' } })
 *   → { name: { contains: 'john', mode: 'insensitive' } }
 */
export const rawQuery = (query: any = {}): Record<string, any> => {
    const where: Record<string, any> = {};

    for (const key in query) {
        if (!query.hasOwnProperty(key)) continue;

        if (key === '$or' && Array.isArray(query[key])) {
            where['OR'] = query[key].map((subQuery: any) => rawQuery(subQuery));
        } else if (key === '$and' && Array.isArray(query[key])) {
            where['AND'] = query[key].map((subQuery: any) => rawQuery(subQuery));
        } else if (key.startsWith('$')) {
            // Skip filter keys — they are handled separately
            continue;
        } else if (typeof query[key] === 'object' && query[key] !== null && !Array.isArray(query[key])) {
            // Field-level operators: { age: { $gt: 18, $lt: 65 } }
            const fieldConditions: Record<string, any> = {};
            let hasOperators = false;

            for (const opKey in query[key]) {
                if (opKey.startsWith('$')) {
                    hasOperators = true;
                    const converted = convertOperator(opKey, query[key][opKey]);

                    if (typeof converted === 'object' && converted !== null && !Array.isArray(converted)) {
                        // Merge operator result into field conditions
                        // Handle $notLike / $notILike which produce { not: { contains: ... } }
                        Object.assign(fieldConditions, converted);
                    } else {
                        // Simple value replacement (e.g., $eq returns raw value)
                        where[key] = converted;
                    }
                }
            }

            if (hasOperators && Object.keys(fieldConditions).length > 0) {
                where[key] = fieldConditions;
            } else if (!hasOperators) {
                // Plain nested object (not operators)
                where[key] = query[key];
            }
        } else {
            // Direct equality
            where[key] = query[key];
        }
    }

    return where;
};

export const filterQuery = (query: any, options: any = {}) => {
    const {
        // @ts-ignore
        filters: additionalFilters = {},
        // @ts-ignore
        operators: additionalOperators = [],
    } = options;

    const result = {
        filters: {},
        query: {},
    };

    result.filters = assignFilters({}, query, FILTERS, options);
    result.filters = assignFilters(
        result.filters,
        query,
        additionalFilters,
        options,
    );
    result.query = cleanQuery(
        query,
        OPERATORS.concat(additionalOperators),
        result.filters,
    );

    return result;
};

export const assignFilters = (object: any, query: any, filters: any, options: any) => {
    if (Array.isArray(filters)) {
        _.forEach(filters, (key) => {
            if (query[key] !== undefined) {
                object[key] = query[key];
            }
        });
    } else {
        _.forEach(filters, (converter, key) => {
            const converted = converter(query[key], options);
            if (converted !== undefined) {
                object[key] = converted;
            }
        });
    }
    return object;
};

export const cleanQuery = (query: any, operators: any, filters: any): any => {
    if (Array.isArray(query)) {
        return query.map((value) => cleanQuery(value, operators, filters));
    } else if (_.isPlainObject(query)) {
        const result: Record<string | symbol, any> = {};

        _.forEach(query, (value: any, key: any) => {
            if (key.startsWith('$')) {
                if (filters[key] === undefined && !operators.includes(key)) {
                    throw new BadRequestException(
                        `Invalid query parameter: ${key}`,
                        query,
                    );
                }
            }
            result[key] = cleanQuery(value, operators, filters);
        });

        Object.getOwnPropertySymbols(query).forEach((symbol) => {
            result[symbol] = query[symbol];
        });

        return result;
    }

    return query;
};
