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
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // prd | mom | quotation | specs | prototype | workflow | general
    type: text("type").notNull().default("general"),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    // backlog | in_progress | done
    status: text("status").notNull().default("backlog"),
    // transient pipeline stage (used for streaming progress)
    stage: text("stage"),
    // generated document (markdown or HTML for prototypes)
    output: text("output"),
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
    id: serial("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
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
  messageId: integer("message_id").references(() => chatMessages.id),
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
  id: serial("id").primaryKey(),
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
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    yearMonth: text("year_month").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => ({
    uniqueUserMonth: uniqueIndex("idx_usage_user_month").on(
      table.userId,
      table.yearMonth,
    ),
  }),
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial("id").primaryKey(),
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

export const prototypes = pgTable("prototypes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  shareId: text("share_id").notNull().unique(),
  name: text("name").notNull(),
  brief: text("brief").notNull(),
  logoData: text("logo_data"),
  palette: text("palette"),
  status: text("status").notNull().default("generating"),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const prototypeFiles = pgTable(
  "prototype_files",
  {
    id: serial("id").primaryKey(),
    prototypeId: text("prototype_id")
      .notNull()
      .references(() => prototypes.id),
    path: text("path").notNull(),
    content: text("content").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (table) => ({
    uniquePath: uniqueIndex("idx_prototype_files_path").on(
      table.prototypeId,
      table.path,
    ),
  }),
);
