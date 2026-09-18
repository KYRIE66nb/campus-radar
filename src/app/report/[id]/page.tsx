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
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{report.reportDate} 日报</span>
        {report.isBackfill && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">预置回填数据</span>}
        <span>邮件状态：{report.emailStatus ?? "—"}</span>
        {report.emailError && <span className="text-red-600">{report.emailError}</span>}
      </div>
      {/* 日报正文即邮件正文（同一份 HTML 模板渲染） */}
      <div className="rounded-xl border border-slate-200 bg-white p-4" dangerouslySetInnerHTML={{ __html: report.html }} />
    </div>
  );
}
