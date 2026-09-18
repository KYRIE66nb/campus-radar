import type { FetchCtx, FetchOutcome, NewsItem, SourceAdapter } from "./types";
import { thuOfficial, ustcOfficial } from "./officialSites";
import { makeGnewsSource } from "./gnews";
import { makeTiebaSource } from "./tieba";
import { mockCampusMedia, mockForum } from "./mockForum";

export * from "./types";
export { thuOfficial, ustcOfficial };

/** 一所学校启用哪些来源：官网(若有已接入) + Google News + 贴吧(受限演示) + Mock 论坛/校园媒体 */
export function sourcesForSchool(school: string): SourceAdapter[] {
  const list: SourceAdapter[] = [];
  if (school === "清华大学") list.push(thuOfficial);
  if (school === "中国科学技术大学") list.push(ustcOfficial);
  list.push(makeGnewsSource(school));
  list.push(makeTiebaSource(school));
  list.push(mockForum);
  list.push(mockCampusMedia);
  return list;
}

/** 全量来源注册表（/sources 说明页用，与学校无关的静态说明） */
export function allSourceMetas(school: string): SourceAdapter[] {
  return [thuOfficial, ustcOfficial, makeGnewsSource(school), makeTiebaSource(school), mockForum, mockCampusMedia];
}

// ---- 结果缓存：同一实例 30 分钟内复用，控制对来源的请求频率 ----
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; items: NewsItem[] }>();

async function fetchOne(adapter: SourceAdapter, ctx: FetchCtx, fresh: boolean): Promise<FetchOutcome> {
  const started = Date.now();
  if (!fresh) {
    const cachedEntry = cache.get(adapter.id);
    if (cachedEntry && Date.now() - cachedEntry.at < CACHE_TTL_MS) {
      return {
        sourceId: adapter.id,
        name: adapter.name,
        kind: adapter.kind,
        ok: true,
        items: cachedEntry.items,
        durationMs: Date.now() - started,
        cached: true,
        isMock: adapter.kind === "mock",
      };
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const items = await adapter.fetch(ctx);
      cache.set(adapter.id, { at: Date.now(), items });
      return {
        sourceId: adapter.id,
        name: adapter.name,
        kind: adapter.kind,
        ok: true,
        items,
        durationMs: Date.now() - started,
        cached: false,
        isMock: adapter.kind === "mock",
      };
    } catch (e) {
      lastError = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return {
    sourceId: adapter.id,
    name: adapter.name,
    kind: adapter.kind,
    ok: false,
    items: [],
    error: lastError instanceof Error ? lastError.message : String(lastError),
    durationMs: Date.now() - started,
    cached: false,
    isMock: adapter.kind === "mock",
  };
}

/** 并行抓取全部来源；单源失败/超时只记入该来源的 outcome，不影响其他来源 */
export async function fetchAllSources(
  adapters: SourceAdapter[],
  ctx: FetchCtx,
  opts?: { fresh?: boolean },
): Promise<FetchOutcome[]> {
  return Promise.all(adapters.map((a) => fetchOne(a, ctx, opts?.fresh ?? false)));
}
