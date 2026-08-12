import type { Migration } from "./types.js";

export const migration0014Payments: Migration = {
  version: 14,
  name: "payments",
  sql: `
CREATE TABLE IF NOT EXISTS payments (
  order_id TEXT PRIMARY KEY,
  transaction_status TEXT NOT NULL,
  status_code TEXT NOT NULL,
  gross_amount TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`,
};
