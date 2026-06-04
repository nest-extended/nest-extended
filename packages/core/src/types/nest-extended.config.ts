import { Type } from '@nestjs/common';
import { ExceptionFilter } from '@nestjs/common';

/**
 * Configuration interface for NestExtended module.
 * This allows the application to configure soft delete behavior
 * without coupling the core package to application-specific schemas.
 */
export interface SoftDeleteConfig {
    /**
     * Returns the query filter to exclude soft-deleted documents.
     * Default: { deleted: { $ne: true } }
     */
    getQuery: () => Record<string, any>;

    /**
     * Returns the data to set when soft deleting a document.
     * Receives the current user object from the controller.
     * @param user - The authenticated user object from token verification
     */
    getData: (user: any) => Record<string, any>;
}

export interface QueryParserConfig {
    /** Maximum depth for nested objects. Default: 20 */
    depth?: number;
    /** Maximum number of array elements. Default: 100 */
    arrayLimit?: number;
    /** Allow dot notation in query keys. Default: false */
    allowDots?: boolean;
}

export interface NestExtendedConfig {
    /**
     * Soft delete configuration.
     * If not provided, default soft delete behavior is used.
     */
    softDelete?: SoftDeleteConfig;

    /**
     * Query parser configuration using `qs`.
     * - `true` or `undefined` (default): enables qs with defaults (depth: 20, arrayLimit: 100, allowDots: false)
     * - `QueryParserConfig` object: enables qs with custom options
     * - `false`: disables the qs query parser (uses Express default)
     */
    queryParser?: QueryParserConfig | boolean;

    /**
     * Array of ExceptionFilter classes to register globally via APP_FILTER.
     * Each entry is registered in the order provided.
     *
     * @example
     * filters: [MongooseValidationExceptionFilter, ZodValidationExceptionFilter]
     */
    filters?: Type<ExceptionFilter>[];
}

/**
 * Injection token for NestExtended configuration.
 * Use this to inject the config in services.
 */
export const NEST_EXTENDED_CONFIG = Symbol('NEST_EXTENDED_CONFIG');
