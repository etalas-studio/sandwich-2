import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// All timestamps are real `timestamptz` columns. We keep Drizzle in
// "string" mode so app code continues to pass ISO-8601 strings in/out
// (Postgres stores true timezone-aware values; node-postgres returns
// strings instead of Date objects).
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  // "user" | "admin" — admin gates the internal operator panel (/admin).
  role: text("role").notNull().default("user"),
  createdAt: ts("created_at").notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull(),
    expiresAt: ts("expires_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_sessions_user_id").on(table.userId),
  }),
);

/**
 * A project: one on-disk directory + git repo, owning many conversations and
 * many documents. Created implicitly on the first chat (see the auto-create in
 * `createConversation`) and renameable afterwards.
 */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (table) => ({
    userCreatedIdx: index("idx_projects_user_created").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

/**
 * A chat session + its generated document: a title/prompt, an optional
 * AI-generated `output`, and a multi-turn message history (see `chatMessages`).
 */
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    idOld: text("id_old"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // Nullable during rollout; backfilled to one project per conversation by
    // migration 0021. Every conversation created after that always has one.
    projectId: text("project_id").references(() => projects.id),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    // Guided-pipeline state machine (model-driven):
    // intake → choosing_deliverable → clarifying → generating → awaiting_next
    pipelineStage: text("pipeline_stage").notNull().default("intake"),
    // Deliverable being worked on (prd | quotation | prototype | specs).
    pendingType: text("pending_type"),
    // like | dislike | null
    feedback: text("feedback"),
    pinned: boolean("pinned").notNull().default(false),
    unread: boolean("unread").notNull().default(false),
    // null = private; non-null = public read-only share link
    shareToken: text("share_token").unique(),
    sharedAt: ts("shared_at"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (table) => ({
    userCreatedIdx: index("idx_conversations_user_created").on(
      table.userId,
      table.createdAt,
    ),
    projectCreatedIdx: index("idx_conversations_project_created").on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    // Nullable — set only on assistant messages that generated a document.
    documentId: text("document_id").references(() => documents.id),
    createdAt: ts("created_at").notNull(),
  },
  (table) => ({
    conversationCreatedIdx: index("idx_chat_messages_conversation_created").on(
      table.conversationId,
      table.createdAt,
    ),
  }),
);

/**
 * Uploaded files (screenshots, voice notes, docs). Bytes live in object
 * storage (Cloudflare R2); this table stores only metadata.
 */
export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  conversationId: text("conversation_id").references(() => conversations.id),
  messageId: text("message_id").references(() => chatMessages.id),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  // Extraction pipeline output (image/audio/pdf/docx -> text for the AI).
  extractedText: text("extracted_text"),
  extractStatus: text("extract_status").notNull().default("pending"),
  createdAt: ts("created_at").notNull(),
});

export const payments = pgTable("payments", {
  orderId: text("order_id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  planSlug: text("plan_slug"),
  // Local state machine (creating_payment → awaiting_payment → paid/…)
  localStatus: text("local_status").notNull().default("creating_payment"),
  transactionStatus: text("transaction_status").notNull().default("pending"),
  statusCode: text("status_code").notNull().default("0"),
  grossAmount: text("gross_amount").notNull(),
  paymentType: text("payment_type"),
  fraudStatus: text("fraud_status"),
  snapToken: text("snap_token"),
  redirectUrl: text("redirect_url"),
  // Raw (verified) notification payload JSON — persisted so pending
  // payments (VA number / QR / payment code) can be recovered after refresh.
  providerData: text("provider_data"),
  expiresAt: ts("expires_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  planSlug: text("plan_slug").notNull(),
  status: text("status").notNull().default("active"),
  periodDays: integer("period_days").notNull().default(30),
  // null only for legacy rows; new rows always set a concrete expiry.
  expiresAt: ts("expires_at"),
  startedAt: ts("started_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const usage = pgTable(
  "usage",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    yearMonth: text("year_month").notNull(),
    // prd = document quota, chat = follow-up message quota
    kind: text("kind").notNull().default("prd"),
    count: integer("count").notNull().default(0),
  },
  (table) => ({
    uniqueUserMonthKind: uniqueIndex("idx_usage_user_month_kind").on(
      table.userId,
      table.yearMonth,
      table.kind,
    ),
  }),
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => ({
    uniqueUserKey: uniqueIndex("idx_user_prefs_user_key").on(
      table.userId,
      table.key,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Admin / integrations config (Etalas operator panel).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AI-provider credentials (API keys, base URLs) keyed by provider id, mirroring
 * Pi's auth.json shape so the DB can back Pi's CredentialStore. Values are
 * JSON-serialized pi-ai Credentials; special names like `9router:baseUrl` hold
 * provider-scoped config strings.
 */
export const integrationCredentials = pgTable("integration_credentials", {
  name: text("name").primaryKey(),
  value: text("value").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

/**
 * Per-stage engine selection (provider/model strings) editable from the admin
 * panel without redeploying. Keys: engine.chat | engine.prototype |
 * engine.glowup | engine.vision.
 */
export const engineSettings = pgTable("engine_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Document model. A document is an INDEX ROW pointing at a file on disk in the
// project's git repo — Postgres stores no content. One document per (project,
// type); `conversation_id` records where it was last generated. Version history
// lives in git (see `last_commit_sha`).
// ─────────────────────────────────────────────────────────────────────────────

/** prd | quotation | prototype | specs | mom */
export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    // "generated in" — nullable so deleting a conversation doesn't delete the file.
    conversationId: text("conversation_id").references(() => conversations.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    // Path relative to the project root, e.g. "prd.md" / "prototype/index.html".
    relativePath: text("relative_path").notNull(),
    // Latest git commit that touched this file; null until the first commit.
    lastCommitSha: text("last_commit_sha"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (table) => ({
    // One deliverable of each type per project (M2-03). Also the upsert target.
    projectTypeIdx: uniqueIndex("idx_documents_project_type").on(
      table.projectId,
      table.type,
    ),
    projectUpdatedIdx: index("idx_documents_project_updated").on(
      table.projectId,
      table.updatedAt,
    ),
    conversationIdx: index("idx_documents_conversation").on(table.conversationId),
  }),
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: ts("created_at").notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: ts("created_at").notNull(),
});
