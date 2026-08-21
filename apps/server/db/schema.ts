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
// Document model (chat-based, versioned deliverables). Documents are
// user-scoped and title-scoped; a conversation is a thread that can generate
// or reference many documents.
// ─────────────────────────────────────────────────────────────────────────────

/** prd | quotation | prototype | specs */
export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    currentVersionId: text("current_version_id"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (table) => ({
    userCreatedIdx: index("idx_documents_user_created").on(
      table.userId,
      table.createdAt,
    ),
    userTitleIdx: index("idx_documents_user_title").on(
      table.userId,
      table.title,
    ),
  }),
);

/** Immutable snapshot of a document (one per generation/revision). */
export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    versionNo: integer("version_no").notNull(),
    content: text("content").notNull(),
    promptUsed: text("prompt_used"),
    createdAt: ts("created_at").notNull(),
  },
  (table) => ({
    docVersionIdx: index("idx_document_versions_doc").on(
      table.documentId,
      table.versionNo,
    ),
  }),
);

/** Links a conversation (thread) to documents it generated or opened. */
export const conversationDocuments = pgTable(
  "conversation_documents",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    createdAt: ts("created_at").notNull(),
  },
  (table) => ({
    uniqueConvDoc: uniqueIndex("idx_conversation_documents_conv_doc").on(
      table.conversationId,
      table.documentId,
    ),
  }),
);

/** Files of a multi-file document (prototype HTML/CSS/JS). */
export const documentFiles = pgTable(
  "document_files",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    versionNo: integer("version_no").notNull().default(1),
    path: text("path").notNull(),
    content: text("content").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (table) => ({
    uniqueVersionPath: uniqueIndex("idx_document_files_version_path").on(
      table.documentId,
      table.versionNo,
      table.path,
    ),
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
