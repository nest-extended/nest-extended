import { ClsServiceManager } from 'nestjs-cls';

/**
 * Constants for CLS keys used in the application.
 */
export const CLS_KEYS = {
    USER: 'user',
} as const;

/**
 * Get the current user from the CLS (Continuation Local Storage) context.
 * This user is set by the AuthGuard after successful token verification.
 * 
 * @returns The current authenticated user, or undefined if not available
 */
export function getCurrentUser<T = any>(): T | undefined {
    try {
        const cls = ClsServiceManager.getClsService();
        return cls?.get(CLS_KEYS.USER);
    } catch {
        // CLS context may not be available (e.g., during app startup)
        return undefined;
    }
}
