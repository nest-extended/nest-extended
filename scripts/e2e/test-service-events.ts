/**
 * Focused checks for the service event dispatcher in `@nest-extended/core`.
 *
 * Runs against a fake in-memory service so it needs no database, no Nest app and no
 * network — the generated-app harness (`test-generated-app.ts`) covers the DI wiring.
 * This covers the dispatch contract itself:
 *
 *   - `before*` runs inline and its return value replaces the input
 *   - `on*` is detached: it has not run when the operation resolves
 *   - a throwing `on*` cannot break the operation
 *   - `whenSettled()` waits for detached hooks
 *   - `emit()` reaches a custom method on the events class
 *   - `events: false` disables both halves
 *   - `ctx` carries the service and the hook name
 *
 * Usage: yarn test:events
 */

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type {
    EventContext,
    NestServiceEvents as NestServiceEventsType,
} from '../../packages/core/src/lib/nest-service-events';
import type { NestServiceBase as NestServiceBaseType } from '../../packages/core/src/lib/nest-service-base';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORE_DIST = path.join(REPO_ROOT, 'dist', 'packages', 'core', 'src', 'lib');

// The ESM loader can't resolve relative TS imports without a root tsconfig.json, so
// run against the built output — building it first if it isn't there.
if (!existsSync(path.join(CORE_DIST, 'nest-service-base.js'))) {
    console.log('Building @nest-extended/core...');
    const built = spawnSync('npx', ['nx', 'build', 'core'], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (built.status !== 0) throw new Error('nx build core failed');
}

const { NestServiceBase } = require_(path.join(CORE_DIST, 'nest-service-base.js')) as {
    NestServiceBase: typeof NestServiceBaseType;
};
const { NestServiceEvents } = require_(path.join(CORE_DIST, 'nest-service-events.js')) as {
    NestServiceEvents: typeof NestServiceEventsType;
};

const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m' };
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

interface Row { id?: string; name?: string; slug?: string }

const seen: string[] = [];

class TestEvents extends NestServiceEvents<TestService, Row> {
    beforeCreate(data: Row, ctx: EventContext<TestService>) {
        seen.push(`beforeCreate:${ctx.hook}`);
        return { ...data, slug: 'set-by-before-hook' };
    }

    onCreate(result: Row | Row[], ctx: EventContext<TestService>) {
        seen.push(`onCreate:${ctx.service instanceof TestService ? 'wired' : 'unwired'}`);
    }

    onPatch() {
        seen.push('onPatch');
        throw new Error('deliberate failure inside a detached hook');
    }

    approve(row: Row) {
        seen.push(`approve:${row.id ?? '?'}`);
    }
}

class TestService extends NestServiceBase<Row, TestEvents> {
    rows: Row[] = [];

    constructor(overrides: Record<string, unknown> = {}) {
        super();
        this.options = { events: true, broadcast: false, ...overrides };
    }

    async _find() { return { total: this.rows.length, $limit: 20, $skip: 0, data: this.rows }; }
    async _get(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
    async _create(data: any) { this.rows.push(data); return data; }
    async _patch(id: string | null, data: Record<any, any>) { return { id: id ?? undefined, ...data }; }
    async _remove(id: string | null) { return { id: id ?? undefined }; }

    async approveRow(row: Row) {
        this.emit('approve', row);
        return row;
    }
}

async function main(): Promise<void> {
    console.log(`\n${C.bold}Service event dispatcher${C.reset}`);

    const service = new TestService();
    service.registerEvents(new TestEvents());

    const created = await service.create({ id: '1', name: 'Acme' });
    check('beforeCreate runs inline and its return value replaces the input',
        (created as Row).slug === 'set-by-before-hook', JSON.stringify(created));
    check('onCreate has not run yet when create() resolves',
        !seen.some((e) => e.startsWith('onCreate')), seen.join(','));

    await service.whenSettled();
    check('whenSettled() waits for the detached onCreate',
        seen.includes('onCreate:wired'), seen.join(','));
    check('ctx.service is the service that dispatched the event',
        seen.includes('onCreate:wired'));
    check('ctx.hook names the hook being dispatched',
        seen.includes('beforeCreate:beforeCreate'), seen.join(','));

    const patched = await service.patch('1', { name: 'Updated' });
    check('a throwing on* hook does not break the operation',
        (patched as Row)?.name === 'Updated', JSON.stringify(patched));
    await service.whenSettled();
    check('the throwing hook still ran (and was contained)', seen.includes('onPatch'));

    await service.approveRow({ id: '42' });
    await service.whenSettled();
    check('emit() reaches a custom method on the events class', seen.includes('approve:42'));

    // events: false must disable both halves.
    const before = seen.length;
    const disabled = new TestService({ events: false });
    disabled.registerEvents(new TestEvents());
    const untouched = await disabled.create({ id: '2', name: 'Nope' });
    await disabled.whenSettled();
    check('events: false skips before* hooks', (untouched as Row).slug === undefined);
    check('events: false skips on* hooks', seen.length === before, `${seen.length} vs ${before}`);

    // A service with no events class at all must be inert, not broken.
    const bare = new TestService();
    const bareResult = await bare.create({ id: '3', name: 'Bare' });
    await bare.whenSettled();
    check('a service without an events class still works', (bareResult as Row).name === 'Bare');

    console.log(
        failures.length === 0
            ? `\n  ${C.green}PASS${C.reset} (${total}/${total} checks)\n`
            : `\n  ${C.red}FAIL${C.reset} (${total - failures.length}/${total} checks)\n`,
    );
    process.exit(failures.length === 0 ? 0 : 1);
}

void main();
