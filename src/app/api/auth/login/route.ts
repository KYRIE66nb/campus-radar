import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, ensureSettings, verifyPassword } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// 极简限流：同邮箱 1 分钟最多 8 次尝试（进程内计数，防脚本撞库足够）
const attempts = new Map<string, { n: number; at: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.at > 60_000) {
    attempts.set(key, { n: 1, at: now });
    return false;
  }
  rec.n++;
  return rec.n > 8;
}

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    if (rateLimited(body.email)) {
      return NextResponse.json({ error: "尝试过于频繁，请 1 分钟后再试" }, { status: 429 });
    }
    const rows = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    const u = rows[0];
    if (!u || !(await verifyPassword(body.password, u.passwordHash))) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }
    await ensureSettings(u.id);
    await createSession(u.id);
    return NextResponse.json({ user: { id: u.id, email: u.email, name: u.name, isDemo: u.isDemo } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }
    return handleApiError(e);
  }
}
