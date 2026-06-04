import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ZodError } from 'zod';

@Catch(ZodError)
export class ZodValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Flatten and format errors: map Zod issues to { fieldPath: message }
    const formattedErrors: Record<string, string> = {};
    exception.issues.forEach((issue) => {
      const path = issue.path.join('.');
      // Keep first error per path
      if (!formattedErrors[path]) {
        formattedErrors[path] = issue.message;
      }
    });

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }
}
