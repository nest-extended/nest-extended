import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { PaginatedResponse } from '../types/PaginatedResponse';
import { BadRequestException } from '@nestjs/common';
import { assignFilters, FILTERS, rawQuery } from '../common/query.utils';
import options from '../common/options';
import { nestify } from 'src/common/nestify';
import { NestServiceOptions } from 'src/types/ServiceOptions';

export class NestService<M, D> {
  private model: Model<M>;
  private options: NestServiceOptions;
  constructor(model: Model<M>, options?: NestServiceOptions) {
    this.model = model;
    this.options = options || {
      multi: false,
      softDelete: false,
    };
  }

  async _find(
    query: Record<string, any> = {},
    findOptions = {
      handleSoftDelete: true,
    },
  ): Promise<PaginatedResponse<D> | D[]> {
    if (!findOptions.handleSoftDelete) {
      throw new BadRequestException(
        'findOptions.handleSoftDelete not provided in _find.',
      );
    }
    query[options.deleteKey || 'deleted'] = {
      $ne: true,
    };

    const filters = assignFilters({}, query, FILTERS, {});
    const searchQuery = rawQuery(query);
    const isPaginationDisabled =
      query.$paginate === false || query.$paginate === 'false';

    const q = this.model.find(searchQuery);
    nestify(q, filters, options, isPaginationDisabled);
    if (isPaginationDisabled) {
      return (await q.exec()) as D[];
    }

    const [data, total] = await Promise.all([
      q.exec(),
      this.model.countDocuments({
        [options.deleteKey || 'deleted']: { $ne: true },
        ...searchQuery,
      }),
    ]);

    return {
      total,
      $limit: Number(filters.$limit) || options.defaultLimit,
      $skip: Number(filters.$skip) || options.defaultSkip,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      data,
    };
  }

  async _create(
    data: Partial<D>,
    needsMulti: boolean | undefined = undefined,
  ): Promise<D | D[]> {
    const multi = needsMulti !== undefined ? needsMulti : options.multi;

    if (multi) {
      if (!Array.isArray(data)) {
        throw new BadRequestException(
          'Bulk creation requires an array of kvps.',
        );
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return this.model.insertMany(data, { ordered: false });
    }
    if (Array.isArray(data)) {
      throw new BadRequestException(
        'Single creation expects a single user object, not an array.',
      );
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return this.model.create(data);
  }

  async _patch(
    id: string | null,
    data: Record<any, any>,
    query: Record<string, any> = {},
    patchOptions = {
      handleSoftDelete: true,
    },
  ): Promise<D | D[] | null> {
    if (!patchOptions.handleSoftDelete) {
      throw new BadRequestException(
        'patchOptions.handleSoftDelete not provided in _patch.',
      );
    }
    query[options.deleteKey || 'deleted'] = {
      $ne: true,
    };

    const filters = assignFilters({}, query, FILTERS, {});
    const searchQuery: FilterQuery<D> = id
      ? { _id: id, ...rawQuery(query) }
      : rawQuery(query);

    const isSingleUpdate = Boolean(id);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const q = this._getOrFind(isSingleUpdate, searchQuery, data);

    if (isSingleUpdate) {
      nestify(q, filters, options, isSingleUpdate);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return q.exec();
    }
    const result = await q.exec();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    if (result.modifiedCount > 0) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return this.model.find(searchQuery).exec();
    }
    return [];
  }

  async _get(
    id: string,
    query: Record<string, any> = {},
    getOptions = {
      handleSoftDelete: true,
    },
  ): Promise<D | D[]> {
    if (!getOptions.handleSoftDelete) {
      throw new BadRequestException(
        'getOptions.handleSoftDelete not provided in _get.',
      );
    }

    query[options.deleteKey || 'deleted'] = {
      $ne: true,
    };

    const filters = assignFilters({}, query, FILTERS, {});
    const searchQuery: FilterQuery<Record<any, any>> = {
      ...rawQuery(query),
      _id: id,
    };

    const q = this.model.findOne(searchQuery);
    const isSingleOperation = true;
    nestify(q, filters, options, isSingleOperation);
    // @ts-expect-error
    return (await q.exec()) || [];
  }

  private _getOrFind(
    isSingleUpdate: boolean,
    searchQuery: FilterQuery<D>,
    data: UpdateQuery<M>,
  ) {
    if (isSingleUpdate) {
      return this.model.findOneAndUpdate(searchQuery, data, { new: true });
    }
    return this.model.updateMany(searchQuery, data);
  }

  async _remove(
    id: string | null,
    query: Record<string, any> = {},
    // user: Users | AppUsers,
    removeOptions = {
      handleSoftDelete: true,
    },
  ): Promise<D | D[]> {
    if (!removeOptions.handleSoftDelete) {
      throw new BadRequestException(
        'findOptions.handleSoftDelete not provided in _remove.',
      );
    }
    const searchQuery: FilterQuery<Record<any, any>> = id
      ? { _id: id, ...rawQuery(query) }
      : rawQuery(query);

    // @ts-expect-error
    const data = await this._get(id, query);

    id
      ? await this.model.deleteOne(searchQuery).exec()
      : await this.model.deleteMany(searchQuery).exec();
    return data;
  }
}
