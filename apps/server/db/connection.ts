import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { join } from "node:path";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | null = null;

/**
 * Opens a PostgreSQL connection pool using DATABASE_URL, runs any pending
 * Drizzle migrations, and returns a typed Drizzle instance.
 *
 * Migrations are auto-run on every startup — safe and idempotent because
 * Drizzle tracks applied migrations in a `__drizzle_migrations` table.
 * No manual step needed before deploy.
 */
export async function openDb(databaseUrl: string): Promise<Database> {
  pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  const migrationsFolder = join(process.cwd(), "apps/server/db/drizzle");

  await migrate(db, { migrationsFolder });

  return db;
}

export function closeDb(): Promise<void> {
  return pool ? pool.end() : Promise.resolve();
}
