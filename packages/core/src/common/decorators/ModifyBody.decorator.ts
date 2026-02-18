import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request as ExRequest } from 'express-serve-static-core';
// import { UsersDocument } from 'src/services/apis/users/schemas/users.schema';

declare type Request = {
    user: any;
} & ExRequest;

declare type ModifyBodyFn = (request: Request) => Request;

export const setCreatedBy =
    (key = 'createdBy'): ModifyBodyFn =>
        (request: Request) => {
            request.body[key] = request.user._id;
            return request;
        };

export const ModifyBody = createParamDecorator(
    (fn: undefined | ModifyBodyFn | ModifyBodyFn[], ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        if (Array.isArray(fn)) {
            fn.forEach((f) => f?.(request));
        } else {
            fn?.(request);
        }
        return request.body;
    },
);