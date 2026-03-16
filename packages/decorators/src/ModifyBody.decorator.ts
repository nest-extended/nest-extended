import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request as ExRequest } from 'express-serve-static-core';

export type RequestBody<
  TBody extends Record<string, any> = Record<string, any>,
  TUser = any,
> = Omit<ExRequest, 'body' | 'user'> & {
  user: TUser;
  body: TBody;
};

export type ModifyBodyFn<
  TBody extends Record<string, any> = Record<string, any>,
  TUser = any,
> = (request: RequestBody<TBody, TUser>) => RequestBody<TBody, TUser>;

export const setCreatedBy =
  (key = 'createdBy'): ModifyBodyFn =>
  (request) => {
    request.body[key] = request.user?._id;
    return request;
  };

const ModifyBodyInner = createParamDecorator(
  (fns: Array<ModifyBodyFn<any, any> | undefined>, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (Array.isArray(fns)) {
        fns.forEach((f) => f?.(request));
    } else {
        // Fallback in case it's not an array, though our wrapper ensures it is
        (fns as any)?.(request);
    }
    return request.body;
  },
);

export const ModifyBody = (...fns: Array<ModifyBodyFn<any, any> | undefined>) => ModifyBodyInner(fns);
