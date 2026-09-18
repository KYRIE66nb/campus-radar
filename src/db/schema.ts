import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  date,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  school: text("school").notNull().default("清华大学"),
  includeKeywords: jsonb("include_keywords").$type<string[]>().notNull().default([]),
  excludeKeywords: jsonb("exclude_keywords").$type<string[]>().notNull().default([]),
  recipientEmail: text("recipient_email"),
  sendTime: text("send_time").notNull().default("08:00"),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  shareToken: text("share_token").notNull().unique(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    school: text("school").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    why: text("why").notNull().default(""),
    // official | media | discussion | mock
    evidence: text("evidence").notNull().default("discussion"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    itemCount: integer("item_count").notNull().default(0),
    // { "2026-09-18": 3, ... } counts per Asia/Shanghai day
    dayCounts: jsonb("day_counts").$type<Record<string, number>>().notNull().default({}),
    // distinct source ids that reported this topic
    sources: jsonb("sources").$type<string[]>().notNull().default([]),
    heat: integer("heat").notNull().default(0),
    // last computed status: new | updated | ongoing | low
    lastStatus: text("last_status").notNull().default("new"),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("topics_school_idx").on(t.school, t.active)],
);

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    // Asia/Shanghai calendar day of publishedAt (or fetchedAt when unknown)
    day: date("day").notNull(),
    isMock: boolean("is_mock").notNull().default(false),
    topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("items_source_url_uq").on(t.sourceId, t.url),
    index("items_day_idx").on(t.day),
    index("items_topic_idx").on(t.topicId),
  ],
);

export const runs = pgTable(
  "runs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // manual | scheduled
    trigger: text("trigger").notNull(),
    reportDate: date("report_date").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // running | success | failed
    status: text("status").notNull().default("running"),
    // per-source stats + totals
    stats: jsonb("stats").$type<RunStats>().notNull(),
    isBackfill: boolean("is_backfill").notNull().default(false),
  },
  (t) => [index("runs_user_idx").on(t.userId, t.reportDate)],
);

// idempotency ledger: one scheduled pipeline per (user, date)
export const scheduledRuns = pgTable(
  "scheduled_runs",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportDate: date("report_date").notNull(),
    runId: integer("run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.reportDate] })],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    runId: integer("run_id").references(() => runs.id, { onDelete: "set null" }),
    reportDate: date("report_date").notNull(),
    // no_content | sent | send_failed | disabled | dry_run
    status: text("status").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    textContent: text("text_content").notNull(),
    emailStatus: text("email_status"), // sent | failed | dry_run | skipped | null
    emailError: text("email_error"),
    topicCounts: jsonb("topic_counts").$type<Record<string, number>>().notNull().default({}),
    shareVisible: boolean("share_visible").notNull().default(true),
    isBackfill: boolean("is_backfill").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_user_idx").on(t.userId, t.reportDate)],
);

export const sourceState = pgTable("source_state", {
  sourceId: text("source_id").primaryKey(),
  // ok | fail
  lastStatus: text("last_status").notNull(),
  lastError: text("last_error"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }).notNull().defaultNow(),
  lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
  lastFailAt: timestamp("last_fail_at", { withTimezone: true }),
  consecutiveFails: integer("consecutive_fails").notNull().default(0),
  totalOk: integer("total_ok").notNull().default(0),
  totalFail: integer("total_fail").notNull().default(0),
});

export const sourceHealth = pgTable(
  "source_health",
  {
    sourceId: text("source_id").notNull(),
    day: date("day").notNull(),
    okCount: integer("ok_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.day] })],
);

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  // not_interested | inaccurate
  kind: text("kind").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RunStats = {
  sources: {
    sourceId: string;
    name: string;
    ok: boolean;
    count: number;
    newCount: number;
    durationMs: number;
    error?: string;
    isMock: boolean;
  }[];
  totalFetched: number;
  totalNew: number;
  okSources: number;
  failSources: number;
  topicsNew: number;
  topicsUpdated: number;
  topicsOngoing: number;
  topicsLow: number;
};

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type SourceState = typeof sourceState.$inferSelect;
