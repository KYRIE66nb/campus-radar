import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { runs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(runs)
      .where(eq(runs.userId, user.id))
      .orderBy(desc(runs.id))
      .limit(20);
    return NextResponse.json({ runs: rows });
  } catch (e) {
    return handleApiError(e);
  }
}
