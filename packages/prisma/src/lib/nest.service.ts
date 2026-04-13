import { PaginatedResponse } from '@nest-extended/core';
import { BadRequestException } from '@nestjs/common';
import { assignFilters, FILTERS, rawQuery } from '../common/query.utils';
import { options } from '@nest-extended/core';
import { NestServiceOptions } from '@nest-extended/core';
import { applyFilters } from '../common/apply-filters';

import { SoftDeleteConfig } from '@nest-extended/core';
import { getCurrentUser } from '@nest-extended/core';

/**
 * Default soft delete configuration for Prisma.
 * Uses `deleted` boolean field instead of MongoDB-style `$ne` query.
 */
const defaultSoftDeleteConfig: SoftDeleteConfig = {
    getQuery: () => ({ [options.deleteKey || 'deleted']: { not: true } }),
    getData: (user: any) => ({
        deleted: true,
        deletedBy: user?.id ?? null,
        deletedAt: new Date(),
    }),
};

/**
 * Generic CRUD service for Prisma — same API surface as the Mongoose NestService.
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class CatsService extends NestService<any> {
 *   constructor(private readonly prisma: PrismaService) {
 *     super(prisma.cat);
 *   }
 * }
 * ```
 *
 * Supports:
 * - Full CRUD: _find, _get, _create, _patch, _remove
 * - FeathersJS-style query operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $like, $notLike, $iLike, $notILike, $or, $and
 * - Pagination: $limit, $skip
 * - Field selection: $select
 * - Relations: $include (replaces Mongoose $populate)
 * - Sorting: $sort
 * - Soft delete: configurable via SoftDeleteConfig
 * - Bulk operations: multi mode for createMany/updateMany
 */
export class NestService<T> {
    private model: any; // Prisma delegate (e.g., prisma.user)
    private options: NestServiceOptions;
    private softDeleteConfig: SoftDeleteConfig;

    constructor(
        model: any,
        serviceOptions: NestServiceOptions = {},
        softDeleteConfig?: SoftDeleteConfig,
    ) {
        this.model = model;
        this.options = {
            multi: false,
            softDelete: true,
            pagination: true,
            ...serviceOptions,
        };
        this.softDeleteConfig = softDeleteConfig || defaultSoftDeleteConfig;
    }

    /**
     * Merge soft-delete filter into the where clause if soft delete is enabled.
     */
    private applySoftDeleteFilter(where: Record<string, any>): void {
        if (this.options.softDelete) {
            const softDeleteQuery = this.softDeleteConfig.getQuery();
            // Convert NestExtended soft delete query to Prisma format
            // { deleted: { $ne: true } } → { deleted: { not: true } }
            for (const key in softDeleteQuery) {
                if (softDeleteQuery.hasOwnProperty(key)) {
                    const val = softDeleteQuery[key];
                    if (typeof val === 'object' && val !== null && val['$ne'] !== undefined) {
                        where[key] = { not: val['$ne'] };
                    } else if (typeof val === 'object' && val !== null && val['not'] !== undefined) {
                        where[key] = val;
                    } else {
                        where[key] = val;
                    }
                }
            }
        }
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
        const where = rawQuery(query);

        // Apply soft delete filter
        this.applySoftDeleteFilter(where);

        const isPaginationEnabled = findOptions.pagination ?? this.options.pagination;

        // Build Prisma query options
        const queryOptions: Record<string, any> = { where };
        applyFilters(queryOptions, filters, options, !isPaginationEnabled);

        if (!isPaginationEnabled) {
            return (await this.model.findMany(queryOptions)) as P extends true ? PaginatedResponse<T> : T[];
        }

        const [data, total] = await Promise.all([
            this.model.findMany(queryOptions),
            this.model.count({ where }),
        ]);

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
            if (Array.isArray(data)) {
                // Prisma createMany doesn't return the created records
                // We need to use a transaction for bulk create with return
                const results: T[] = [];
                for (const item of data) {
                    const created = await this.model.create({ data: item });
                    results.push(created);
                }
                return results;
            }
            return this.model.create({ data });
        }

        // When multi is disabled, only accept single object
        if (Array.isArray(data)) {
            throw new BadRequestException(
                'Bulk creation is not enabled. Set multi: true in service options to allow array input.',
            );
        }
        return this.model.create({ data });
    }

    async _patch(
        id: string | null,
        data: Record<any, any>,
        query: Record<string, any> = {},
    ): Promise<T | T[] | null> {
        query = { ...query };

        const where = rawQuery(query);
        this.applySoftDeleteFilter(where);

        if (id) {
            // Single record update by ID
            const searchWhere = { id, ...where };
            const filters = assignFilters({}, query, FILTERS, {});
            const queryOptions: Record<string, any> = {};

            // Apply select/include if provided
            if (filters.$select) {
                queryOptions['select'] = filters.$select;
            }
            if (filters.$include) {
                if (queryOptions['select']) {
                    const include = filters.$include as Record<string, boolean | object>;
                    for (const key in include) {
                        if (include.hasOwnProperty(key)) {
                            queryOptions['select'][key] = include[key];
                        }
                    }
                } else {
                    queryOptions['include'] = filters.$include;
                }
            }

            return this.model.update({
                where: searchWhere,
                data,
                ...queryOptions,
            });
        }

        // Bulk update (id is null)
        const result = await this.model.updateMany({
            where,
            data,
        });

        if (result.count > 0) {
            return this.model.findMany({ where });
        }
        return [];
    }

    async _get(
        id: string,
        query: Record<string, any> = {},
    ): Promise<T | null> {
        query = { ...query };

        const filters = assignFilters({}, query, FILTERS, {});
        const where = rawQuery(query);
        this.applySoftDeleteFilter(where);

        const searchWhere = { ...where, id };

        const queryOptions: Record<string, any> = { where: searchWhere };
        const isSingleOperation = true;
        applyFilters(queryOptions, filters, options, isSingleOperation);

        // Remove take/skip for single record fetch
        delete queryOptions['take'];
        delete queryOptions['skip'];

        return (await this.model.findFirst(queryOptions)) || null;
    }

    async _remove(
        id: string | null,
        query: Record<string, any> = {},
        user?: any,
    ): Promise<T | T[] | null> {
        query = { ...query };
        const where = rawQuery(query);

        const data = id ? await this._get(id, query) : null;

        if (this.options.softDelete) {
            // Get user from parameter or fallback to CLS context
            const currentUser = user ?? getCurrentUser();
            // Soft delete: mark as deleted using configured getData
            const softDeleteData = this.softDeleteConfig.getData(currentUser);
            await this._patch(id, softDeleteData, where);
            return data;
        }

        // Hard delete: actually remove from database
        if (id) {
            await this.model.delete({ where: { id, ...where } });
        } else {
            await this.model.deleteMany({ where });
        }
        return data;
    }

    async getCount(filter: Record<string, any> = {}) {
        return this.model.count({ where: filter });
    }
}
