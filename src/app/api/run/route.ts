import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z
  .object({
    sendEmail: z.boolean().optional(),
  })
  .default({});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    let body: z.infer<typeof bodySchema> = {};
    try {
      body = bodySchema.parse(await req.json().catch(() => ({})));
    } catch {
      body = {};
    }
    const result = await runPipeline({
      userId: user.id,
      trigger: "manual",
      sendEmail: body.sendEmail ?? true,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return handleApiError(e);
  }
}
