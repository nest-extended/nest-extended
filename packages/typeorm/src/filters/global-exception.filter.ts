import {
    Catch,
    ArgumentsHost,
    ExceptionFilter,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { ZodError } from 'zod';
import { handleTypeOrmError } from './typeorm-error.filter';

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

        // TypeORM query failures (unique / FK / not-null / etc.)
        if (exception.constructor?.name === 'QueryFailedError') {
            const error = new BadRequestException(exception);
            return response
                .status(error.getStatus())
                .json(handleTypeOrmError(exception));
        }

        // TypeORM "entity not found" (e.g. findOneOrFail)
        if (exception.constructor?.name === 'EntityNotFoundError') {
            const error = new NotFoundException(
                'Record not found. The requested resource does not exist or has been deleted.',
            );
            return response.status(error.getStatus()).json(error.getResponse());
        }

        if (exception instanceof ZodError) {
            const error = new BadRequestException(exception);
            return response.status(error.getStatus()).json(error.getResponse());
        }

        response.status(500).json({
            statusCode: 500,
            timestamp: new Date().toISOString(),
            error: {
                name: exception.name,
                message: exception.message || 'Internal Server Error',
                // todo: remove stack in production
                stack: process.env['NODE_ENV'] === 'production' ? undefined : exception.stack,
            },
            path: request.url,
        });
    }
}
