import { Document, Query } from 'mongoose';

export function nestify<
  T extends Document,
  Q extends Query<any, T, any> = Query<any, T, any>
>(
  q: Q,
  filters: NestifyFilters,
  options: NestifyOptions,
  isSingleOperation: boolean = false,
  isPaginationDisabled: boolean = false
): void {

  if (Array.isArray(filters.$select)) {
    const selectFields = filters.$select.reduce<Record<string, 1>>(
      (res, key) => {
        res[key] = 1;
        return res;
      },
      {}
    );
    q.select(selectFields);
  } else if (typeof filters.$select === 'string' || typeof filters.$select === 'object') {
    q.select(filters.$select);
  }

  if (filters.$populate && options.defaultPagination) {
    q.populate(filters.$populate);
  }

  if (filters.$sort) {
    q.sort(filters.$sort);
  }
  
  if (!isPaginationDisabled && !isSingleOperation) {

    const limit = Number(filters.$limit) || options.defaultLimit;
    if (limit > 0) {
      q.limit(limit);
    }

    const skip = Number(filters.$skip) || options.defaultSkip;
    if (skip > 0) {
      q.skip(skip);
    }
  }
}
