import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as _ from 'lodash';

export const FILTERS = {
    $sort: (value: any) => convertSort(value),
    $limit: (value: any, options: any) => getLimit(parse(value), options?.paginate),
    $skip: (value: any) => parse(value),
    $select: (value: any) => value,
    $populate: (value: any) => value,
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

export const rawQuery = (query: any = {}) => {
    const rawQ: Record<string, any> = {};
    for (const key in query) {
        if (query.hasOwnProperty(key)) {
            if (key.startsWith('$')) {
                const filterKey = key.slice(1);
                if (filterKey === 'regex') {
                    const field = Object.keys(query[key])[0];
                    const regexPattern = query[key][field];
                    rawQ[field] = { $regex: new RegExp(regexPattern, 'i') };
                } else if (filterKey === 'or' && Array.isArray(query[key])) {
                    rawQ['$or'] = query[key].map((subQuery: any = {}) => rawQuery(subQuery));
                }
            } else {
                if (Types.ObjectId.isValid(String(query[key]))) {
                    rawQ[key] = new Types.ObjectId(query[key]);
                } else {
                    rawQ[key] = query[key];
                }
            }
        }
    }
    return rawQ;
};

function convertSort(sort: any) {
    if (typeof sort !== 'object' || Array.isArray(sort)) {
        return sort;
    }

    return Object.keys(sort).reduce((result: Record<string, any>, key) => {
        result[key] =
            typeof sort[key] === 'object' ? sort[key] : parseInt(sort[key], 10);

        return result;
    }, {});
}

export const OPERATORS = [
    '$in',
    '$nin',
    '$lt',
    '$lte',
    '$gt',
    '$gte',
    '$ne',
    '$or',
];

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