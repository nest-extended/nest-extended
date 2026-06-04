import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { Error as MongooseError, MongooseError as MongooseBaseError } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { ZodError } from 'zod';
import { handleMongoError } from './mongo-error.filter';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    if (exception instanceof MongooseError.ValidationError) {
      const formattedErrors = Object.keys(exception.errors).reduce<
        Record<string, string>
      >((acc, key) => {
        acc[key] = exception.errors[key].message;
        return acc;
      }, {});

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    if (exception instanceof MongooseBaseError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message || 'Database error',
      });
    }

    if (exception instanceof ZodError) {
      const formattedErrors: Record<string, string> = {};
      exception.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!formattedErrors[path]) {
          formattedErrors[path] = issue.message;
        }
      });

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    if (exception instanceof MongoServerError) {
      return response
        .status(HttpStatus.BAD_REQUEST)
        .json(handleMongoError(exception));
    }

    response.status(500).json({
      statusCode: 500,
      timestamp: new Date().toISOString(),
      error: {
        name: exception.name,
        message: exception.message || 'Internal Server Error',
        // todo: remove stack in production
        stack: exception.stack,
      },
      path: request.url,
    });
  }
}
