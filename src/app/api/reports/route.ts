import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { requireUser, HttpError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const rows = await db
        .select()
        .from(reports)
        .where(and(eq(reports.id, Number(id)), eq(reports.userId, user.id)))
        .limit(1);
      if (!rows[0]) throw new HttpError(404, "日报不存在");
      return NextResponse.json({ report: rows[0] });
    }
    const rows = await db
      .select({
        id: reports.id,
        reportDate: reports.reportDate,
        subject: reports.subject,
        status: reports.status,
        emailStatus: reports.emailStatus,
        emailError: reports.emailError,
        topicCounts: reports.topicCounts,
        isBackfill: reports.isBackfill,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(eq(reports.userId, user.id))
      .orderBy(desc(reports.reportDate), desc(reports.id))
      .limit(30);
    return NextResponse.json({ reports: rows });
  } catch (e) {
    return handleApiError(e);
  }
}
