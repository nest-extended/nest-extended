
/**
 * TypeORM project-level setup: a shared `DataSource` (used by the TypeORM CLI
 * for schema sync / migrations) and a `DatabaseModule` (wires
 * `TypeOrmModule.forRoot` into Nest). Created once per project and shared
 * across all TypeORM-based services.
 */

type SqlProvider = 'postgresql' | 'mysql' | 'sqlite';

/** Map a SQL provider to the npm driver package the generated app must install. */
export const getTypeOrmDriverPackage = (provider: string): string => {
    switch (provider) {
        case 'postgresql':
            return 'pg';
        case 'mysql':
            return 'mysql2';
        case 'sqlite':
        default:
            return 'better-sqlite3';
    }
};

/** The provider-specific `DataSourceOptions` connection block (a code string). */
const getConnectionOptions = (provider: SqlProvider): string => {
    switch (provider) {
        case 'postgresql':
            return `  type: 'postgres',
  url: process.env.DATABASE_URL,`;
        case 'mysql':
            return `  type: 'mysql',
  url: process.env.DATABASE_URL,`;
        case 'sqlite':
        default:
            return `  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH || 'dev.db',`;
    }
};

/**
 * `src/database/data-source.ts` — a standalone DataSource consumed by both the
 * TypeORM CLI (schema sync / migrations) and the Nest `DatabaseModule`.
 *
 * Schema creation is OFF by default: set `DB_SYNCHRONIZE=true` to let the app
 * auto-create/update tables on boot, or run `npm run db:sync` to do it manually.
 */
export const getDataSourceFile = (provider: SqlProvider): string => `import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
${getConnectionOptions(provider)}
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
`;

/**
 * `src/database/database.module.ts` — registers TypeORM globally. Reuses the
 * shared `dataSourceOptions` and toggles auto schema-sync from `DB_SYNCHRONIZE`.
 */
export const getDatabaseModuleFile = (): string => `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      migrationsRun: process.env.DB_SYNCHRONIZE === 'true',
    }),
  ],
})
export class DatabaseModule {}
`;
