import { NextResponse } from "next/server";
import { ensureSettings, getSessionUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null, settings: null });
    const s = await ensureSettings(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, isDemo: user.isDemo },
      settings: s,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
