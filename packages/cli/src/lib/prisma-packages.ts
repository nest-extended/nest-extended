/**
 * Generated apps target the **Prisma 7** ORM, and the packages installed into them are
 * pinned to it.
 *
 * Prisma 8 ("Prisma Next") is a different product with a different CLI. `prisma init
 * --datasource-provider`, `prisma generate` and `prisma db push` no longer exist — the ORM
 * commands moved under `prisma orm`, and `prisma db` / `prisma migration` mean something
 * else. Everything the generator emits is Prisma 7 shaped: the `prisma-client` generator
 * block, the `../generated/prisma/client` import in `PrismaService`, `prisma.config.ts`,
 * and the driver adapters.
 *
 * The `prisma` CLI package also currently publishes an 8.0.0 release candidate on the
 * `latest` npm tag, so an unpinned `npm install prisma` lands a pre-release that cannot
 * scaffold or migrate a Prisma 7 project at all, while `@prisma/client` and the driver
 * adapters still resolve to 7.x — an install set that cannot work together.
 */
export const PRISMA_VERSION_RANGE = '^7';

/**
 * A package to install: `name` is used to detect whether it is already present,
 * `spec` is what the package manager receives.
 */
export interface PackageSpec {
    name: string;
    spec: string;
}

/** Pin a Prisma package to the ORM major this generator targets. */
export const prismaPackage = (name: string): PackageSpec => ({
    name,
    spec: `${name}@${PRISMA_VERSION_RANGE}`,
});

/** Resolve a `string | PackageSpec` entry to the bare package name. */
export const specName = (entry: string | PackageSpec): string =>
    typeof entry === 'string' ? entry : entry.name;

/** Resolve a `string | PackageSpec` entry to the spec passed to the package manager. */
export const specValue = (entry: string | PackageSpec): string =>
    typeof entry === 'string' ? entry : entry.spec;
