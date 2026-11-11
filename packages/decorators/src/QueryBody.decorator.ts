import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
    UnsupportedMediaTypeException,
} from '@nestjs/common';

/**
 * Property names the query builders would read off the prototype chain — or call, as
 * `rawQuery` does with `query.hasOwnProperty(key)`. `qs` drops `__proto__` when parsing a
 * URL query string; rejecting them here keeps a JSON body from being a weaker door.
 */
const RESERVED_KEYS = ['__proto__', 'constructor', 'prototype', 'hasOwnProperty'];

/**
 * Extracts the query from the content of an HTTP QUERY request (RFC 10008) — the
 * safe, idempotent read method that carries its parameters in the body instead of the
 * URL. The returned object has the same shape `@Query()` produces for a query string,
 * so it can be handed straight to `service.find(query)`.
 *
 * RFC 10008 requires the server to fail a request whose `Content-Type` is missing or
 * inconsistent with its content, so this rejects anything it cannot read as a query:
 *
 * - `400` — no `Content-Type`, or content that is not a JSON object (send `{}` to
 *   match everything)
 * - `415` — a content type other than `application/json`
 *
 * URL query parameters are ignored: the content is the whole query.
 */
export const QueryBody = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): Record<string, any> => {
        const request = ctx.switchToHttp().getRequest();
        const contentType = request.headers['content-type'] as string | undefined;

        if (!contentType) {
            throw new BadRequestException('QUERY requires a Content-Type of application/json');
        }
        if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
            throw new UnsupportedMediaTypeException('QUERY supports application/json content');
        }

        // The body parser turns a zero-length body into `{}`, which is indistinguishable
        // from an explicit "match everything" — so reject that case on the header instead.
        const body: unknown = request.body;
        if (
            !body ||
            typeof body !== 'object' ||
            Array.isArray(body) ||
            request.headers['content-length'] === '0'
        ) {
            throw new BadRequestException(
                'QUERY requires a JSON object body (send {} to match everything)',
            );
        }

        assertNoReservedKeys(body);
        return body as Record<string, any>;
    },
);

/** Walks the parsed query, rejecting reserved property names at any depth. */
function assertNoReservedKeys(value: unknown): void {
    if (!value || typeof value !== 'object') return;

    for (const key of Object.keys(value)) {
        if (RESERVED_KEYS.includes(key)) {
            throw new BadRequestException(`QUERY contains a reserved property name: ${key}`);
        }
        assertNoReservedKeys((value as Record<string, unknown>)[key]);
    }
}
