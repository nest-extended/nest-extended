/**
 * Translates TypeORM `QueryFailedError` driver errors to human-readable
 * messages. Covers the PostgreSQL (SQLSTATE), MySQL/MariaDB (errno) and
 * SQLite (string code) drivers.
 */
export function handleTypeOrmError(exception: any): {
    message: string;
    details?: string;
} {
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
        return wrap(
            'A record with this value already exists. The value must be unique.',
            details,
        );
    }

    // --- Foreign key violations ---
    if (
        code === '23503' || // PostgreSQL foreign_key_violation
        code === 'ER_NO_REFERENCED_ROW' ||
        code === 'ER_NO_REFERENCED_ROW_2' ||
        errno === 1452 ||
        code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
    ) {
        return wrap(
            'Foreign key constraint failed. A related record is missing.',
            details,
        );
    }

    // --- Not-null violations ---
    if (
        code === '23502' || // PostgreSQL not_null_violation
        code === 'ER_BAD_NULL_ERROR' ||
        errno === 1048 ||
        code === 'SQLITE_CONSTRAINT_NOTNULL'
    ) {
        return wrap(
            'A required field is missing. This field cannot be null.',
            details,
        );
    }

    // --- Check constraint violations ---
    if (code === '23514' || code === 'SQLITE_CONSTRAINT_CHECK') {
        return wrap(
            'A check constraint failed for the provided value.',
            details,
        );
    }

    // --- Value too long ---
    if (code === '22001' || code === 'ER_DATA_TOO_LONG' || errno === 1406) {
        return wrap(
            'The provided value is too long for one of the columns.',
            details,
        );
    }

    // --- Undefined table / column ---
    if (code === '42P01' || code === 'ER_NO_SUCH_TABLE' || errno === 1146) {
        return wrap(
            'The requested table does not exist in the current database.',
            details,
        );
    }
    if (code === '42703' || code === 'ER_BAD_FIELD_ERROR' || errno === 1054) {
        return wrap(
            'The requested column does not exist in the current database.',
            details,
        );
    }

    return wrap(
        'An unknown database error occurred. Please contact support if the issue persists.',
        details,
    );
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
