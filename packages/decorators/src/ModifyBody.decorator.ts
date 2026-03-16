import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request as ExRequest } from 'express-serve-static-core';

export declare type RequestBody = {
    user: any;
} & ExRequest;

export declare type ModifyBodyFn = (request: RequestBody) => RequestBody;

export const setCreatedBy =
  (key = 'createdBy'): ModifyBodyFn =>
  (request: RequestBody) => {
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
