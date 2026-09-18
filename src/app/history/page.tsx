import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, runs } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { fmtDateTimeSH } from "@/lib/time";
import { History, PlayCircle, Timer, CheckCircle2, XCircle, ChevronRight, MailCheck, MailX, MailMinus, FileArchive } from "lucide-react";

export const dynamic = "force-dynamic";

const EMAIL_BADGE: Record<string, { text: string; cls: string; icon: typeof MailCheck }> = {
  sent: { text: "邮件已发送", cls: "bg-emerald-50 text-emerald-700", icon: MailCheck },
  dry_run: { text: "dry-run", cls: "bg-amber-50 text-amber-700", icon: MailMinus },
  failed: { text: "邮件发送失败", cls: "bg-red-50 text-red-700", icon: MailX },
  skipped_no_recipient: { text: "未设收件邮箱", cls: "bg-slate-100 text-slate-600", icon: MailMinus },
  skipped_disabled: { text: "邮件开关关闭", cls: "bg-slate-100 text-slate-600", icon: MailMinus },
  skipped_backfill: { text: "预置数据", cls: "bg-slate-100 text-slate-600", icon: FileArchive },
  skipped: { text: "未发送", cls: "bg-slate-100 text-slate-600", icon: MailMinus },
};

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [reportRows, runRows] = await Promise.all([
    db.select().from(reports).where(eq(reports.userId, user.id)).orderBy(desc(reports.reportDate), desc(reports.id)).limit(30),
    db.select().from(runs).where(eq(runs.userId, user.id)).orderBy(desc(runs.id)).limit(20),
  ]);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-slate-400">可追溯</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">历史日报与运行记录</h1>
      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
        判断某天没有内容的原因：看当日来源统计 —— 全部正常 → 确实无新消息；有失败来源 → 数据不完整（日报会标注）。邮件失败也会如实记录，网页版始终可看。
      </p>

      <section className="mt-7" aria-label="每日日报">
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
            <History className="h-4 w-4 text-slate-400" aria-hidden="true" />
            每日日报
          </h2>
          <span className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
        </div>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {reportRows.length === 0 && <p className="p-6 text-sm text-slate-500">还没有日报，去首页点「立即运行一次」。</p>}
          {reportRows.map((r) => {
            const counts = (r.topicCounts ?? {}) as Record<string, number>;
            const empty = (counts.new ?? 0) + (counts.updated ?? 0) + (counts.ongoing ?? 0) + (counts.low ?? 0) === 0;
            const email = EMAIL_BADGE[r.emailStatus ?? ""];
            const EmailIcon = email?.icon ?? MailMinus;
            return (
              <Link
                key={r.id}
                href={`/report/${r.id}`}
                className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 text-sm transition-colors duration-200 hover:bg-slate-50"
              >
                <span className="w-[5.5rem] shrink-0 font-bold tabular-nums text-ink">{r.reportDate}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {r.subject.replace(/^【校园热点日报】[^·]+· [0-9-]+ · /, "")}
                </span>
                {empty && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    无新增热点（诚实结果）
                  </span>
                )}
                {email && (
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${email.cls}`}>
                    <EmailIcon className="h-3 w-3" aria-hidden="true" />
                    {email.text}
                  </span>
                )}
                {r.isBackfill && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">预置回填</span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8" aria-label="运行记录">
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
            <Timer className="h-4 w-4 text-slate-400" aria-hidden="true" />
            运行记录（每次抓取的来源统计）
          </h2>
          <span className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs text-slate-400">
                <th className="px-4 py-2.5 font-medium">时间</th>
                <th className="px-4 py-2.5 font-medium">触发</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">来源成功 / 失败</th>
                <th className="px-4 py-2.5 font-medium">获取 / 新增</th>
                <th className="px-4 py-2.5 font-medium">失败来源明细</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {runRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">暂无运行记录</td>
                </tr>
              )}
              {runRows.map((r) => {
                const failed = (r.stats?.sources ?? []).filter((s: any) => !s.ok);
                return (
                  <tr key={r.id} className="border-b border-slate-50 transition-colors duration-200 last:border-0 hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                      {r.reportDate}
                      <span className="ml-1.5 font-normal text-slate-400">{fmtDateTimeSH(r.startedAt).slice(6)}</span>
                      {r.isBackfill && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">预置</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1 text-slate-600">
                        {r.trigger === "manual" ? (
                          <>
                            <PlayCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />手动
                          </>
                        ) : (
                          <>
                            <Timer className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />定时
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === "success" ? (
                        <span className="flex items-center gap-1 font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />成功
                        </span>
                      ) : r.status === "failed" ? (
                        <span className="flex items-center gap-1 font-medium text-red-600">
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />{r.status}
                        </span>
                      ) : (
                        <span className="text-slate-500">{r.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-emerald-600">{r.stats?.okSources ?? 0}</span>
                      <span className="text-slate-300"> / </span>
                      <span className={r.stats?.failSources ? "font-medium text-red-600" : "text-slate-400"}>{r.stats?.failSources ?? 0}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.stats?.totalFetched ?? 0} <span className="text-slate-300">/</span> {r.stats?.totalNew ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-xs leading-5 text-amber-700">
                      {failed.length ? failed.map((f: any) => `${f.name}：${f.error}`).join("；") : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
