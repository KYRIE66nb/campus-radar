import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, Number(id)), eq(reports.userId, user.id)))
    .limit(1);
  const report = rows[0];
  if (!report) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 text-sm text-slate-500">
        <span className="text-lg font-bold tracking-tight text-ink">{report.reportDate} 日报</span>
        {report.isBackfill && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">预置回填数据</span>}
        <span className="ml-auto text-xs">邮件状态：{report.emailStatus ?? "—"}{report.emailError ? ` · ${report.emailError}` : ""}</span>
      </div>
      {/* 日报正文即邮件正文（同一份 HTML 模板渲染） */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" dangerouslySetInnerHTML={{ __html: report.html }} />
    </div>
  );
}
