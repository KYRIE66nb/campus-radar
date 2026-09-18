import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, runs } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { fmtDateTimeSH } from "@/lib/time";

export const dynamic = "force-dynamic";

const EMAIL_BADGE: Record<string, { text: string; cls: string }> = {
  sent: { text: "邮件已发送", cls: "bg-emerald-50 text-emerald-700" },
  dry_run: { text: "dry-run", cls: "bg-amber-50 text-amber-700" },
  failed: { text: "邮件发送失败", cls: "bg-red-50 text-red-700" },
  skipped_no_recipient: { text: "未设收件邮箱", cls: "bg-slate-100 text-slate-600" },
  skipped_disabled: { text: "邮件开关关闭", cls: "bg-slate-100 text-slate-600" },
  skipped_backfill: { text: "预置数据", cls: "bg-slate-100 text-slate-600" },
  skipped: { text: "未发送", cls: "bg-slate-100 text-slate-600" },
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
      <h1 className="text-xl font-bold">历史日报与运行记录</h1>
      <p className="mt-1 text-sm text-slate-500">
        判断某天没有内容的原因：看当日来源统计（全部正常 → 确实无新消息；有失败来源 → 数据不完整，日报会标注）。
      </p>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-slate-600">每日日报</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {reportRows.length === 0 && <p className="p-6 text-sm text-slate-500">还没有日报，去首页点「立即运行一次」。</p>}
          {reportRows.map((r) => {
            const counts = (r.topicCounts ?? {}) as Record<string, number>;
            const empty = (counts.new ?? 0) + (counts.updated ?? 0) + (counts.ongoing ?? 0) + (counts.low ?? 0) === 0;
            const email = EMAIL_BADGE[r.emailStatus ?? ""] ?? { text: r.emailStatus ?? "—", cls: "bg-slate-100 text-slate-600" };
            return (
              <Link key={r.id} href={`/report/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50">
                <span className="w-24 font-semibold text-slate-700">{r.reportDate}</span>
                <span className="flex-1 truncate text-slate-600">{r.subject.replace(/^【校园热点日报】[^·]+· [0-9-]+ · /, "")}</span>
                {empty && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">无新增热点（诚实结果）</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs ${email.cls}`}>{email.text}</span>
                {r.isBackfill && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">预置回填</span>}
                <span className="text-xs text-slate-400">查看 →</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-slate-600">运行记录（每次抓取的来源统计）</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="px-4 py-2.5">时间</th>
                <th className="px-4 py-2.5">触发</th>
                <th className="px-4 py-2.5">状态</th>
                <th className="px-4 py-2.5">来源成功/失败</th>
                <th className="px-4 py-2.5">获取/新增</th>
                <th className="px-4 py-2.5">失败来源明细</th>
              </tr>
            </thead>
            <tbody>
              {runRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">暂无运行记录</td></tr>
              )}
              {runRows.map((r) => {
                const failed = (r.stats?.sources ?? []).filter((s: any) => !s.ok);
                return (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {r.reportDate} {fmtDateTimeSH(r.startedAt).slice(6)}
                      {r.isBackfill && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">预置</span>}
                    </td>
                    <td className="px-4 py-2.5">{r.trigger === "manual" ? "手动" : "定时"}</td>
                    <td className="px-4 py-2.5">
                      <span className={r.status === "success" ? "text-emerald-600" : r.status === "failed" ? "text-red-600" : "text-slate-500"}>
                        {r.status === "success" ? "成功" : r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{r.stats?.okSources ?? 0} / {r.stats?.failSources ?? 0}</td>
                    <td className="px-4 py-2.5">{r.stats?.totalFetched ?? 0} / {r.stats?.totalNew ?? 0}</td>
                    <td className="px-4 py-2.5 text-xs text-amber-700">
                      {failed.length ? failed.map((f: any) => `${f.name}：${f.error}`).join("；") : "—"}
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
