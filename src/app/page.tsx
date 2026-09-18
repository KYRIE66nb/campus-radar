import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, runs, sourceState } from "@/db/schema";
import { ensureSettings, getSessionUser } from "@/lib/auth";
import { buildDailyView } from "@/lib/dailyView";
import { allSourceMetas } from "@/lib/sources";
import { fmtDateTimeSH, shToday } from "@/lib/time";
import RunButton from "@/components/RunButton";
import { TopicSection } from "@/components/TopicList";
import type { TopicStatus } from "@/lib/classify";

export const dynamic = "force-dynamic";

const EMAIL_LABEL: Record<string, string> = {
  sent: "已发送",
  dry_run: "dry-run（未实际发送）",
  failed: "发送失败",
  skipped_no_recipient: "未设置收件邮箱",
  skipped_disabled: "邮件开关关闭",
  skipped_cap: "达每日上限",
  skipped: "未发送",
  skipped_backfill: "预置数据（未发送）",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const s = await ensureSettings(user.id);

  const [latestRuns, states, latestReports] = await Promise.all([
    db.select().from(runs).where(eq(runs.userId, user.id)).orderBy(desc(runs.id)).limit(1),
    db.select().from(sourceState),
    db.select().from(reports).where(eq(reports.userId, user.id)).orderBy(desc(reports.id)).limit(1),
  ]);
  const latestRun = latestRuns[0];
  const latestReport = latestReports[0];
  const stateById = new Map(states.map((x) => [x.sourceId, x]));
  const metas = allSourceMetas(s.school);

  const today = shToday();
  const view = await buildDailyView(s.school, today, s.includeKeywords ?? [], s.excludeKeywords ?? []);
  const by = (st: TopicStatus) => view.topics.filter((t) => t.status === st);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            {s.school} · 今日热点 <span className="ml-1 text-sm font-normal text-slate-400">{today}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            关注关键词：{s.includeKeywords?.length ? s.includeKeywords.join("、") : "（未设置，展示全部）"}
            {s.excludeKeywords?.length ? `　排除：${s.excludeKeywords.join("、")}` : ""}
          </p>
        </div>
        <RunButton hasRecipient={!!s.recipientEmail} emailEnabled={s.emailEnabled} />
      </div>

      {/* 运行状态总览 */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="最近运行"
          value={latestRun ? fmtDateTimeSH(latestRun.startedAt) : "尚未运行"}
          sub={latestRun ? `${latestRun.trigger === "manual" ? "手动" : "定时"} · ${latestRun.status === "success" ? "成功" : latestRun.status}` : "点击上方按钮立即运行"}
        />
        <StatCard
          title="本次获取 / 新增"
          value={latestRun ? `${latestRun.stats.totalFetched} / ${latestRun.stats.totalNew} 条` : "—"}
          sub={latestRun ? `来源 ${latestRun.stats.okSources} 成功 / ${latestRun.stats.failSources} 失败` : ""}
        />
        <StatCard
          title="今日话题分布"
          value={`${by("new").length} / ${by("updated").length} / ${by("ongoing").length} / ${by("low").length}`}
          sub="新出现 / 重要更新 / 持续 / 低相关"
        />
        <StatCard
          title="邮件日报"
          value={latestReport ? EMAIL_LABEL[latestReport.emailStatus ?? ""] ?? latestReport.emailStatus ?? "—" : "—"}
          sub={latestReport?.emailError ? latestReport.emailError : `${s.emailEnabled ? "已启用" : "已关闭"} · 发送时间 ${s.sendTime}`}
          danger={latestReport?.emailStatus === "failed"}
        />
      </div>

      {/* 来源状态 */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-slate-600">来源状态（{s.school}）</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metas.map((m) => {
            const st = stateById.get(m.id);
            const ok = st?.lastStatus === "ok";
            const fail = st?.lastStatus === "fail";
            return (
              <div key={m.id} className={`rounded-xl border p-3 text-sm ${m.kind === "mock" ? "border-purple-200 bg-purple-50/40" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : fail ? "bg-red-500" : "bg-slate-300"}`} />
                    {m.name}
                  </span>
                  {m.kind === "mock" && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">Mock</span>}
                  {m.id === "tieba" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">受限演示</span>}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {st ? `最近运行 ${fmtDateTimeSH(st.lastRunAt)} · 累计成功 ${st.totalOk} / 失败 ${st.totalFail}` : "本会话尚未运行"}
                </p>
                {fail && st?.lastError && <p className="mt-1 text-xs text-red-600">{st.lastError}（已跳过，不阻断日报）</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          各来源获取方式、访问限制与失败策略见 <Link href="/sources" className="text-blue-600 hover:underline">来源说明页</Link>。
        </p>
      </section>

      {/* 今日热点四分区 */}
      <TopicSection status="new" topics={by("new")} sourceInfo={view.sourceInfo} limit={12} />
      <TopicSection status="updated" topics={by("updated")} sourceInfo={view.sourceInfo} limit={8} />
      <TopicSection status="ongoing" topics={by("ongoing")} sourceInfo={view.sourceInfo} limit={8} />
      <TopicSection status="low" topics={by("low")} sourceInfo={view.sourceInfo} limit={20} />

      {view.topics.length === 0 && (
        <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm leading-7 text-emerald-800">
          <p className="font-bold">今天还没有数据</p>
          <p>点击右上角「立即运行一次」抓取来源并生成今日热点；或到历史日报查看预置数据。</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub, danger }: { title: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className={`mt-1 text-lg font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
