/**
 * Translates TypeORM `QueryFailedError` driver errors to human-readable
 * messages. Covers the PostgreSQL (SQLSTATE), MySQL/MariaDB (errno) and
 * SQLite (string code) drivers.
 */
export function handleTypeOrmError(exception: any): {
    message: string;
    details?: string;
} {
    let message = 'A database error occurred.';
    const details = exception?.message;

    const driverError = exception?.driverError ?? exception;
    const code: string | undefined = driverError?.code;
    const errno: number | undefined = driverError?.errno;

    // --- Unique constraint violations ---
    if (
        code === '23505' || // PostgreSQL unique_violation
        code === 'ER_DUP_ENTRY' ||
        errno === 1062 || // MySQL/MariaDB duplicate entry
        code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        code === 'SQLITE_CONSTRAINT' // SQLite (generic constraint; usually unique)
    ) {
        message =
            'A record with this value already exists. The value must be unique.';
        return wrap(message, details);
    }

    // --- Foreign key violations ---
    if (
        code === '23503' || // PostgreSQL foreign_key_violation
        code === 'ER_NO_REFERENCED_ROW' ||
        code === 'ER_NO_REFERENCED_ROW_2' ||
        errno === 1452 ||
        code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
    ) {
        message = 'Foreign key constraint failed. A related record is missing.';
        return wrap(message, details);
    }

    // --- Not-null violations ---
    if (
        code === '23502' || // PostgreSQL not_null_violation
        code === 'ER_BAD_NULL_ERROR' ||
        errno === 1048 ||
        code === 'SQLITE_CONSTRAINT_NOTNULL'
    ) {
        message = 'A required field is missing. This field cannot be null.';
        return wrap(message, details);
    }

    // --- Check constraint violations ---
    if (code === '23514' || code === 'SQLITE_CONSTRAINT_CHECK') {
        message = 'A check constraint failed for the provided value.';
        return wrap(message, details);
    }

    // --- Value too long ---
    if (code === '22001' || code === 'ER_DATA_TOO_LONG' || errno === 1406) {
        message = 'The provided value is too long for one of the columns.';
        return wrap(message, details);
    }

    // --- Undefined table / column ---
    if (code === '42P01' || code === 'ER_NO_SUCH_TABLE' || errno === 1146) {
        message = 'The requested table does not exist in the current database.';
        return wrap(message, details);
    }
    if (code === '42703' || code === 'ER_BAD_FIELD_ERROR' || errno === 1054) {
        message = 'The requested column does not exist in the current database.';
        return wrap(message, details);
    }

    message =
        'An unknown database error occurred. Please contact support if the issue persists.';
    return wrap(message, details);
}

function wrap(
    message: string,
    details?: string,
): { message: string; details?: string } {
    return {
        message,
        details: process.env['NODE_ENV'] === 'production' ? undefined : details,
    };
}
