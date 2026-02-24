import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class NullResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const method = request.method;

        if (method === 'GET') {
            return next.handle().pipe(
                map((data) => {
                    if (response.headersSent) {
                        console.warn(
                            'Response headers already sent, skipping NullResponseInterceptor logic.',
                        );
                        return data;
                    }
                    if (data === null || data === undefined) {
                        throw new NotFoundException('Resources not found');
                    }
                    return data;
                }),
            );
        }
        return next.handle();
    }
}
