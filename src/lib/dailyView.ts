import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { items, topics } from "@/db/schema";
import { classify, type Classified } from "./classify";
import { allSourceMetas } from "./sources";
import { shiftDay } from "./time";
import type { SourceInfo } from "./report";

export interface DailyView {
  day: string;
  topics: Classified[];
  sourceInfo: Record<string, SourceInfo>;
}

/**
 * 纯读取：构建"某学校在某个统计日"的热点视图（不抓网络）。
 * 供三种场景复用：实时运行日报、历史回填、仪表盘展示。
 */
export async function buildDailyView(
  school: string,
  day: string,
  includeKeywords: string[] = [],
  excludeKeywords: string[] = [],
): Promise<DailyView> {
  const sourceInfo: Record<string, SourceInfo> = {};
  const sourceKinds: Record<string, import("./sources/types").SourceKind> = {};
  for (const s of allSourceMetas(school)) {
    sourceInfo[s.id] = { name: s.name, kind: s.kind };
    sourceKinds[s.id] = s.kind;
  }

  const since = shiftDay(day, -14);
  const allTopics = await db.select().from(topics).where(eq(topics.school, school)).limit(2000);
  if (allTopics.length === 0) return { day, topics: [], sourceInfo };

  const ids = allTopics.map((t) => t.id);
  const rows = await db
    .select({
      id: items.id,
      topicId: items.topicId,
      title: items.title,
      url: items.url,
      day: items.day,
      publishedAt: items.publishedAt,
      isMock: items.isMock,
      sourceId: items.sourceId,
    })
    .from(items)
    .where(and(inArray(items.topicId, ids), lte(items.day, day), gte(items.day, since)))
    .limit(5000);

  const byTopic = new Map<number, typeof rows>();
  for (const r of rows) {
    if (r.topicId == null) continue;
    const list = byTopic.get(r.topicId) ?? [];
    list.push(r);
    byTopic.set(r.topicId, list);
  }

  const classified: Classified[] = [];
  for (const t of allTopics) {
    const list = byTopic.get(t.id);
    if (!list || list.length === 0) continue;
    const itemViews = list.map((r) => ({
      sourceId: r.sourceId,
      sourceKind: sourceKinds[r.sourceId] ?? ("media" as const),
      title: r.title,
      url: r.url,
      day: r.day,
      publishedAt: r.publishedAt,
      isMock: r.isMock,
    }));
    // 排除关键词：话题全部条目命中排除词才整体排除（单条排除在入库时处理）
    if (excludeKeywords.length > 0) {
      const allExcluded = itemViews.every((i) =>
        excludeKeywords.some((k) => k && i.title.toLowerCase().includes(k.toLowerCase())),
      );
      if (allExcluded) continue;
    }
    const dayCounts: Record<string, number> = {};
    for (const i of itemViews) dayCounts[i.day] = (dayCounts[i.day] ?? 0) + 1;
    const firstSeenDay = itemViews.map((i) => i.day).sort()[0];
    classified.push(
      classify(
        {
          topicId: t.id,
          title: t.title,
          firstSeenDay,
          dayCounts,
          items: itemViews,
          allMock: itemViews.every((i) => i.isMock),
        },
        { today: day, sourceKinds, includeKeywords },
      ),
    );
  }

  classified.sort((a, b) => b.heat - a.heat);
  return { day, topics: classified, sourceInfo };
}
