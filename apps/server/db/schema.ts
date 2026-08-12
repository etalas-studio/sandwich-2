import { pgTable, text, serial, integer, real, uniqueIndex, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => ({
  userIdIdx: index("idx_sessions_user_id").on(table.userId),
}));

export const instanceSettings = pgTable("instance_settings", {
  id: serial("id").primaryKey(),
  repoPath: text("repo_path"),
  firstRunCompletedAt: text("first_run_completed_at"),
});

export const tickets = pgTable("tickets", {
  key: text("key").primaryKey(),
  type: text("type"),
  summary: text("summary"),
  description: text("description").notNull(),
  url: text("url"),
  status: text("status").notNull().default("backlog"),
  stage: text("stage"),
  needsHumanCategory: text("needs_human_category"),
  needsHumanReason: text("needs_human_reason"),
  prUrl: text("pr_url"),
  prSummary: text("pr_summary"),
  prTitle: text("pr_title"),
  prDescription: text("pr_description"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  worktreePath: text("worktree_path"),
  branchName: text("branch_name"),
  quickWinChoices: text("quick_win_choices"),
  quickWinAttempts: integer("quick_win_attempts").notNull().default(0),
  issueType: text("issue_type"),
  priority: text("priority"),
  sprint: text("sprint"),
  storyPoints: real("story_points"),
  team: text("team"),
  assignee: text("assignee"),
  parentKey: text("parent_key"),
  attachments: text("attachments"),
  jiraStatus: text("jira_status"),
  feedback: text("feedback"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const payments = pgTable("payments", {
  orderId: text("order_id").primaryKey(),
  transactionStatus: text("transaction_status").notNull(),
  statusCode: text("status_code").notNull(),
  grossAmount: text("gross_amount").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  planSlug: text("plan_slug").notNull(),
  status: text("status").notNull().default("active"),
  startedAt: text("started_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => tickets.key),
  role: text("role").notNull(),
  content: text("content").notNull(),
  stage: text("stage"),
  createdAt: text("created_at").notNull(),
});

export const usage = pgTable("usage", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  yearMonth: text("year_month").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => ({
  uniqueUserMonth: uniqueIndex("idx_usage_user_month").on(table.userId, table.yearMonth),
}));

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (table) => ({
  uniqueUserKey: uniqueIndex("idx_user_prefs_user_key").on(table.userId, table.key),
}));

export const prototypes = pgTable("prototypes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  shareId: text("share_id").notNull().unique(),
  name: text("name").notNull(),
  brief: text("brief").notNull(),
  logoData: text("logo_data"),
  palette: text("palette"),
  status: text("status").notNull().default("generating"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const prototypeFiles = pgTable("prototype_files", {
  id: serial("id").primaryKey(),
  prototypeId: text("prototype_id").notNull().references(() => prototypes.id),
  path: text("path").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  uniquePath: uniqueIndex("idx_prototype_files_path").on(table.prototypeId, table.path),
}));
