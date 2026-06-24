import * as path from 'path';

/**
 * Resolve the npm install spec for an internal `@nest-extended/<name>` package.
 *
 * Normally this is the registry spec `@nest-extended/<name>@<version>`. When the
 * `NEST_EXTENDED_LOCAL_DIR` env var is set (used by the e2e harness's `--local`
 * mode), it instead points at a locally-packed tarball
 * (`<dir>/<name>.tgz`) so generated apps validate the **current source** rather
 * than the published version. This is purely a testability hook — it has no
 * effect in normal usage.
 */
export function nestExtendedDep(name: string, version: string): string {
    const dir = process.env['NEST_EXTENDED_LOCAL_DIR'];
    if (dir) {
        return path.join(dir, `${name}.tgz`);
    }
    return `@nest-extended/${name}@${version}`;
}
