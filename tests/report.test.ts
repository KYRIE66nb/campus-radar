import { describe, expect, it } from "vitest";
import { composeReport, type ComposeInput } from "@/lib/report";
import { classify, type TopicItemView, type TopicView } from "@/lib/classify";
import type { RunStats } from "@/db/schema";

const TODAY = "2026-09-18";
const ctx = { today: TODAY, sourceKinds: { "thu-official": "official", gnews: "media", "mock-forum": "mock" } as any, includeKeywords: [] };

function mkTopic(id: number, items: TopicItemView[], title = "话题") {
  const dayCounts: Record<string, number> = {};
  for (const i of items) dayCounts[i.day] = (dayCounts[i.day] ?? 0) + 1;
  const view: TopicView = {
    topicId: id,
    title,
    firstSeenDay: items.map((i) => i.day).sort()[0],
    dayCounts,
    items,
    allMock: items.every((i) => i.isMock),
  };
  return classify(view, ctx);
}

const stats: RunStats = {
  sources: [
    { sourceId: "thu-official", name: "清华大学官网·新闻", ok: true, count: 15, newCount: 2, durationMs: 800, isMock: false },
    { sourceId: "gnews", name: "Google News RSS", ok: true, count: 30, newCount: 5, durationMs: 600, isMock: false },
    { sourceId: "tieba", name: "百度贴吧（受限）", ok: false, count: 0, newCount: 0, durationMs: 8100, error: "HTTP 403：触发反爬安全验证", isMock: false },
    { sourceId: "mock-forum", name: "模拟校园论坛", ok: true, count: 9, newCount: 1, durationMs: 1, isMock: true },
  ],
  totalFetched: 54,
  totalNew: 8,
  okSources: 3,
  failSources: 1,
  topicsNew: 1,
  topicsUpdated: 1,
  topicsOngoing: 0,
  topicsLow: 1,
};

const sourceInfo = {
  "thu-official": { name: "清华大学官网·新闻", kind: "official" as const },
  gnews: { name: "Google News RSS", kind: "media" as const },
  "mock-forum": { name: "模拟校园论坛", kind: "mock" as const },
};

function input(topics: ReturnType<typeof mkTopic>[], overrides: Partial<ComposeInput> = {}): ComposeInput {
  return { school: "清华大学", today: TODAY, topics, stats, sourceInfo, includeKeywords: [], ...overrides };
}

describe("composeReport", () => {
  const topics = [
    mkTopic(1, [{ sourceId: "thu-official", sourceKind: "official", title: "清华大学举行2026年教师节庆祝大会", url: "https://www.tsinghua.edu.cn/info/1177/1.htm", day: TODAY, publishedAt: new Date(), isMock: false }]),
    mkTopic(2, [
      { sourceId: "mock-forum", sourceKind: "mock", title: "网传紫荆食堂三楼要开新窗口", url: "mock://forum/canteen/1", day: "2026-09-15", publishedAt: new Date(), isMock: true },
      { sourceId: "mock-forum", sourceKind: "mock", title: "紫荆食堂新窗口有新讨论", url: "mock://forum/canteen/2", day: TODAY, publishedAt: new Date(), isMock: true },
    ], "紫荆食堂新窗口传闻"),
    mkTopic(3, [{ sourceId: "gnews", sourceKind: "media", title: "一周前的旧闻", url: "https://news/old", day: "2026-09-10", publishedAt: new Date(), isMock: false }], "一周前的旧闻"),
  ];
  const r = composeReport(input(topics));

  it("主题与分节完整", () => {
    expect(r.subject).toContain("校园热点日报");
    expect(r.subject).toContain("清华大学");
    expect(r.html).toContain("今天新出现");
    expect(r.html).toContain("普通 / 低相关");
    expect(r.counts.new).toBeGreaterThanOrEqual(1);
  });

  it("官方话题展示官方徽章与原文链接", () => {
    expect(r.html).toContain("官方发布");
    expect(r.html).toContain("tsinghua.edu.cn/info/1177/1.htm");
  });

  it("传闻/Mock 话题不写成事实：包含未经证实与 Mock 标注", () => {
    expect(r.html).toContain("未经证实");
    expect(r.html).toContain("Mock 演示");
    expect(r.html).not.toMatch(/<script/);
  });

  it("来源失败如实展示并说明降级", () => {
    expect(r.html).toContain("获取失败来源");
    expect(r.html).toContain("403");
  });

  it("外部标题被转义（防注入）", () => {
    const bad = mkTopic(9, [{ sourceId: "gnews", sourceKind: "media", title: '<script>alert(1)</script>', url: "https://x/1", day: TODAY, publishedAt: new Date(), isMock: false }]);
    const r2 = composeReport(input([bad]));
    expect(r2.html).toContain("&lt;script&gt;");
    expect(r2.html).not.toContain("<script>alert");
  });

  it("纯文本版本与 HTML 同步包含关键信息", () => {
    expect(r.text).toContain("教师节");
    expect(r.text).toContain("未经证实");
  });

  it("空路径：无话题时诚实说明而非编造", () => {
    const okStats: RunStats = { ...stats, failSources: 0, okSources: 4, sources: stats.sources.map((s) => ({ ...s, ok: true })) };
    const r3 = composeReport(input([], { stats: okStats }));
    expect(r3.subject).toContain("今日无新增热点");
    expect(r3.html).toContain("今日无新增热点");
    expect(r3.html).toContain("不是数据源故障");
    expect(r3.hasContent).toBe(false);
  });
});
