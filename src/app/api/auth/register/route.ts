import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, ensureSettings, hashPassword } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位").max(64),
  name: z.string().max(30).optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (exists.length) return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    const [u] = await db
      .insert(users)
      .values({ email: body.email, passwordHash: await hashPassword(body.password), name: body.name })
      .returning({ id: users.id, email: users.email });
    await ensureSettings(u.id);
    await createSession(u.id);
    return NextResponse.json({ user: u });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    return handleApiError(e);
  }
}
