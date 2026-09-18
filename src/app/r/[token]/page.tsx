import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Share2 } from "lucide-react";
import { db } from "@/db";
import { reports, settings } from "@/db/schema";

export const dynamic = "force-dynamic";

/** 公开分享页：/r/<shareToken>，只读展示该用户最新一期日报（挑战项） */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settingRows = await db.select().from(settings).where(eq(settings.shareToken, token)).limit(1);
  const s = settingRows[0];
  if (!s) notFound();

  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, s.userId), eq(reports.shareVisible, true)))
    .orderBy(desc(reports.id))
    .limit(1);
  const report = rows[0];
  if (!report) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        该分享链接暂无可展示的日报。
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-accent-soft px-4 py-2.5 text-xs font-medium text-blue-800">
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        公开分享页 · {s.school} · 由 CampusRadar 生成 · 无需登录即可查看
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" dangerouslySetInnerHTML={{ __html: report.html }} />
    </div>
  );
}
