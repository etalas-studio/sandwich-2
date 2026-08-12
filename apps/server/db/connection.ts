import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Opens a PostgreSQL connection using DATABASE_URL.
 * Returns a Drizzle instance with the full schema.
 */
export function openDb(databaseUrl: string): Database {
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}
