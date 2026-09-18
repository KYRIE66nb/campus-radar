import { NextResponse } from "next/server";
import { assertCronSecret, handleApiError } from "@/lib/api";
import { dispatchDueUsers } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(req: Request) {
  try {
    assertCronSecret(req);
    const result = await dispatchDueUsers();
    return NextResponse.json({
      ok: true,
      hour: result.hour,
      processed: result.processed,
      note: "处理 send_time 小时 = 当前上海时间的用户；scheduled 每 (user,date) 幂等去重",
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export const GET = handle;
export const POST = handle;
