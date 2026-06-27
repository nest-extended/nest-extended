import { BadRequestException } from '@nestjs/common';
import * as _ from 'lodash';
import {
    And,
    Equal,
    ILike,
    In,
    LessThan,
    LessThanOrEqual,
    Like,
    MoreThan,
    MoreThanOrEqual,
    Not,
} from 'typeorm';

export const FILTERS = {
    $sort: (value: any) => convertSort(value),
    $limit: (value: any, options: any) => getLimit(parse(value), options?.paginate),
    $skip: (value: any) => parse(value),
    $select: (value: any) => convertSelect(value),
    $include: (value: any) => convertInclude(value),
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
 * Converts $select to TypeORM select format.
 * Accepts: string[], Record<string, 1 | 0>, or string
 * Returns: Record<string, boolean> for TypeORM
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
 * Converts $include (TypeORM relations — the analogue of Prisma's $include /
 * Mongoose's $populate) to a TypeORM `relations` object.
 * Accepts: string[], Record<string, boolean>, or string.
 */
function convertInclude(value: any): Record<string, boolean> | undefined {
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
 * Converts sort object from FeathersJS format (1/-1) to TypeORM format (ASC/DESC).
 * Input: { createdAt: -1, name: 1 }
 * Output: { createdAt: 'DESC', name: 'ASC' }
 */
function convertSort(sort: any): Record<string, 'ASC' | 'DESC'> | undefined {
    if (!sort || typeof sort !== 'object' || Array.isArray(sort)) {
        return undefined;
    }

    return Object.keys(sort).reduce((result: Record<string, 'ASC' | 'DESC'>, key) => {
        const raw = sort[key];
        const val = typeof raw === 'string' && (raw.toLowerCase() === 'desc' || raw.toLowerCase() === 'asc')
            ? (raw.toLowerCase() === 'desc' ? -1 : 1)
            : parseInt(raw, 10);
        result[key] = val === -1 ? 'DESC' : 'ASC';
        return result;
    }, {});
}

/**
 * Valid TypeORM query operators (FeathersJS-style).
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
 * Converts a single operator expression to a TypeORM FindOperator (or raw value).
 */
function convertOperator(key: string, value: any): any {
    switch (key) {
        case '$eq':
            return Equal(value);
        case '$ne':
            return Not(value);
        case '$gt':
            return MoreThan(value);
        case '$gte':
            return MoreThanOrEqual(value);
        case '$lt':
            return LessThan(value);
        case '$lte':
            return LessThanOrEqual(value);
        case '$in':
            return In(Array.isArray(value) ? value : [value]);
        case '$nin':
            return Not(In(Array.isArray(value) ? value : [value]));
        case '$like':
            return Like(`%${value}%`);
        case '$notLike':
            return Not(Like(`%${value}%`));
        case '$iLike':
            return ILike(`%${value}%`);
        case '$notILike':
            return Not(ILike(`%${value}%`));
        default:
            return value;
    }
}

/**
 * Convert a single field's value to a TypeORM where condition. Handles:
 *  - plain value → equality
 *  - operator object `{ $gt: 5, $lt: 10 }` → `And(MoreThan(5), LessThan(10))`
 *  - nested object (relation filter) → recursively converted object
 */
function convertField(value: any): any {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return value;
    }

    const operatorKeys = Object.keys(value).filter((k) => k.startsWith('$'));

    if (operatorKeys.length > 0) {
        const operators = operatorKeys.map((opKey) => convertOperator(opKey, value[opKey]));
        return operators.length === 1 ? operators[0] : And(...operators);
    }

    // Nested object without operators → relation/embedded where, convert recursively.
    const nested: Record<string, any> = {};
    for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            nested[key] = convertField(value[key]);
        }
    }
    return nested;
}

/**
 * AND of two DNF clause sets (cartesian product, merging objects).
 */
function combineAnd(a: Record<string, any>[], b: Record<string, any>[]): Record<string, any>[] {
    const out: Record<string, any>[] = [];
    for (const clauseA of a) {
        for (const clauseB of b) {
            out.push({ ...clauseA, ...clauseB });
        }
    }
    return out;
}

/**
 * Build a disjunctive-normal-form list of AND-clauses for a query object.
 * A single clause means no OR; multiple clauses are OR-ed together. This is how
 * TypeORM expresses OR in the find-options API: `where: [clauseA, clauseB]`.
 */
function buildClauses(query: any): Record<string, any>[] {
    let acc: Record<string, any>[] = [{}];
    const base: Record<string, any> = {};

    for (const key in query) {
        if (!Object.prototype.hasOwnProperty.call(query, key)) continue;

        if (key === '$or' && Array.isArray(query[key])) {
            let orClauses: Record<string, any>[] = [];
            for (const sub of query[key]) {
                orClauses = orClauses.concat(buildClauses(sub));
            }
            if (orClauses.length > 0) {
                acc = combineAnd(acc, orClauses);
            }
        } else if (key === '$and' && Array.isArray(query[key])) {
            for (const sub of query[key]) {
                acc = combineAnd(acc, buildClauses(sub));
            }
        } else if (key.startsWith('$')) {
            // Filter keys ($sort/$limit/etc.) handled separately.
            continue;
        } else {
            base[key] = convertField(query[key]);
        }
    }

    return combineAnd(acc, [base]);
}

/**
 * Converts a FeathersJS-style query object to a TypeORM `where` clause.
 * Returns a single object (AND) or an array of objects (OR).
 *
 * Examples:
 *   rawQuery({ name: 'John' })              → { name: 'John' }
 *   rawQuery({ age: { $gt: 18 } })          → { age: MoreThan(18) }
 *   rawQuery({ $or: [{ a: 1 }, { b: 2 }] }) → [{ a: 1 }, { b: 2 }]
 *   rawQuery({ name: { $like: 'Jo' } })     → { name: Like('%Jo%') }
 */
export const rawQuery = (query: any = {}): Record<string, any> | Record<string, any>[] => {
    const clauses = buildClauses(query);
    return clauses.length === 1 ? clauses[0] : clauses;
};

export const filterQuery = (query: any, options: any = {}) => {
    const {
        filters: additionalFilters = {},
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
