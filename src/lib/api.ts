import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function handleApiError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("[api]", e);
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: `服务器内部错误：${msg}` }, { status: 500 });
}

/** 校验 cron 调用方：Bearer CRON_SECRET（Vercel Cron 自动携带）或 x-cron-secret */
export function assertCronSecret(req: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "未配置 CRON_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  const custom = req.headers.get("x-cron-secret") ?? "";
  if (auth !== `Bearer ${secret}` && custom !== secret) {
    throw new HttpError(401, "cron 鉴权失败");
  }
}
