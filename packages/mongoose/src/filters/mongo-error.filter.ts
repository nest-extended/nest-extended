export function handleMongoError(exception: any): {
  message: string;
  details?: string;
} {
  let message = 'A database error occurred.';
  const details = exception.message;

  switch (exception.code) {
    case 11000:
      const field = Object.keys(exception.keyPattern || {})[0];
      message = `${field} must be unique. Value '${exception.keyValue[field]}' is already in use.`;
      break;

    case 121:
      message = 'Document validation failed. Please check the provided data.';
      break;

    case 66:
      message =
        'An attempt was made to modify an immutable field. Operation is not allowed.';
      break;

    case 50:
      message =
        'The operation took too long to complete. Please try again later.';
      break;

    case 16755:
      message =
        'Invalid query or aggregation pipeline. Please review your request.';
      break;

    case 40324:
      message =
        'Invalid index options were specified. Please review the request.';
      break;

    case 8000:
      message =
        'A transaction error occurred. Ensure the database supports transactions and try again.';
      break;

    case 31:
      message =
        'The query exceeded memory limits. Simplify the query or paginate results.';
      break;

    default:
      message =
        'An unknown database error occurred. Please contact support if the issue persists.';
  }

  return {
    message,
    details: process.env['NODE_ENV'] === 'production' ? undefined : details,
  };
}
