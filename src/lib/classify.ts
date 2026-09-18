import { shiftDay } from "@/lib/time";
import type { SourceKind } from "./sources/types";

export type TopicStatus = "new" | "updated" | "ongoing" | "low";
export type Evidence = "official" | "media" | "discussion" | "mock";

export const STATUS_LABEL: Record<TopicStatus, string> = {
  new: "今天新出现",
  updated: "已有重要更新",
  ongoing: "持续受到关注",
  low: "普通 / 低相关",
};

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  official: "官方发布",
  media: "媒体报道",
  discussion: "社区讨论·未经证实",
  mock: "Mock 演示",
};

const KIND_WEIGHT: Record<SourceKind, number> = { official: 10, media: 6, forum: 3, mock: 2 };
const KIND_RANK: Record<SourceKind, number> = { official: 3, media: 2, forum: 1, mock: 0 };

export interface TopicItemView {
  sourceId: string;
  sourceKind: SourceKind;
  title: string;
  url: string;
  day: string;
  publishedAt: Date | null;
  isMock: boolean;
}

export interface TopicView {
  topicId: number;
  title: string;
  firstSeenDay: string;
  dayCounts: Record<string, number>;
  items: TopicItemView[]; // 截至统计日的全部条目
  allMock: boolean;
}

export interface ClassifyCtx {
  today: string;
  sourceKinds: Record<string, SourceKind>;
  includeKeywords: string[];
}

export interface Classified {
  view: TopicView;
  status: TopicStatus;
  heat: number;
  evidence: Evidence;
  why: string[];
  trend: "up" | "flat" | "down";
  todayItems: TopicItemView[];
  matchedKeywords: string[];
  lowRelevance: boolean;
}

function evidenceOf(items: TopicItemView[]): Evidence {
  let best: Evidence = "discussion";
  let sawReal = false;
  for (const it of items) {
    if (it.isMock) continue;
    sawReal = true;
    if (it.sourceKind === "official") return "official";
    if (it.sourceKind === "media") best = "media";
  }
  return sawReal ? best : "mock";
}

/** 关键词匹配：短 ASCII 词（如 AI、GPA）要求词边界，避免误匹配 Shanghai/email 等 */
function titleMatchesKeyword(titleLower: string, kw: string): boolean {
  const k = kw.toLowerCase();
  if (/^[a-z0-9]{1,4}$/.test(k)) {
    return new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`).test(titleLower);
  }
  return titleLower.includes(k);
}

function dayWithin(day: string, target: string, nDays: number): boolean {
  // target 往前 nDays 天内（含 target）
  for (let i = 0; i < nDays; i++) if (day === shiftDay(target, -i)) return true;
  return false;
}

export function classify(v: TopicView, ctx: ClassifyCtx): Classified {
  const { today } = ctx;
  const todayItems = v.items.filter((i) => i.day === today);
  const isNew = v.firstSeenDay === today;
  const sourcesBeforeToday = new Set(
    v.items.filter((i) => i.day < today).map((i) => i.sourceId),
  );
  const distinctSourcesToday = new Set(todayItems.map((i) => i.sourceId));
  const officialToday = todayItems.some((i) => i.sourceKind === "official");
  const newSourceToday = [...distinctSourcesToday].some((s) => !sourcesBeforeToday.has(s));
  const activeDays = Object.keys(v.dayCounts).sort();
  const lastActiveDay = activeDays[activeDays.length - 1] ?? v.firstSeenDay;
  const daysSinceActive = dayDiff(lastActiveDay, today);

  let status: TopicStatus;
  if (isNew) {
    status = "new";
  } else if (todayItems.length > 0) {
    status = officialToday || newSourceToday || distinctSourcesToday.size >= 2 ? "updated" : "ongoing";
  } else {
    status = "low";
  }

  // ---- 热度：条目来源权重 × 时间衰减 + 来源多样性 + 关键词加权 ----
  let heat = 0;
  for (const it of v.items) {
    const recency = it.day === today ? 3 : dayWithin(it.day, today, 4) ? 2 : dayWithin(it.day, today, 8) ? 1 : 0.5;
    heat += KIND_WEIGHT[it.sourceKind] * recency;
  }
  const distinctSources = new Set(v.items.map((i) => i.sourceId)).size;
  heat += Math.min(10, 5 * (distinctSources - 1));

  const lowerTitle = v.title.toLowerCase();
  const matchedKeywords = ctx.includeKeywords.filter((k) => k && titleMatchesKeyword(lowerTitle, k));
  heat += matchedKeywords.length * 8;

  // 无关注关键词命中（且用户设置了关键词）→ 低相关降权
  const lowRelevance = ctx.includeKeywords.length > 0 && matchedKeywords.length === 0;
  if (lowRelevance) heat = Math.round(heat * 0.4);

  // ---- 趋势：今天条数 vs 前 3 天均值 ----
  const prev3 = [1, 2, 3].map((n) => v.dayCounts[shiftDay(today, -n)] ?? 0);
  const avgPrev = prev3.reduce((a, b) => a + b, 0) / 3;
  const trend: Classified["trend"] =
    todayItems.length > avgPrev + 0.001 ? "up" : todayItems.length < avgPrev ? "down" : "flat";

  // ---- 关注原因 ----
  const why: string[] = [];
  if (status === "new") {
    why.push(distinctSources > 1 ? `今天首次出现，已有 ${distinctSources} 个来源报道` : "今天首次进入监测");
  } else if (status === "updated") {
    if (officialToday) why.push("老话题今天出现官方来源新信息");
    else if (newSourceToday) why.push(`新来源今天跟进该话题（今日 +${todayItems.length} 条）`);
    else why.push(`老话题今天新增 ${todayItems.length} 条内容`);
  } else if (status === "ongoing") {
    const streak = consecutiveActiveDays(v.dayCounts, today);
    why.push(`连续 ${streak} 天有新讨论，今日 +${todayItems.length} 条`);
  } else {
    why.push(daysSinceActive <= 3 ? `近 ${daysSinceActive} 天无新增动态` : "已超过 3 天无新增动态");
  }
  if (matchedKeywords.length) why.push(`命中关注关键词「${matchedKeywords.join("」「")}」`);
  if (v.allMock) why.push("Mock 演示数据（非真实来源）");

  // 个性化：设置关注关键词后，未命中的非官方新话题降入低相关
  // （官方发布始终保留——校园级重要信息不因个人关键词被过滤）
  const hasOfficialItem = v.items.some((i) => i.sourceKind === "official");
  if (lowRelevance && status !== "low" && !hasOfficialItem) status = "low";

  return {
    view: v,
    status,
    heat: Math.round(heat),
    evidence: evidenceOf(v.items),
    why,
    trend,
    todayItems,
    matchedKeywords,
    lowRelevance,
  };
}

function dayDiff(from: string, to: string): number {
  const f = new Date(`${from}T12:00:00Z`).getTime();
  const t = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((t - f) / 86400000);
}

function consecutiveActiveDays(dayCounts: Record<string, number>, today: string): number {
  let n = 0;
  for (let i = 0; i < 14; i++) {
    const d = shiftDay(today, -i);
    if ((dayCounts[d] ?? 0) > 0) n++;
    else if (i > 0) break;
  }
  return Math.max(1, n);
}
