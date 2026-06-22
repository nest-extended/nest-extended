
/**
 * Generates PrismaService (extends PrismaClient) and PrismaModule.
 * Created once per project — shared across all Prisma-based services.
 */

interface PrismaAdapter {
  /** npm package providing the driver adapter (its DB driver is bundled). */
  pkg: string;
  /** Exported adapter class name. */
  cls: string;
  /** Expression that constructs the adapter from process.env.DATABASE_URL. */
  instantiation: string;
}

/**
 * Prisma 7 is Rust-free: `new PrismaClient()` requires a driver adapter
 * (the datasource URL lives in prisma.config.ts, not the schema, so it is no
 * longer auto-wired at runtime). Each database has its own adapter package.
 */
const getPrismaAdapter = (database: string): PrismaAdapter => {
  switch (database) {
    case 'PostgreSQL':
      return {
        pkg: '@prisma/adapter-pg',
        cls: 'PrismaPg',
        instantiation: 'new PrismaPg({ connectionString: process.env.DATABASE_URL as string })',
      };
    case 'MySQL':
      return {
        pkg: '@prisma/adapter-mariadb',
        cls: 'PrismaMariaDb',
        instantiation: 'new PrismaMariaDb(process.env.DATABASE_URL as string)',
      };
    case 'SQLite':
    default:
      return {
        pkg: '@prisma/adapter-better-sqlite3',
        cls: 'PrismaBetterSqlite3',
        instantiation: 'new PrismaBetterSqlite3({ url: process.env.DATABASE_URL as string })',
      };
  }
};

/** The driver-adapter npm package to install for a given database. */
export const getPrismaAdapterPackage = (database: string): string => getPrismaAdapter(database).pkg;

export const getPrismaServiceFile = (database: string): string => {
  const adapter = getPrismaAdapter(database);
  return `import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { ${adapter.cls} } from '${adapter.pkg}';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: ${adapter.instantiation} });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
`;
};

export const getPrismaModuleFile = (): string => `import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
`;
