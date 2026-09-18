import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, runs, sourceState } from "@/db/schema";
import { ensureSettings, getSessionUser } from "@/lib/auth";
import { buildDailyView } from "@/lib/dailyView";
import { sourcesForSchool } from "@/lib/sources";
import { fmtDateTimeSH, shToday } from "@/lib/time";
import RunButton from "@/components/RunButton";
import { TopicSection } from "@/components/TopicList";
import type { TopicStatus } from "@/lib/classify";
import {
  Activity,
  Download,
  LayoutGrid,
  Mail,
  MailCheck,
  MailX,
  CircleCheck,
  CircleX,
  Globe,
  Rss,
  MessageSquareWarning,
  FlaskConical,
  ShieldQuestion,
} from "lucide-react";

export const dynamic = "force-dynamic";

const EMAIL_LABEL: Record<string, { text: string; icon: typeof Mail; cls: string }> = {
  sent: { text: "已发送", icon: MailCheck, cls: "text-emerald-600" },
  dry_run: { text: "dry-run（未实际发送）", icon: Mail, cls: "text-amber-600" },
  failed: { text: "发送失败", icon: MailX, cls: "text-red-600" },
  skipped_no_recipient: { text: "未设置收件邮箱", icon: Mail, cls: "text-slate-500" },
  skipped_disabled: { text: "邮件开关关闭", icon: Mail, cls: "text-slate-500" },
  skipped_cap: { text: "达每日上限", icon: MailX, cls: "text-amber-600" },
  skipped: { text: "未发送", icon: Mail, cls: "text-slate-500" },
  skipped_backfill: { text: "预置数据（未发送）", icon: Mail, cls: "text-slate-500" },
};

const SOURCE_ICON: Record<string, typeof Globe> = {
  official: Globe,
  media: Rss,
  forum: MessageSquareWarning,
  mock: FlaskConical,
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
  // 驾驶舱只展示当前学校实际启用的来源；完整注册表（含其他学校的来源）在来源说明页
  const metas = sourcesForSchool(s.school);

  const today = shToday();
  const view = await buildDailyView(s.school, today, s.includeKeywords ?? [], s.excludeKeywords ?? []);
  const by = (st: TopicStatus) => view.topics.filter((t) => t.status === st);

  const emailMeta = latestReport ? EMAIL_LABEL[latestReport.emailStatus ?? ""] : undefined;
  const EmailIcon = emailMeta?.icon ?? ShieldQuestion;

  return (
    <div>
      {/* Hero 头部：学校 + 日期 + 主动作 */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-slate-200 pb-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">{today} · 每日自动追踪</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{s.school} 热点雷达</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            关注关键词：
            {s.includeKeywords?.length ? (
              s.includeKeywords.map((k) => (
                <span key={k} className="mx-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                  {k}
                </span>
              ))
            ) : (
              <span className="text-slate-400">未设置（在设置页添加，可个性化排序）</span>
            )}
            {s.excludeKeywords?.length ? <span className="ml-2 text-xs text-slate-400">排除：{s.excludeKeywords.join("、")}</span> : ""}
          </p>
        </div>
        <RunButton hasRecipient={!!s.recipientEmail} emailEnabled={s.emailEnabled} />
      </div>

      {/* 统计卡 */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          title="最近运行"
          value={latestRun ? fmtDateTimeSH(latestRun.startedAt) : "尚未运行"}
          sub={latestRun ? `${latestRun.trigger === "manual" ? "手动" : "定时"}触发 · ${latestRun.status === "success" ? "成功" : latestRun.status}` : "点击右上按钮立即运行"}
          tone={latestRun?.status === "failed" ? "danger" : "default"}
        />
        <StatCard
          icon={Download}
          title="获取 / 新增条目"
          value={latestRun ? `${latestRun.stats.totalFetched} / ${latestRun.stats.totalNew}` : "—"}
          sub={latestRun ? `来源 ${latestRun.stats.okSources} 成功 / ${latestRun.stats.failSources} 失败` : ""}
          tone={latestRun && latestRun.stats.failSources > 0 ? "warn" : "default"}
        />
        <StatCard
          icon={LayoutGrid}
          title="今日话题分布"
          value={
            <span className="tabular-nums">
              <DistNum n={by("new").length} cls="text-red-600" />
              <span className="mx-1 font-normal text-slate-300">/</span>
              <DistNum n={by("updated").length} cls="text-amber-600" />
              <span className="mx-1 font-normal text-slate-300">/</span>
              <DistNum n={by("ongoing").length} cls="text-blue-600" />
              <span className="mx-1 font-normal text-slate-300">/</span>
              <DistNum n={by("low").length} cls="text-slate-500" />
            </span>
          }
          sub="新出现 / 重要更新 / 持续 / 低相关"
        />
        <StatCard
          icon={EmailIcon}
          title="邮件日报"
          value={emailMeta?.text ?? "—"}
          sub={latestReport?.emailError ? latestReport.emailError : `${s.emailEnabled ? "已启用" : "已关闭"} · 每日 ${s.sendTime} 发送`}
          tone={latestReport?.emailStatus === "failed" ? "danger" : latestReport?.emailStatus === "sent" ? "ok" : "default"}
        />
      </div>

      {/* 来源状态 */}
      <section className="mt-8" aria-label="来源状态">
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="text-sm font-bold text-slate-700">来源状态</h2>
          <span className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
          <Link href="/sources" className="text-xs font-medium text-accent hover:underline">
            获取方式与限制说明 →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metas.map((m) => {
            const st = stateById.get(m.id);
            const ok = st?.lastStatus === "ok";
            const fail = st?.lastStatus === "fail";
            const Icon = SOURCE_ICON[m.kind] ?? Globe;
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-3.5 transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] ${
                  m.kind === "mock" ? "border-purple-200 bg-purple-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${m.kind === "mock" ? "text-purple-500" : "text-slate-400"}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{m.name}</span>
                  </span>
                  {ok && <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-label="正常" />}
                  {fail && <CircleX className="h-4 w-4 shrink-0 text-red-500" aria-label="失败" />}
                  {!st && <span className="text-xs text-slate-300">未运行</span>}
                </div>
                <p className="mt-2 text-xs tabular-nums text-slate-500">
                  {st ? `最近运行 ${fmtDateTimeSH(st.lastRunAt)} · 累计成功 ${st.totalOk} / 失败 ${st.totalFail}` : "本会话尚未运行"}
                </p>
                {fail && st?.lastError && (
                  <p className="mt-1.5 truncate text-xs text-red-600" title={`${st.lastError}（已跳过，不阻断日报）`}>
                    {st.lastError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 今日热点四分区 */}
      <TopicSection status="new" topics={by("new")} sourceInfo={view.sourceInfo} today={today} limit={12} />
      <TopicSection status="updated" topics={by("updated")} sourceInfo={view.sourceInfo} today={today} limit={8} />
      <TopicSection status="ongoing" topics={by("ongoing")} sourceInfo={view.sourceInfo} today={today} limit={8} />
      <TopicSection status="low" topics={by("low")} sourceInfo={view.sourceInfo} today={today} limit={20} />

      {view.topics.length === 0 && (
        <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm leading-7 text-emerald-800">
          <p className="font-bold">今天还没有数据</p>
          <p>点击上方「立即运行一次」抓取来源并生成今日热点；或到历史日报查看预置数据。</p>
        </div>
      )}
    </div>
  );
}

function DistNum({ n, cls }: { n: number; cls: string }) {
  return <span className={n > 0 ? cls : "text-slate-300"}>{n}</span>;
}

function StatCard({
  icon: Icon,
  title,
  value,
  sub,
  tone = "default",
}: {
  icon: typeof Activity;
  title: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const toneCls =
    tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "text-ink";
  const isTextValue = typeof value === "string" && value.length > 7;
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </p>
      <p
        className={`mt-1.5 truncate font-bold tabular-nums ${toneCls} ${isTextValue ? "text-[15px] leading-6" : "text-lg leading-7"}`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-auto truncate pt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
