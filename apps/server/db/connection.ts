import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | null = null;

/**
 * Opens a PostgreSQL connection pool using DATABASE_URL.
 * Returns a Drizzle instance with the full schema.
 */
export function openDb(databaseUrl: string): Database {
  pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}

export function closeDb(): Promise<void> {
  return pool ? pool.end() : Promise.resolve();
}
