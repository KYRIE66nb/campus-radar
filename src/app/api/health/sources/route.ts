import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { assertCronSecret, handleApiError } from "@/lib/api";
import { fetchAllSources, sourcesForSchool } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 来源实时健康检查（绕过缓存，直接抓取每个来源并解析）。
 * 用途：部署后验证各来源在生产环境（海外 IP）真实可达；只读探测，不写库。
 */
async function handle(req: Request) {
  try {
    try {
      assertCronSecret(req);
    } catch {
      const user = await getSessionUser();
      if (!user) throw new Error("需要 CRON_SECRET 或登录态");
    }
    const school = new URL(req.url).searchParams.get("school") ?? "清华大学";
    const adapters = sourcesForSchool(school);
    const outcomes = await fetchAllSources(adapters, { school }, { fresh: true });
    return NextResponse.json({
      school,
      checkedAt: new Date().toISOString(),
      sources: outcomes.map((o) => ({
        sourceId: o.sourceId,
        name: o.name,
        kind: o.kind,
        ok: o.ok,
        error: o.error,
        durationMs: o.durationMs,
        itemCount: o.items.length,
        sampleTitles: o.items.slice(0, 3).map((i) => ({
          title: i.title,
          url: i.url,
          publishedAt: i.publishedAt,
          isMock: i.isMock,
        })),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export const GET = handle;
