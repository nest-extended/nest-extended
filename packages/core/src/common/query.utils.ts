import { BadRequestException, HttpExceptionOptions} from '@nestjs/common';
import {Types} from 'mongoose';
import _ from 'lodash';

export const FILTERS = {
  $sort: (value: any) => convertSort(value),
  $limit: (value: any, options: { paginate: any; }) => getLimit(parse(value), options?.paginate),
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

function getLimit(limit: number | undefined, paginate: { default: any; max: any; }) {
  if (paginate && paginate.default) {
    const lower =
        typeof limit === 'number' && !isNaN(limit) ? limit : paginate.default;
    const upper =
        typeof paginate.max === 'number' ? paginate.max : Number.MAX_VALUE;

    return Math.min(lower, upper);
  }

  return limit;
}

export const rawQuery = (query: Record<string, any>) => {
  const rawQ = {};
  for (const key in query) {
    // @ts-ignore
    if (query.hasOwnProperty(key)) {
      if (key.startsWith('$')) {
        const filterKey = key.slice(1);
        if (filterKey === 'regex') {
          const field = Object.keys(query[key])[0];
          const regexPattern = query[key][field];
          // @ts-ignore
          rawQ[field] = {$regex: new RegExp(regexPattern, 'i')};
        } else if (filterKey === 'or' && Array.isArray(query[key])) {
          // @ts-ignore
          rawQ['$or'] = query[key].map((subQuery) => rawQuery(subQuery));
        }
      } else {
        if (Types.ObjectId.isValid(String(query[key]))) {
          // @ts-ignore
          rawQ[key] = new Types.ObjectId(query[key]);
        } else {
          // @ts-ignore
          rawQ[key] = query[key];
        }
      }
    }
  }
  return rawQ;
};

function convertSort(sort: { [x: string]: string; }) {
  if (typeof sort !== 'object' || Array.isArray(sort)) {
    return sort;
  }

  return Object.keys(sort).reduce((result, key) => {
    // @ts-ignore
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

export const filterQuery = (query: any, options = {}) => {
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

  // @ts-ignore
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

export const assignFilters = (object: {
  [x: string]: any;
  // @ts-ignore
}, query: Record<string, any>, filters: any[], options: {}) => {
  if (Array.isArray(filters)) {
    // @ts-ignore
    _.forEach(filters, (key) => {
      if (query[key] !== undefined) {
        object[key] = query[key];
      }
    });
  } else {
    // @ts-ignore
    _.forEach(filters, (converter, key) => {
      // @ts-ignore
      const converted = converter(query[key], options);
      if (converted !== undefined) {
        object[key] = converted;
      }
    });
  }
  return object;
};

// @ts-ignore
export const cleanQuery = (query: string | any[] | HttpExceptionOptions | undefined, operators: string | string[], filters: { [x: string]: undefined; }) => {
  if (Array.isArray(query)) {
    // @ts-ignore
    return query.map((value) => cleanQuery(value, operators, filters));
  } else if (_.isPlainObject(query)) {
    const result = {};

    // @ts-ignore
    _.forEach(query, (value, key) => {
      // @ts-ignore
      if (key.startsWith('$')) {
        // @ts-ignore
        if (filters[key] === undefined && !operators.includes(key)) {
          throw new BadRequestException(
            `Invalid query parameter: ${key}`,
            query,
          );
        }
      }
      // @ts-ignore
      result[key] = cleanQuery(value, operators, filters);
    });

    Object.getOwnPropertySymbols(query).forEach((symbol) => {
      // @ts-ignore
      result[symbol] = query[symbol];
    });

    return result;
  }

  return query;
};
