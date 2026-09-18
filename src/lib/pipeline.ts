import { and, desc, eq, gte, inArray, like, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  items,
  reports,
  runs,
  scheduledRuns,
  settings,
  sourceHealth,
  sourceState,
  topics,
  type RunStats,
} from "@/db/schema";
import { ensureSettings } from "./auth";
import { buildDailyView } from "./dailyView";
import { clusterItems } from "./dedupe";
import { enhanceSummaries } from "./llm";
import { sendMail } from "./mailer";
import { composeReport } from "./report";
import { fetchAllSources, sourcesForSchool, allSourceMetas } from "./sources";
import { itemDay, shDay, shiftDay } from "./time";

export const DAILY_EMAIL_CAP = 5;

export interface RunOptions {
  userId: number;
  trigger: "manual" | "scheduled";
  /** 默认：设置了收件邮箱且启用开关则发送 */
  sendEmail?: boolean;
  now?: Date;
}

export interface RunResult {
  runId: number;
  reportId: number | null;
  reportDate: string;
  stats: RunStats;
  emailStatus: string | null;
  emailError: string | null;
  subject: string | null;
  skipped: boolean;
}

const EMPTY_STATS: RunStats = {
  sources: [],
  totalFetched: 0,
  totalNew: 0,
  okSources: 0,
  failSources: 0,
  topicsNew: 0,
  topicsUpdated: 0,
  topicsOngoing: 0,
  topicsLow: 0,
};

export interface PreparedItem {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  day: string;
  isMock: boolean;
}

/**
 * 入库 + 聚类（pipeline 与历史回填共用）：
 * 插入未入库条目 → 与近 14 天活跃话题聚类 → 建新话题或并入旧话题。
 */
export async function ingestItems(
  school: string,
  rows: PreparedItem[],
  now: Date,
): Promise<{ insertedCount: number; newBySource: Map<string, number> }> {
  const inserted = rows.length
    ? await db
        .insert(items)
        .values(rows.map((r) => ({ ...r, fetchedAt: now })))
        .onConflictDoNothing({ target: [items.sourceId, items.url] })
        .returning({ id: items.id, sourceId: items.sourceId, title: items.title, url: items.url, publishedAt: items.publishedAt, day: items.day })
    : [];

  const newBySource = new Map<string, number>();
  for (const r of inserted) newBySource.set(r.sourceId, (newBySource.get(r.sourceId) ?? 0) + 1);

  const sourceKindById = Object.fromEntries(
    allSourceMetas(school).map((a) => [a.id, a.kind as string]),
  );

  const candidateTopics = await db
    .select()
    .from(topics)
    .where(and(eq(topics.school, school), eq(topics.active, true), gte(topics.lastSeenAt, new Date(now.getTime() - 14 * 86400000))))
    .limit(1000);
  const candIds = candidateTopics.map((t) => t.id);
  const candItems = candIds.length
    ? await db
        .select({ topicId: items.topicId, title: items.title, url: items.url })
        .from(items)
        .where(inArray(items.topicId, candIds))
        .limit(4000)
    : [];
  const candidates = candItems
    .filter((c) => c.topicId != null)
    .map((c) => ({ key: String(c.topicId), title: c.title, url: c.url }));

  const newItemsForCluster = inserted.map((r) => ({
    dbId: r.id,
    title: r.title,
    url: r.url,
    day: r.day,
    sourceId: r.sourceId,
    publishedAt: r.publishedAt,
    sourceKindRank:
      sourceKindById[r.sourceId] === "official" ? 3 : sourceKindById[r.sourceId] === "media" ? 2 : sourceKindById[r.sourceId] === "mock" ? 0 : 1,
  }));
  const { assignment, newTopics } = clusterItems(newItemsForCluster, candidates);

  const newKeyToId = new Map<string, number>();
  for (const [key, title] of newTopics) {
    const members = newItemsForCluster.filter((m) => assignment.get(m) === key);
    const dayCounts: Record<string, number> = {};
    for (const m of members) dayCounts[m.day] = (dayCounts[m.day] ?? 0) + 1;
    const firstSeenAt =
      members
        .map((m) => m.publishedAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? now;
    const [t] = await db
      .insert(topics)
      .values({
        school,
        title,
        firstSeenAt,
        lastSeenAt: now,
        itemCount: members.length,
        dayCounts,
        sources: [...new Set(members.map((m) => m.sourceId))],
      })
      .returning({ id: topics.id });
    newKeyToId.set(key, t.id);
    for (const m of members) await db.update(items).set({ topicId: t.id }).where(eq(items.id, m.dbId));
  }

  const existingKeyToId = new Map(candidateTopics.map((t) => [String(t.id), t.id]));
  const mergedByTopic = new Map<number, typeof newItemsForCluster>();
  for (const m of newItemsForCluster) {
    const key = assignment.get(m);
    if (!key) continue;
    const tid = existingKeyToId.get(key) ?? newKeyToId.get(key);
    if (!tid || newTopics.has(key)) continue;
    const list = mergedByTopic.get(tid) ?? [];
    list.push(m);
    mergedByTopic.set(tid, list);
  }
  for (const [tid, members] of mergedByTopic) {
    const t = candidateTopics.find((c) => c.id === tid)!;
    const dayCounts = { ...(t.dayCounts ?? {}) };
    for (const m of members) dayCounts[m.day] = (dayCounts[m.day] ?? 0) + 1;
    await db
      .update(topics)
      .set({
        itemCount: (t.itemCount ?? 0) + members.length,
        dayCounts,
        sources: [...new Set([...(t.sources ?? []), ...members.map((m) => m.sourceId)])],
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(topics.id, tid));
    for (const m of members) await db.update(items).set({ topicId: tid }).where(eq(items.id, m.dbId));
  }

  return { insertedCount: inserted.length, newBySource };
}

export async function runPipeline(opts: RunOptions): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const today = shDay(now);
  const s = await ensureSettings(opts.userId);

  // ---- 幂等：scheduled 每 (user, date) 只执行一次 ----
  if (opts.trigger === "scheduled") {
    const claimed = await db
      .insert(scheduledRuns)
      .values({ userId: opts.userId, reportDate: today })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) {
      const existing = await db
        .select()
        .from(reports)
        .where(and(eq(reports.userId, opts.userId), eq(reports.reportDate, today)))
        .orderBy(desc(reports.id))
        .limit(1);
      const r = existing[0];
      return {
        runId: 0,
        reportId: r?.id ?? null,
        reportDate: today,
        stats: EMPTY_STATS,
        emailStatus: r?.emailStatus ?? null,
        emailError: r?.emailError ?? null,
        subject: r?.subject ?? null,
        skipped: true,
      };
    }
  }

  const [run] = await db
    .insert(runs)
    .values({ userId: opts.userId, trigger: opts.trigger, reportDate: today, status: "running", stats: EMPTY_STATS })
    .returning();

  try {
    const adapters = sourcesForSchool(s.school);

    // ---- 1. 抓取全部来源（单源失败不阻断） ----
    const outcomes = await fetchAllSources(adapters, { school: s.school, now });
    for (const o of outcomes) {
      if (o.cached) continue; // 缓存命中不更新健康状态
      const day = today;
      if (o.ok) {
        await db
          .insert(sourceState)
          .values({
            sourceId: o.sourceId,
            lastStatus: "ok",
            lastRunAt: now,
            lastOkAt: now,
            consecutiveFails: 0,
            totalOk: 1,
            totalFail: 0,
          })
          .onConflictDoUpdate({
            target: sourceState.sourceId,
            set: {
              lastStatus: "ok",
              lastRunAt: now,
              lastOkAt: now,
              consecutiveFails: 0,
              totalOk: sql`${sourceState.totalOk} + 1`,
            },
          });
        await db
          .insert(sourceHealth)
          .values({ sourceId: o.sourceId, day, okCount: 1 })
          .onConflictDoUpdate({
            target: [sourceHealth.sourceId, sourceHealth.day],
            set: { okCount: sql`${sourceHealth.okCount} + 1` },
          });
      } else {
        await db
          .insert(sourceState)
          .values({
            sourceId: o.sourceId,
            lastStatus: "fail",
            lastRunAt: now,
            lastFailAt: now,
            lastError: o.error ?? "未知错误",
            consecutiveFails: 1,
            totalOk: 0,
            totalFail: 1,
          })
          .onConflictDoUpdate({
            target: sourceState.sourceId,
            set: {
              lastStatus: "fail",
              lastRunAt: now,
              lastFailAt: now,
              lastError: o.error ?? "未知错误",
              consecutiveFails: sql`${sourceState.consecutiveFails} + 1`,
              totalFail: sql`${sourceState.totalFail} + 1`,
            },
          });
        await db
          .insert(sourceHealth)
          .values({ sourceId: o.sourceId, day, failCount: 1, lastError: o.error ?? "未知错误" })
          .onConflictDoUpdate({
            target: [sourceHealth.sourceId, sourceHealth.day],
            set: {
              failCount: sql`${sourceHealth.failCount} + 1`,
              lastError: o.error ?? "未知错误",
            },
          });
      }
    }

    // ---- 2. 关键词过滤 + 新鲜度窗口（近 48 小时）→ 入库 + 聚类 ----
    // 日报只关心"新发生的事"：来源列表页里更旧的条目直接跳过，
    // 避免"旧闻与新事件混杂"（更早的历史由每日运行自然沉淀）。
    const exclude = (s.excludeKeywords ?? []).filter(Boolean);
    const include = (s.includeKeywords ?? []).filter(Boolean);
    const windowStart = shiftDay(today, -1);
    const insertRows: PreparedItem[] = outcomes.flatMap((o) =>
      o.items
        .filter((it) => {
          if (exclude.length === 0) return true;
          const lower = it.title.toLowerCase();
          return !exclude.some((k) => lower.includes(k.toLowerCase()));
        })
        .map((it) => ({
          sourceId: it.sourceId,
          title: it.title,
          url: it.url,
          publishedAt: it.publishedAt,
          day: itemDay(it.publishedAt, now),
          isMock: it.isMock,
        }))
        .filter((r) => r.day >= windowStart),
    );
    const ingest = await ingestItems(s.school, insertRows, now);

    // ---- 4. 构建当日视图 + 分类 ----
    const view = await buildDailyView(s.school, today, include, exclude);
    for (const c of view.topics) {
      await db.update(topics).set({ lastStatus: c.status, heat: c.heat, updatedAt: now }).where(eq(topics.id, c.view.topicId));
    }

    const stats: RunStats = {
      sources: outcomes.map((o) => ({
        sourceId: o.sourceId,
        name: o.name,
        ok: o.ok,
        count: insertRows.filter((r) => r.sourceId === o.sourceId).length,
        newCount: ingest.newBySource.get(o.sourceId) ?? 0,
        durationMs: o.durationMs,
        error: o.error,
        isMock: o.isMock,
      })),
      totalFetched: insertRows.length,
      totalNew: ingest.insertedCount,
      okSources: outcomes.filter((o) => o.ok).length,
      failSources: outcomes.filter((o) => !o.ok).length,
      topicsNew: view.topics.filter((t) => t.status === "new").length,
      topicsUpdated: view.topics.filter((t) => t.status === "updated").length,
      topicsOngoing: view.topics.filter((t) => t.status === "ongoing").length,
      topicsLow: view.topics.filter((t) => t.status === "low").length,
    };

    // ---- 5. LLM 增强（可选，失败回退规则式） ----
    const summaries = await enhanceSummaries(view.topics.filter((t) => t.status !== "low").slice(0, 12));

    const appUrl = process.env.APP_URL || "";
    const shareUrl = appUrl ? `${appUrl}/r/${s.shareToken}` : null;
    const composed = composeReport({
      school: s.school,
      today,
      topics: view.topics,
      stats,
      sourceInfo: view.sourceInfo,
      includeKeywords: include,
      appUrl,
      shareUrl,
      summaries: summaries ?? undefined,
    });

    const [report] = await db
      .insert(reports)
      .values({
        userId: opts.userId,
        runId: run.id,
        reportDate: today,
        status: "pending",
        subject: composed.subject,
        html: composed.html,
        textContent: composed.text,
        topicCounts: composed.counts,
      })
      .returning();

    // ---- 6. 邮件 ----
    let emailStatus: string | null = null;
    let emailError: string | null = null;
    const wantEmail = opts.sendEmail ?? (s.emailEnabled && !!s.recipientEmail);
    if (!s.emailEnabled) {
      emailStatus = "skipped_disabled";
    } else if (!s.recipientEmail) {
      emailStatus = "skipped_no_recipient";
    } else if (!wantEmail) {
      emailStatus = "skipped";
    } else {
      const sentToday = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(reports)
        .where(and(eq(reports.userId, opts.userId), eq(reports.reportDate, today), eq(reports.emailStatus, "sent")));
      if ((sentToday[0]?.n ?? 0) >= DAILY_EMAIL_CAP) {
        emailStatus = "skipped_cap";
        emailError = `每日最多发送 ${DAILY_EMAIL_CAP} 封，已达上限`;
      } else if (s.recipientEmail) {
        const r = await sendMail({ to: s.recipientEmail, subject: composed.subject, html: composed.html, text: composed.text });
        if (r.status === "sent") emailStatus = "sent";
        else if (r.status === "dry_run") emailStatus = "dry_run";
        else {
          emailStatus = "failed";
          emailError = r.error;
        }
      }
    }

    await db
      .update(reports)
      .set({ status: emailStatus === "sent" || emailStatus === "dry_run" ? emailStatus : emailStatus ?? "disabled", emailStatus, emailError })
      .where(eq(reports.id, report.id));

    await db
      .update(runs)
      .set({ status: "success", finishedAt: new Date(), stats })
      .where(eq(runs.id, run.id));

    return {
      runId: run.id,
      reportId: report.id,
      reportDate: today,
      stats,
      emailStatus,
      emailError,
      subject: composed.subject,
      skipped: false,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await db
      .update(runs)
      .set({ status: "failed", finishedAt: new Date(), stats: { ...EMPTY_STATS } })
      .where(eq(runs.id, run.id));
    throw e instanceof Error ? e : new Error(err);
  }
}

/** 定时调度：找出"当前上海小时 == 发送小时"的用户执行 scheduled 运行（ledger 幂等） */
export async function dispatchDueUsers(now: Date = new Date()): Promise<{
  hour: string;
  processed: { userId: number; runId: number; skipped: boolean; emailStatus: string | null }[];
}> {
  const hh = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const due = await db
    .select({ userId: settings.userId })
    .from(settings)
    .where(and(eq(settings.emailEnabled, true), like(settings.sendTime, `${hh}:%`)));
  const processed: { userId: number; runId: number; skipped: boolean; emailStatus: string | null }[] = [];
  for (const { userId } of due) {
    try {
      const r = await runPipeline({ userId, trigger: "scheduled", now });
      processed.push({ userId, runId: r.runId, skipped: r.skipped, emailStatus: r.emailStatus });
    } catch (e) {
      console.error(`[dispatch] user ${userId} failed:`, e);
      processed.push({ userId, runId: 0, skipped: false, emailStatus: "pipeline_failed" });
    }
  }
  return { hour: hh, processed };
}
