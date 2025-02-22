
export function nestify(
  // @ts-ignore
  q,
  filters: Record<string, any>,
  options: {
    defaultLimit: number;
    defaultSkip: number;
    defaultPagination: boolean;
  },
  isSingleOperation = false,
  isPaginationDisabled = false,
) {
  // $select
  if (Array.isArray(filters.$select)) {
    q.select(filters.$select.reduce((res, key) => ({ ...res, [key]: 1 }), {}));
  } else if (
    typeof filters.$select === 'string' ||
    typeof filters.$select === 'object'
  ) {
    q.select(filters.$select);
  }

  // $populate
  if (filters.$populate && options.defaultPagination) {
    q.populate(filters.$populate);
  }

  if (!isPaginationDisabled && !isSingleOperation) {
    // $sort
    if (filters.$sort) {
      q.sort(filters.$sort);
    }

    // $limit
    const limit = Number(filters.$limit) || options.defaultLimit;
    if (limit > 0) {
      q.limit(limit);
    }

    // $skip
    const skip = Number(filters.$skip) || options.defaultSkip;
    if (skip > 0) {
      q.skip(skip);
    }
  }
}
