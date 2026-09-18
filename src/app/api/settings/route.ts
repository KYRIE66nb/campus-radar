import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { ensureSettings, requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isValidSendTime } from "@/lib/time";

export const runtime = "nodejs";

const kwArray = z.array(z.string().trim().min(1).max(20)).max(10);

const putSchema = z.object({
  school: z.string().trim().min(2, "学校名称至少 2 个字").max(30),
  includeKeywords: kwArray.default([]),
  excludeKeywords: kwArray.default([]),
  recipientEmail: z.string().email("收件邮箱格式不正确").nullable(),
  sendTime: z.string().refine(isValidSendTime, "发送时间格式应为 HH:mm"),
  emailEnabled: z.boolean(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const s = await ensureSettings(user.id);
    return NextResponse.json({ settings: s });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = putSchema.parse(await req.json());
    const s = await ensureSettings(user.id);
    const [updated] = await db
      .update(settings)
      .set({
        school: body.school,
        includeKeywords: body.includeKeywords,
        excludeKeywords: body.excludeKeywords,
        recipientEmail: body.recipientEmail,
        sendTime: body.sendTime,
        emailEnabled: body.emailEnabled,
        updatedAt: new Date(),
      })
      .where(eq(settings.userId, user.id))
      .returning();
    void s;
    return NextResponse.json({ settings: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    return handleApiError(e);
  }
}
