import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Error } from 'mongoose';

@Catch(Error.ValidationError)
export class MongooseValidationExceptionFilter implements ExceptionFilter {
  catch(exception: Error.ValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const formattedErrors = Object.keys(exception.errors).reduce<
      Record<string, string>
    >((acc, key) => {
      acc[key] = exception.errors[key].message;
      return acc;
    }, {});

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }
}
