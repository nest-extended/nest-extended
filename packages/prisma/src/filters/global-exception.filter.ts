import {
    Catch,
    ArgumentsHost,
    ExceptionFilter,
    BadRequestException,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { ZodError } from 'zod';
import { handlePrismaError } from './prisma-error.filter';

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

        // Prisma known request errors (P2002, P2003, P2025, etc.)
        if (exception.constructor?.name === 'PrismaClientKnownRequestError') {
            const error = new BadRequestException(exception);
            return response
                .status(error.getStatus())
                .json(handlePrismaError(exception));
        }

        // Prisma validation errors
        if (exception.constructor?.name === 'PrismaClientValidationError') {
            const error = new BadRequestException(exception.message);
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
