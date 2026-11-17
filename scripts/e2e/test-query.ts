/**
 * Focused checks for the HTTP QUERY route the CLI emits into every CRUD controller.
 *
 * QUERY (RFC 10008) is the safe, idempotent read method that carries its parameters in
 * the request content instead of the URL. This compiles the *emitted* controller of each
 * ORM template, boots it in a real Nest app over a fake in-memory service, and drives it
 * with real HTTP — so it needs no database, no generated app and no network:
 *
 *   - QUERY <resource> reads with a JSON body and returns what GET returns
 *   - the body reaches the service verbatim (nesting and value types preserved)
 *   - repeating the request only ever reads, and fires the same find events as GET
 *   - the auth guard still applies, and a URL query string is ignored
 *   - a missing or non-JSON content type or a non-object body is rejected before the service
 *   - GET / POST / PATCH / DELETE behave exactly as they did before
 *
 * The generated-app harness (`test-generated-app.ts`) covers the same route against real
 * databases; this is the fast inner loop when changing the controller templates.
 *
 * Usage: yarn test:query
 */

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type { NestServiceBase as NestServiceBaseType } from '../../packages/core/src/lib/nest-service-base';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(REPO_ROOT, 'dist', 'packages');

// The ESM loader can't resolve relative TS imports without a root tsconfig.json, so run
// against the built output — building it first if it isn't there.
if (!existsSync(path.join(DIST, 'cli', 'src', 'templates', 'controller.template.js'))) {
    console.log('Building cli, core and decorators...');
    const built = spawnSync('npx', ['nx', 'run-many', '-t', 'build', '-p', 'cli', 'core', 'decorators'], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
    });
    if (built.status !== 0) throw new Error('nx run-many -t build failed');
}

require_('reflect-metadata');
const ts = require_('typescript');
const { Test } = require_('@nestjs/testing');
const { UnauthorizedException } = require_('@nestjs/common');
const decorators = require_(path.join(DIST, 'decorators', 'src', 'index.js'));
const { NestServiceBase } = require_(path.join(DIST, 'core', 'src', 'lib', 'nest-service-base.js')) as {
    NestServiceBase: typeof NestServiceBaseType;
};

const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m', dim: '\x1b[2m' };
const failures: string[] = [];
let total = 0;

function check(label: string, condition: unknown, detail = ''): void {
    total++;
    if (condition) {
        console.log(`    ${C.green}✓${C.reset} ${label}`);
    } else {
        failures.push(label);
        console.log(`    ${C.red}✗${C.reset} ${label}${detail ? ` (${detail})` : ''}`);
    }
}

/** The three ORM controller templates, all emitting the same routes. */
const TEMPLATES: Array<[orm: string, file: string, exportName: string]> = [
    ['mongoose', 'controller.template', 'getController'],
    ['prisma', 'prisma-controller.template', 'getPrismaController'],
    ['typeorm', 'typeorm-controller.template', 'getTypeOrmController'],
];

const RESOURCE = 'catalog/product';
const TOKEN = 'Bearer test-token';
const ENVELOPE = { total: 1, $limit: 20, $skip: 0, data: [{ id: '1', name: 'Example' }] };

/** Stands in for the generated `ProductService`, recording what the controller passes it. */
class ProductService extends NestServiceBase<Record<string, any>> {
    calls: string[] = [];
    lastQuery: unknown;
    result: unknown = ENVELOPE;

    async _find(query?: Record<string, any>): Promise<any> {
        this.calls.push('find');
        this.lastQuery = query;
        return this.result;
    }
    async _get() { this.calls.push('get'); return { id: '1' }; }
    async _create(data: any): Promise<any> { this.calls.push('create'); return data; }
    async _patch(_id: string | null, data: Record<any, any>) { this.calls.push('patch'); return data; }
    async _remove() { this.calls.push('remove'); return { id: '1' }; }
}

/**
 * Compiles the emitted controller source and returns the class.
 *
 * Templates are strings this repo never compiles (see docs/testing.md), so the source is
 * transpiled here and its imports are resolved against the local build — the service and
 * schema imports point at files only a generated app has.
 */
function compileController(source: string): { controller: unknown; diagnostics: number } {
    const { outputText, diagnostics } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2021,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
        },
        reportDiagnostics: true,
    });

    const exports: Record<string, unknown> = {};
    const fixtureRequire = (id: string) => {
        if (id === './product.service') return { ProductService };
        if (id === '@nest-extended/decorators') return decorators;
        if (id.endsWith('product.schema')) return { Product: class Product {} };
        return require_(id);
    };
    new Function('require', 'exports', outputText)(fixtureRequire, exports);

    return { controller: exports['ProductController'], diagnostics: diagnostics?.length ?? 0 };
}

interface Sent {
    status: number;
    headers: Headers;
    body: unknown;
}

async function runOrm(orm: string, file: string, exportName: string): Promise<void> {
    console.log(`\n  ${C.bold}${orm}${C.reset} ${C.dim}(${file})${C.reset}`);

    const template = require_(path.join(DIST, 'cli', 'src', 'templates', `${file}.js`))[exportName];
    const { controller, diagnostics } = compileController(template('Product', 'product', RESOURCE));
    check('the emitted controller compiles and declares ProductController',
        diagnostics === 0 && typeof controller === 'function', `diagnostics=${diagnostics}`);

    const service = new ProductService();
    const hooks: string[] = [];
    service.registerEvents({
        beforeFind(query: unknown) { hooks.push('beforeFind'); return query; },
        onFind() { hooks.push('onFind'); },
    } as any);

    const module = await Test.createTestingModule({
        controllers: [controller],
        providers: [{ provide: ProductService, useValue: service }],
    }).compile();

    const app = module.createNestApplication({ logger: false });
    app.useGlobalGuards({
        canActivate(context: any) {
            if (context.switchToHttp().getRequest().headers.authorization !== TOKEN) {
                throw new UnauthorizedException();
            }
            return true;
        },
    });

    try {
        await app.listen(0, '127.0.0.1');
        const base = `${await app.getUrl()}/${RESOURCE}`;

        const send = async (
            method: string,
            {
                body,
                contentType = 'application/json',
                token = true,
                suffix = '',
            }: { body?: string; contentType?: string | null; token?: boolean; suffix?: string } = {},
        ): Promise<Sent> => {
            const res = await fetch(base + suffix, {
                method,
                headers: {
                    ...(contentType ? { 'Content-Type': contentType } : {}),
                    ...(token ? { Authorization: TOKEN } : {}),
                },
                // A string body would make undici add its own content type.
                body: body === undefined ? undefined : new TextEncoder().encode(body),
            });
            const text = await res.text();
            let parsed: unknown = null;
            if (text) {
                try { parsed = JSON.parse(text); } catch { parsed = text; }
            }
            return { status: res.status, headers: res.headers, body: parsed };
        };

        // --- the guard still covers the new route ---------------------------------
        const unauthGet = await send('GET', { token: false, contentType: null });
        const unauthQuery = await send('QUERY', { body: '{}', token: false });
        check('GET without a token is still rejected (401)', unauthGet.status === 401, `status=${unauthGet.status}`);
        check('QUERY without a token is rejected (401)', unauthQuery.status === 401, `status=${unauthQuery.status}`);
        check('an unauthenticated request never reaches the service', service.calls.length === 0,
            service.calls.join(','));

        // --- the read itself ------------------------------------------------------
        const query = {
            name: { $in: ['Example', 'Other'] },
            $or: [{ active: true }, { age: { $gte: 18 } }],
            $limit: 2, $skip: 1, $sort: { name: -1 }, $select: ['name'],
        };
        const first = await send('QUERY', { body: JSON.stringify(query) });
        check('QUERY returns the read result (200)', first.status === 200, `status=${first.status}`);
        check('QUERY returns the same envelope GET returns',
            JSON.stringify(first.body) === JSON.stringify(ENVELOPE), JSON.stringify(first.body));
        check('QUERY responses are marked no-store',
            first.headers.get('cache-control') === 'no-store', String(first.headers.get('cache-control')));
        check('the JSON body reaches the service verbatim (nesting and value types kept)',
            JSON.stringify(service.lastQuery) === JSON.stringify(query), JSON.stringify(service.lastQuery));

        // --- safe and idempotent -------------------------------------------------
        const repeated = await send('QUERY', {
            body: JSON.stringify(query), contentType: 'application/json; charset=utf-8',
        });
        check('a parameterised content type is accepted', repeated.status === 200, `status=${repeated.status}`);
        check('repeating the request returns the same result',
            JSON.stringify(repeated.body) === JSON.stringify(first.body), JSON.stringify(repeated.body));
        check('repeating the request only ever reads',
            service.calls.every((call) => call === 'find') && service.calls.length === 2,
            service.calls.join(','));

        await service.whenSettled();
        check('QUERY fires beforeFind, like GET', hooks.filter((h) => h === 'beforeFind').length === 2,
            hooks.join(','));
        check('QUERY fires onFind, like GET', hooks.filter((h) => h === 'onFind').length === 2, hooks.join(','));

        // --- the body is the whole query -----------------------------------------
        const ignoredUrl = await send('QUERY', { body: '{}', suffix: '?name=ignored' });
        check('a URL query string is ignored when the query is in the body',
            ignoredUrl.status === 200 && JSON.stringify(service.lastQuery) === '{}',
            JSON.stringify(service.lastQuery));

        const get = await send('GET', { contentType: null, suffix: '?name=Example' });
        check('GET still reads its query from the URL',
            get.status === 200 && (service.lastQuery as any)?.name === 'Example',
            JSON.stringify(service.lastQuery));

        service.result = [];
        const unpaginated = await send('QUERY', { body: '{}' });
        check('an unpaginated (bare array) result passes through',
            unpaginated.status === 200 && JSON.stringify(unpaginated.body) === '[]',
            JSON.stringify(unpaginated.body));
        service.result = ENVELOPE;

        // --- rejected content ----------------------------------------------------
        const callsBefore = service.calls.length;
        const invalid: Array<[label: string, body: string | undefined, contentType: string | null, status: number]> = [
            ['no content type', '{}', null, 400],
            ['no content', undefined, 'application/json', 400],
            ['empty content', '', 'application/json', 400],
            ['text/plain', '{}', 'text/plain', 415],
            ['form encoding', 'name=Example', 'application/x-www-form-urlencoded', 415],
            ['application/problem+json', '{}', 'application/problem+json', 415],
            ['malformed JSON', '{broken', 'application/json', 400],
            ['a JSON array', '[{}]', 'application/json', 400],
            ['JSON null', 'null', 'application/json', 400],
            ['a JSON string', '"text"', 'application/json', 400],
            ['a JSON number', '42', 'application/json', 400],
            ['a hasOwnProperty key', '{"hasOwnProperty":true}', 'application/json', 400],
            ['a nested __proto__ key', '{"$or":[{"__proto__":{"admin":true}}]}', 'application/json', 400],
        ];
        for (const [label, body, contentType, status] of invalid) {
            const res = await send('QUERY', { body, contentType });
            check(`rejects ${label} (${status})`, res.status === status, `status=${res.status}`);
        }
        check('rejected content never reaches the service', service.calls.length === callsBefore,
            service.calls.slice(callsBefore).join(','));

        // --- the routes that existed before --------------------------------------
        const existing: Array<[method: string, suffix: string, body: string | undefined, status: number]> = [
            ['GET', '/1', undefined, 200],
            ['POST', '', '{"name":"New"}', 201],
            ['PATCH', '/1', '{"name":"Updated"}', 200],
            ['DELETE', '/1', undefined, 200],
        ];
        const before = service.calls.length;
        for (const [method, suffix, body, status] of existing) {
            const res = await send(method, { suffix, body });
            check(`${method} /<resource>${suffix} still responds ${status}`, res.status === status,
                `status=${res.status}`);
        }
        check('the existing routes still call the same service methods',
            service.calls.slice(before).join(',') === 'get,create,patch,remove',
            service.calls.slice(before).join(','));

        const itemQuery = await send('QUERY', { body: '{}', suffix: '/1' });
        check('QUERY is collection-only — /<resource>/:id is not routed (404)', itemQuery.status === 404,
            `status=${itemQuery.status}`);
    } finally {
        await app.close();
    }
}

async function main(): Promise<void> {
    console.log(`\n${C.bold}HTTP QUERY in the generated CRUD controllers${C.reset}`);

    for (const [orm, file, exportName] of TEMPLATES) {
        await runOrm(orm, file, exportName);
    }

    console.log(
        failures.length === 0
            ? `\n  ${C.green}PASS${C.reset} (${total}/${total} checks)\n`
            : `\n  ${C.red}FAIL${C.reset} (${total - failures.length}/${total} checks)\n${
                  failures.map((f) => `    - ${f}`).join('\n')}\n`,
    );
    process.exit(failures.length === 0 ? 0 : 1);
}

void main();
