import * as inquirer from 'inquirer';
import * as chalk from 'chalk';

export type Orm = 'prisma' | 'typeorm' | 'mongoose';
export type DbFamily = 'sql' | 'mongo';
export type SqlProvider = 'postgresql' | 'mysql' | 'sqlite';

export interface ResolvedDb {
    /** User-facing database label: PostgreSQL | MySQL | SQLite | MongoDB */
    database: string;
    orm: Orm;
    family: DbFamily;
    /** Only set for SQL databases. */
    sqlProvider?: SqlProvider;
}

export interface DbOrmOptions {
    database?: string;
    db?: string;
    orm?: string;
}

const DB_CHOICES = ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB'];
const ORM_CHOICES: Orm[] = ['prisma', 'typeorm', 'mongoose'];
const SQL_PROVIDERS: Record<string, SqlProvider> = {
    PostgreSQL: 'postgresql',
    MySQL: 'mysql',
    SQLite: 'sqlite',
};

/** Normalize a `--db` value to a canonical label (accepts the legacy `Mongoose`). */
function normalizeDb(input: string): string | null {
    const found = DB_CHOICES.find((d) => d.toLowerCase() === input.toLowerCase());
    if (found) return found;
    if (input.toLowerCase() === 'mongoose') return 'MongoDB';
    return null;
}

/**
 * Resolve the database + ORM from flags, prompting interactively for any value
 * that was not supplied.
 *
 * Selection model:
 *   - Database: PostgreSQL | MySQL | SQLite (SQL family) or MongoDB (mongo family).
 *   - ORM: SQL → Prisma | TypeORM; MongoDB → Mongoose (forced).
 *
 * Backward compatibility: when `--db` is given without `--orm`, a SQL database
 * defaults to Prisma and MongoDB defaults to Mongoose (the pre-`--orm` behavior).
 * The legacy `--db Mongoose` value is still accepted.
 */
export const resolveDatabaseAndOrm = async (
    options: DbOrmOptions,
): Promise<ResolvedDb> => {
    // 1. Resolve the database.
    const dbInput = options.database || options.db || '';
    let database = '';
    if (dbInput) {
        const norm = normalizeDb(dbInput);
        if (!norm) {
            console.error(
                chalk.red(`Invalid --database "${dbInput}". Valid options: ${DB_CHOICES.join(', ')}`),
            );
            process.exit(1);
        }
        database = norm;
    } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'database',
                message: 'Which database would you like to use?',
                choices: DB_CHOICES,
                default: 'MongoDB',
            },
        ]);
        database = answer.database;
    }

    const wasDbInteractive = !dbInput;
    const family: DbFamily = database === 'MongoDB' ? 'mongo' : 'sql';

    // 2. Resolve the ORM.
    const ormInput = (options.orm || '').toLowerCase();
    if (ormInput && !ORM_CHOICES.includes(ormInput as Orm)) {
        console.error(
            chalk.red(`Invalid --orm "${options.orm}". Valid options: prisma, typeorm, mongoose`),
        );
        process.exit(1);
    }

    let orm: Orm;
    if (family === 'mongo') {
        if (ormInput && ormInput !== 'mongoose') {
            console.error(
                chalk.red('MongoDB is only supported with Mongoose. TypeORM/Prisma support SQL databases (PostgreSQL, MySQL, SQLite).'),
            );
            process.exit(1);
        }
        orm = 'mongoose';
    } else {
        if (ormInput) {
            if (ormInput === 'mongoose') {
                console.error(
                    chalk.red('Mongoose is only supported with MongoDB. For SQL databases choose Prisma or TypeORM.'),
                );
                process.exit(1);
            }
            orm = ormInput as Orm;
        } else if (wasDbInteractive) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error inquirer prompt typing
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'orm',
                    message: 'Which ORM would you like to use?',
                    choices: ['Prisma', 'TypeORM'],
                    default: 'Prisma',
                },
            ]);
            orm = answer.orm.toLowerCase() as Orm;
        } else {
            // `--db <sql>` without `--orm` → preserve the original Prisma default.
            orm = 'prisma';
        }
    }

    const sqlProvider = family === 'sql' ? SQL_PROVIDERS[database] : undefined;
    return { database, orm, family, sqlProvider };
};
