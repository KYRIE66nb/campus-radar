import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
