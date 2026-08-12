import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./apps/server/db/schema.ts",
  out: "./apps/server/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
