import { PaginatedResponse } from '@nest-extended/core';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { assignFilters, FILTERS, rawQuery } from '../common/query.utils';
import { options } from '@nest-extended/core';
import { NestServiceOptions } from '@nest-extended/core';
import { applyFilters } from '../common/apply-filters';

import { SoftDeleteConfig } from '@nest-extended/core';
import { getCurrentUser } from '@nest-extended/core';

/**
 * Default soft delete configuration for TypeORM.
 * Uses a `deleted` boolean field (FeathersJS-style query, converted to a
 * TypeORM `Not(true)` operator by `rawQuery`) — matching the Prisma/Mongoose
 * services for full cross-ORM parity.
 */
const defaultSoftDeleteConfig: SoftDeleteConfig = {
    getQuery: () => ({ [options.deleteKey || 'deleted']: { $ne: true } }),
    getData: (user: any) => ({
        deleted: true,
        deletedBy: user?.id ?? null,
        deletedAt: new Date(),
    }),
};

/**
 * Generic CRUD service for TypeORM — same API surface as the Prisma and
 * Mongoose `NestService`.
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class CatsService extends NestService<Cat> {
 *   constructor(@InjectRepository(Cat) repo: Repository<Cat>) {
 *     super(repo);
 *   }
 * }
 * ```
 *
 * Supports:
 * - Full CRUD: _find, _get, _create, _patch, _remove
 * - FeathersJS-style query operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $like, $notLike, $iLike, $notILike, $or, $and
 * - Pagination: $limit, $skip
 * - Field selection: $select
 * - Relations: $include (the TypeORM analogue of Prisma's $include / Mongoose's $populate)
 * - Sorting: $sort
 * - Soft delete: configurable via SoftDeleteConfig
 * - Bulk operations: multi mode
 */
export class NestService<T> {
    private repo: Repository<any>;
    private options: NestServiceOptions;
    private softDeleteConfig: SoftDeleteConfig;

    constructor(
        repo: Repository<any>,
        serviceOptions: NestServiceOptions = {},
        softDeleteConfig?: SoftDeleteConfig,
    ) {
        this.repo = repo;
        this.options = {
            multi: false,
            softDelete: true,
            pagination: true,
            ...serviceOptions,
        };
        this.softDeleteConfig = softDeleteConfig || defaultSoftDeleteConfig;
    }

    /**
     * Merge the soft-delete predicate into the where clause (object or OR-array)
     * when soft delete is enabled.
     */
    private mergeSoftDelete(
        where: Record<string, any> | Record<string, any>[],
    ): Record<string, any> | Record<string, any>[] {
        if (!this.options.softDelete) return where;

        // Convert the configured (FeathersJS-style) soft-delete query into a
        // TypeORM where object, e.g. { deleted: { $ne: true } } → { deleted: Not(true) }.
        const sd = rawQuery(this.softDeleteConfig.getQuery()) as Record<string, any>;

        if (Array.isArray(where)) {
            return where.map((clause) => ({ ...clause, ...sd }));
        }
        return { ...where, ...sd };
    }

    /** Add the primary key to the where clause (object or OR-array). */
    private withId(
        where: Record<string, any> | Record<string, any>[],
        id: string,
    ): Record<string, any> | Record<string, any>[] {
        if (Array.isArray(where)) {
            return where.map((clause) => ({ ...clause, id }));
        }
        return { ...where, id };
    }

    async _find<P extends boolean = true>(
        query: Record<string, any> = {},
        findOptions: {
            pagination?: P;
        } = {
                pagination: this.options.pagination as P,
            },
    ): Promise<P extends true ? PaginatedResponse<T> : T[]> {
        query = { ...query };

        const filters = assignFilters({}, query, FILTERS, {});
        const where = this.mergeSoftDelete(rawQuery(query));

        const isPaginationEnabled = findOptions.pagination ?? this.options.pagination;

        const queryOptions: Record<string, any> = { where };
        applyFilters(queryOptions, filters, options, !isPaginationEnabled);

        if (!isPaginationEnabled) {
            return (await this.repo.find(queryOptions)) as P extends true ? PaginatedResponse<T> : T[];
        }

        const [data, total] = await this.repo.findAndCount(queryOptions);

        return {
            total,
            $limit: Number(filters.$limit) || options.defaultLimit,
            $skip: Number(filters.$skip) || options.defaultSkip,
            data,
        } as P extends true ? PaginatedResponse<T> : T[];
    }

    async _create(data: Partial<T>): Promise<T>;
    async _create(data: Partial<T>[]): Promise<T[]>;
    async _create(data: Partial<T> | Partial<T>[]): Promise<T | T[]> {
        const multi = this.options.multi;

        if (multi) {
            const entities = this.repo.create(data as any);
            return (await this.repo.save(entities as any)) as T | T[];
        }

        // When multi is disabled, only accept single object
        if (Array.isArray(data)) {
            throw new BadRequestException(
                'Bulk creation is not enabled. Set multi: true in service options to allow array input.',
            );
        }
        const entity = this.repo.create(data as any);
        return (await this.repo.save(entity as any)) as T;
    }

    async _patch(
        id: string | null,
        data: Record<any, any>,
        query: Record<string, any> = {},
    ): Promise<T | T[] | null> {
        query = { ...query };

        const filters = assignFilters({}, query, FILTERS, {});
        const where = this.mergeSoftDelete(rawQuery(query));

        if (id) {
            // Single record update by ID.
            const searchWhere = this.withId(where, id);
            const criteria = Array.isArray(searchWhere) ? { id } : searchWhere;
            await this.repo.update(criteria as any, data as any);

            // Refetch the updated record honoring $select / $include.
            const findOptions: Record<string, any> = { where: searchWhere };
            applyFilters(findOptions, filters, options, true);
            delete findOptions['take'];
            delete findOptions['skip'];
            return (await this.repo.findOne(findOptions)) || null;
        }

        // Bulk update (id is null). TypeORM `update` takes a single criteria object.
        const criteria = Array.isArray(where) ? where[0] : where;
        const result = await this.repo.update(criteria as any, data as any);

        if (result.affected && result.affected > 0) {
            return this.repo.find({ where });
        }
        return [];
    }

    async _get(
        id: string,
        query: Record<string, any> = {},
    ): Promise<T | null> {
        query = { ...query };

        const filters = assignFilters({}, query, FILTERS, {});
        const where = this.withId(this.mergeSoftDelete(rawQuery(query)), id);

        const queryOptions: Record<string, any> = { where };
        applyFilters(queryOptions, filters, options, true);

        // Single-record fetch: no pagination window.
        delete queryOptions['take'];
        delete queryOptions['skip'];

        return (await this.repo.findOne(queryOptions)) || null;
    }

    async _remove(
        id: string | null,
        query: Record<string, any> = {},
        user?: any,
    ): Promise<T | T[] | null> {
        query = { ...query };

        const data = id ? await this._get(id, query) : null;

        if (this.options.softDelete) {
            // Get user from parameter or fallback to CLS context.
            const currentUser = user ?? getCurrentUser();
            const softDeleteData = this.softDeleteConfig.getData(currentUser);
            await this._patch(id, softDeleteData, query);
            return data;
        }

        // Hard delete: actually remove from the database.
        const where = rawQuery(query);
        if (id) {
            const criteria = Array.isArray(where) ? { id } : { ...where, id };
            await this.repo.delete(criteria as any);
        } else {
            const criteria = Array.isArray(where) ? where[0] : where;
            await this.repo.delete(criteria as any);
        }
        return data;
    }

    async getCount(filter: Record<string, any> = {}) {
        const where = rawQuery(filter);
        return this.repo.count({ where });
    }
}
