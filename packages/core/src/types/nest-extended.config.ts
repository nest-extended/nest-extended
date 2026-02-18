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

export interface NestExtendedConfig {
    /**
     * Soft delete configuration.
     * If not provided, default soft delete behavior is used.
     */
    softDelete?: SoftDeleteConfig;
}

/**
 * Injection token for NestExtended configuration.
 * Use this to inject the config in services.
 */
export const NEST_EXTENDED_CONFIG = Symbol('NEST_EXTENDED_CONFIG');
