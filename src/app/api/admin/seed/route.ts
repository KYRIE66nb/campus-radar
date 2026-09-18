import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronSecret, handleApiError } from "@/lib/api";
import { runSeed } from "@/lib/seed";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ reset: z.boolean().optional() }).default({});

/**
 * 服务端初始化接口（部署后一键种子）：
 *   POST /api/admin/seed  Header: x-cron-secret / Authorization: Bearer
 *   Body: {"reset": true}  # 清空重建
 * 用 CRON_SECRET 鉴权，避免暴露管理能力。
 */
async function handle(req: Request) {
  try {
    assertCronSecret(req);
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    await runSeed(body.reset ?? false);
    return NextResponse.json({ ok: true, demo: { email: "review@demo.campus", password: "demo1234" } });
  } catch (e) {
    return handleApiError(e);
  }
}

export const POST = handle;
