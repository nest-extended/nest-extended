/**
 * Translates Prisma error codes to human-readable messages.
 * @see https://www.prisma.io/docs/reference/api-reference/error-reference
 */
export function handlePrismaError(exception: any): {
    message: string;
    details?: string;
} {
    let message = 'A database error occurred.';
    const details = exception.message;

    switch (exception.code) {
        case 'P2002': {
            const target = exception.meta?.target;
            const field = Array.isArray(target) ? target.join(', ') : target || 'unknown field';
            message = `${field} must be unique. A record with this value already exists.`;
            break;
        }

        case 'P2003': {
            const fieldName = exception.meta?.field_name || 'unknown field';
            message = `Foreign key constraint failed on field: ${fieldName}.`;
            break;
        }

        case 'P2025':
            message = 'Record not found. The requested resource does not exist or has been deleted.';
            break;

        case 'P2014': {
            const relationName = exception.meta?.relation_name || 'unknown';
            message = `The change you are trying to make would violate the required relation '${relationName}'.`;
            break;
        }

        case 'P2000': {
            const column = exception.meta?.column_name || 'unknown column';
            message = `The provided value is too long for column '${column}'.`;
            break;
        }

        case 'P2006': {
            const fieldMeta = exception.meta?.field_name || 'unknown field';
            message = `The provided value for '${fieldMeta}' is invalid.`;
            break;
        }

        case 'P2011': {
            const constraint = exception.meta?.constraint || 'unknown field';
            message = `Null constraint violation on '${constraint}'. This field cannot be null.`;
            break;
        }

        case 'P2024':
            message = 'Connection pool timeout. The database connection could not be established in time. Please try again later.';
            break;

        case 'P2021': {
            const table = exception.meta?.table || 'unknown';
            message = `The table '${table}' does not exist in the current database.`;
            break;
        }

        case 'P2022': {
            const col = exception.meta?.column || 'unknown';
            message = `The column '${col}' does not exist in the current database.`;
            break;
        }

        default:
            message =
                'An unknown database error occurred. Please contact support if the issue persists.';
    }

    return {
        message,
        details: process.env['NODE_ENV'] === 'production' ? undefined : details,
    };
}
