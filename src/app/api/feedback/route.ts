import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { feedback, topics } from "@/db/schema";
import { requireUser, HttpError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  topicId: z.number().int().positive(),
  kind: z.enum(["not_interested", "inaccurate"]),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    const topic = await db.select({ id: topics.id }).from(topics).where(eq(topics.id, body.topicId)).limit(1);
    if (!topic[0]) throw new HttpError(404, "话题不存在");
    await db.insert(feedback).values({
      userId: user.id,
      topicId: body.topicId,
      kind: body.kind,
      note: body.note,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }
    return handleApiError(e);
  }
}
