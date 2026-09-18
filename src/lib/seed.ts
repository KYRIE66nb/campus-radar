/**
 * 种子脚本：demo 评审账号 + 预置 7 天历史日报。
 *
 *   npm run seed            # 幂等：已有数据则跳过
 *   npm run seed -- --reset # 清空演示数据后重建
 *
 * 回填说明（诚实性）：
 *  - 条目来自脚本运行时的真实来源抓取（清华官网 + Google News RSS）+ 内置 Mock 论坛数据；
 *  - 过去 6 天的 runs/reports 为按日切片回填生成（is_backfill=true，界面标注「预置」）；
 *  - 其中 D-2 日模拟了一次清华官网获取失败（stats 中明确标注「回填演示」），
 *    用于演示"单来源失败不阻断日报"；
 *  - 今天的日报由真实 runPipeline(scheduled) 生成。
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  feedback,
  items,
  reports,
  runs,
  scheduledRuns,
  settings,
  sourceHealth,
  sourceState,
  topics,
  users,
  type RunStats,
} from "@/db/schema";
import { hashPassword, ensureSettings } from "@/lib/auth";
import { buildDailyView } from "@/lib/dailyView";
import { composeReport } from "@/lib/report";
import { ingestItems, runPipeline, type PreparedItem } from "@/lib/pipeline";
import { allSourceMetas, fetchAllSources, sourcesForSchool } from "@/lib/sources";
import { itemDay, lastNDays, shDay } from "@/lib/time";

const DEMO_EMAIL = "review@demo.campus";
const DEMO_PASSWORD = "demo1234";
const SCHOOL = "清华大学";

async function reset() {
  await db.delete(feedback);
  await db.delete(reports);
  await db.delete(runs);
  await db.delete(scheduledRuns);
  await db.delete(items);
  await db.delete(topics);
  await db.delete(sourceState);
  await db.delete(sourceHealth);
  await db.delete(settings);
  await db.delete(users);
  console.log("已清空全部数据");
}

export async function runSeed(doReset: boolean): Promise<void> {
  if (doReset) await reset();

  const existing = await db.select().from(users).where(sql`${users.email} = ${DEMO_EMAIL}`).limit(1);
  if (existing[0] && !doReset) {
    const hasReports = await db.select({ id: reports.id }).from(reports).limit(1);
    if (hasReports.length) {
      console.log("种子数据已存在，跳过（使用 --reset 重建）");
      return;
    }
  }

  // ---- 1. demo 账号 ----
  let user = existing[0];
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        passwordHash: await hashPassword(DEMO_PASSWORD),
        name: "评审演示账号",
        isDemo: true,
      })
      .returning();
  }
  const s = await ensureSettings(user.id);
  await db
    .update(settings)
    .set({
      school: SCHOOL,
      includeKeywords: ["食堂", "讲座", "校招", "AI"],
      excludeKeywords: [],
      recipientEmail: null,
      sendTime: "08:00",
      emailEnabled: true,
    })
    .where(sql`${settings.userId} = ${user.id}`);
  console.log(`demo 账号：${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  // ---- 2. 真实抓取一次（含 Mock），供回填切片 ----
  const now = new Date();
  const adapters = sourcesForSchool(SCHOOL);
  const outcomes = await fetchAllSources(adapters, { school: SCHOOL, now }, { fresh: true });
  for (const o of outcomes) {
    console.log(`  来源 ${o.name}: ${o.ok ? `ok ${o.items.length} 条` : `失败 ${o.error}`}`);
  }

  // 写 sourceState（当前真实状态）
  for (const o of outcomes) {
    await db
      .insert(sourceState)
      .values({
        sourceId: o.sourceId,
        lastStatus: o.ok ? "ok" : "fail",
        lastRunAt: now,
        lastOkAt: o.ok ? now : null,
        lastFailAt: o.ok ? null : now,
        lastError: o.ok ? null : o.error,
        consecutiveFails: o.ok ? 0 : 1,
        totalOk: o.ok ? 1 : 0,
        totalFail: o.ok ? 0 : 1,
      })
      .onConflictDoUpdate({
        target: sourceState.sourceId,
        set: o.ok
          ? { lastStatus: "ok", lastRunAt: now, lastOkAt: now, consecutiveFails: 0, totalOk: sql`${sourceState.totalOk} + 1` }
          : { lastStatus: "fail", lastRunAt: now, lastFailAt: now, lastError: o.error, consecutiveFails: sql`${sourceState.consecutiveFails} + 1`, totalFail: sql`${sourceState.totalFail} + 1` },
      });
  }

  const include = ["食堂", "讲座", "校招", "AI"];
  const days = lastNDays(7, shDay(now)); // 旧 → 新，最后一个是今天
  const today = days[days.length - 1];
  const SIM_FAIL_DAY = days[days.length - 3]; // D-2：模拟官网失败的演示日
  const metas = allSourceMetas(SCHOOL);
  const outcomeBySource = new Map(outcomes.map((o) => [o.sourceId, o]));

  for (const day of days) {
    if (day === today) break; // 今天由真实 runPipeline 生成

    const dayEnd = new Date(`${day}T23:00:00+08:00`);
    // 该日"到达"的条目：真实条目按发布日切片 + Mock 条目按编排日切片
    const rowsForDay: PreparedItem[] = [];
    for (const o of outcomes) {
      for (const it of o.items) {
        const d = itemDay(it.publishedAt, now);
        if (d !== day) continue;
        if (o.sourceId === "thu-official" && day === SIM_FAIL_DAY) continue; // 模拟该日失败：不入库
        rowsForDay.push({ sourceId: it.sourceId, title: it.title, url: it.url, publishedAt: it.publishedAt, day: d, isMock: it.isMock });
      }
    }
    const ingest = await ingestItems(SCHOOL, rowsForDay, dayEnd);

    // ---- 组装该日 stats ----
    const statsSources: RunStats["sources"] = metas.map((m) => {
      const outcome = outcomeBySource.get(m.id);
      const isTieba = m.id === "tieba";
      const simFail = m.id === "thu-official" && day === SIM_FAIL_DAY;
      const count = isTieba || simFail ? 0 : rowsForDay.filter((r) => r.sourceId === m.id).length;
      return {
        sourceId: m.id,
        name: m.name,
        ok: !(isTieba || simFail),
        count,
        newCount: (ingest.newBySource.get(m.id) ?? 0),
        durationMs: outcome?.durationMs ?? 800,
        error: isTieba
          ? "HTTP 403：触发反爬安全验证（预期内，降级跳过）"
          : simFail
            ? "回填演示：模拟该日官网请求超时，已降级跳过（非真实故障）"
            : undefined,
        isMock: m.kind === "mock",
      };
    });
    const stats: RunStats = {
      sources: statsSources,
      totalFetched: rowsForDay.length,
      totalNew: ingest.insertedCount,
      okSources: statsSources.filter((x) => x.ok).length,
      failSources: statsSources.filter((x) => !x.ok).length,
      topicsNew: 0,
      topicsUpdated: 0,
      topicsOngoing: 0,
      topicsLow: 0,
    };

    // ---- 视图 + 日报 ----
    const view = await buildDailyView(SCHOOL, day, include, []);
    stats.topicsNew = view.topics.filter((t) => t.status === "new").length;
    stats.topicsUpdated = view.topics.filter((t) => t.status === "updated").length;
    stats.topicsOngoing = view.topics.filter((t) => t.status === "ongoing").length;
    stats.topicsLow = view.topics.filter((t) => t.status === "low").length;

    const runAt = new Date(`${day}T08:00:00+08:00`);
    const [run] = await db
      .insert(runs)
      .values({
        userId: user.id,
        trigger: "scheduled",
        reportDate: day,
        startedAt: runAt,
        finishedAt: new Date(runAt.getTime() + 30000),
        status: "success",
        stats,
        isBackfill: true,
      })
      .returning();

    const composed = composeReport({
      school: SCHOOL,
      today: day,
      topics: view.topics,
      stats,
      sourceInfo: view.sourceInfo,
      includeKeywords: include,
    });
    await db.insert(reports).values({
      userId: user.id,
      runId: run.id,
      reportDate: day,
      status: "skipped_backfill",
      emailStatus: "skipped_backfill",
      subject: composed.subject,
      html: composed.html,
      textContent: composed.text,
      topicCounts: composed.counts,
      isBackfill: true,
    });
    await db.insert(scheduledRuns).values({ userId: user.id, reportDate: day, runId: run.id }).onConflictDoNothing();

    // ---- 来源健康历史 ----
    for (const st of statsSources) {
      await db
        .insert(sourceHealth)
        .values({
          sourceId: st.sourceId,
          day,
          okCount: st.ok ? 1 : 0,
          failCount: st.ok ? 0 : 1,
          lastError: st.error,
        })
        .onConflictDoUpdate({
          target: [sourceHealth.sourceId, sourceHealth.day],
          set: st.ok
            ? { okCount: sql`${sourceHealth.okCount} + 1` }
            : { failCount: sql`${sourceHealth.failCount} + 1`, lastError: st.error },
        });
    }

    console.log(`  回填 ${day}: 新增条目 ${ingest.insertedCount}，话题 new=${stats.topicsNew} updated=${stats.topicsUpdated} ongoing=${stats.topicsOngoing} low=${stats.topicsLow}`);
  }

  // ---- 3. 今天：真实 scheduled 运行（不发邮件，收件箱未设置） ----
  const todayResult = await runPipeline({ userId: user.id, trigger: "scheduled", sendEmail: false, now });
  console.log(`  今日真实运行 runId=${todayResult.runId}：新增 ${todayResult.stats.totalNew} 条，话题 new=${todayResult.stats.topicsNew} updated=${todayResult.stats.topicsUpdated} ongoing=${todayResult.stats.topicsOngoing} low=${todayResult.stats.topicsLow}`);

  // 今日来源健康记录（runPipeline 内已更新 sourceState，这里补 health 当日计数）
  for (const st of todayResult.stats.sources) {
    await db
      .insert(sourceHealth)
      .values({ sourceId: st.sourceId, day: today, okCount: st.ok ? 1 : 0, failCount: st.ok ? 0 : 1, lastError: st.error })
      .onConflictDoUpdate({
        target: [sourceHealth.sourceId, sourceHealth.day],
        set: st.ok
          ? { okCount: sql`${sourceHealth.okCount} + 1` }
          : { failCount: sql`${sourceHealth.failCount} + 1`, lastError: st.error },
      });
  }

  console.log("\n种子完成 ✓  demo 登录：review@demo.campus / demo1234");
}
