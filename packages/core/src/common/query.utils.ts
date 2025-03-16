import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import _ from 'lodash';

export const FILTERS: Record<string, (value: any, options?: any) => any> = {
  $sort: (value: any) => convertSort(value),
  $limit: (value: any, options: { paginate: { default: number; max: number } }) => getLimit(parse(value), options.paginate),
  $skip: (value: any) => parse(value),
  $select: (value: any) => value,
  $populate: (value: any) => value,
};

export function parse(number?: any): number | undefined {
  if (typeof number !== 'undefined') {
    return Math.abs(parseInt(number, 10));
  }
  return undefined;
}

function getLimit(limit: number | undefined, paginate: { default: number; max: number }): number {
  if (paginate?.default) {
    const lower = typeof limit === 'number' && !isNaN(limit) ? limit : paginate.default;
    const upper = typeof paginate.max === 'number' ? paginate.max : Number.MAX_VALUE;
    return Math.min(lower, upper);
  }
  return limit ?? 0;
}

export const rawQuery = (query: Record<string, any>): Record<string, any> => {
  const rawQ: Record<string, any> = {};
  for (const key in query) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      if (key.startsWith('$')) {
        const filterKey = key.slice(1);
        if (filterKey === 'regex') {
          const field = Object.keys(query[key])[0];
          const regexPattern = query[key][field];
          rawQ[field] = { $regex: new RegExp(regexPattern, 'i') };
        } else if (filterKey === 'or' && Array.isArray(query[key])) {
          rawQ['$or'] = query[key].map((subQuery: any) => rawQuery(subQuery));
        }
      } else {
        rawQ[key] = Types.ObjectId.isValid(String(query[key])) ? new Types.ObjectId(query[key]) : query[key];
      }
    }
  }
  return rawQ;
};

function convertSort(sort: Record<string, string | number>): Record<string, number> {
  if (typeof sort !== 'object' || Array.isArray(sort)) {
    return sort as Record<string, number>;
  }
  return Object.keys(sort).reduce<Record<string, number>>((result, key) => {
    result[key] = typeof sort[key] === 'object' ? (sort[key] as number) : parseInt(sort[key] as string, 10);
    return result;
  }, {});
}

export const OPERATORS = ['$in', '$nin', '$lt', '$lte', '$gt', '$gte', '$ne', '$or'];

export const filterQuery = (
    query: Record<string, any>,
    options: { filters?: Record<string, (value: any, options?: any) => any>; operators?: string[] } = {}
) => {
  const additionalFilters = options.filters ?? {};
  const additionalOperators = options.operators ?? [];

  const result = {
    filters: assignFilters({}, query, FILTERS, options),
    query: {} as Record<string, any>,
  };

  result.filters = assignFilters(result.filters, query, additionalFilters, options);
  result.query = cleanQuery(query, [...OPERATORS, ...additionalOperators], result.filters);

  return result;
};

export const assignFilters = (
    object: Record<string, any>,
    query: Record<string, any>,
    filters: Record<string, (value: any, options?: any) => any> | string[],
    options: any
): Record<string, any> => {
  if (Array.isArray(filters)) {
    filters.forEach((key) => {
      if (query[key] !== undefined) {
        object[key] = query[key];
      }
    });
  } else {
    Object.entries(filters).forEach(([key, converter]) => {
      const converted = converter(query[key], options);
      if (converted !== undefined) {
        object[key] = converted;
      }
    });
  }
  return object;
};

export const cleanQuery = (
    query: any,
    operators: string[],
    filters: Record<string, any>
): any => {
  if (Array.isArray(query)) {
    return query.map((value) => cleanQuery(value, operators, filters));
  } else if (_.isPlainObject(query)) {
    const result: Record<string, any> = {};
    Object.entries(query).forEach(([key, value]) => {
      if (key.startsWith('$') && filters[key] === undefined && !operators.includes(key)) {
        throw new BadRequestException(`Invalid query parameter: ${key}`);
      }
      result[key] = cleanQuery(value, operators, filters);
    });
    return result;
  }
  return query;
};
