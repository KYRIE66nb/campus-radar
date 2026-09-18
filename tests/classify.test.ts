import { describe, expect, it } from "vitest";
import { classify, type TopicItemView, type TopicView } from "@/lib/classify";
import { shiftDay } from "@/lib/time";

const TODAY = "2026-09-18";
const ctx = { today: TODAY, sourceKinds: { "thu-official": "official", gnews: "media", "mock-forum": "mock" } as any, includeKeywords: [] };

function item(partial: Partial<TopicItemView> & { day: string }): TopicItemView {
  return {
    sourceId: "gnews",
    sourceKind: "media",
    title: partial.title ?? "某新闻标题",
    url: partial.url ?? `https://x/${partial.day}`,
    publishedAt: new Date(`${partial.day}T12:00:00+08:00`),
    isMock: false,
    ...partial,
  };
}

function view(partial: Partial<TopicView> & { items: TopicItemView[] }): TopicView {
  const dayCounts: Record<string, number> = {};
  for (const i of partial.items) dayCounts[i.day] = (dayCounts[i.day] ?? 0) + 1;
  return {
    topicId: 1,
    title: partial.title ?? "话题",
    firstSeenDay: partial.items.map((i) => i.day).sort()[0],
    dayCounts,
    ...partial,
    allMock: partial.items.every((i) => i.isMock),
  };
}

describe("classifyTopic 四分类", () => {
  it("今天首次出现 → new", () => {
    const c = classify(view({ items: [item({ day: TODAY })] }), ctx);
    expect(c.status).toBe("new");
    expect(c.why.join()).toContain("首次");
  });

  it("老话题今天出现官方来源新信息 → updated", () => {
    const c = classify(
      view({
        items: [
          item({ day: shiftDay(TODAY, -2), sourceId: "gnews", sourceKind: "media" }),
          item({ day: TODAY, sourceId: "thu-official", sourceKind: "official" }),
        ],
      }),
      ctx,
    );
    expect(c.status).toBe("updated");
    expect(c.evidence).toBe("official");
    expect(c.why.join()).toContain("官方");
  });

  it("老话题今天仅有同一论坛来源新帖 → ongoing", () => {
    const items = [-2, -1, 0].map((d) =>
      item({ day: shiftDay(TODAY, d), sourceId: "gnews", sourceKind: "media" }),
    );
    const c = classify(view({ items }), ctx);
    expect(c.status).toBe("ongoing");
  });

  it("连续多天有讨论 → 连续天数文案", () => {
    const items = [-2, -1, 0].map((d) =>
      item({ day: shiftDay(TODAY, d), sourceId: "gnews", sourceKind: "media" }),
    );
    const c = classify(view({ items }), ctx);
    expect(c.why.join()).toMatch(/连续 \d+ 天/);
  });

  it("5 天无活动 → low", () => {
    const c = classify(view({ items: [item({ day: shiftDay(TODAY, -5) })] }), ctx);
    expect(c.status).toBe("low");
  });

  it("热度：来源多样与新鲜度提高热度", () => {
    const single = classify(view({ items: [item({ day: shiftDay(TODAY, -5) })] }), ctx);
    const hot = classify(
      view({
        items: [
          item({ day: shiftDay(TODAY, -1), sourceId: "thu-official", sourceKind: "official" }),
          item({ day: TODAY, sourceId: "gnews", sourceKind: "media" }),
          item({ day: TODAY, sourceId: "thu-official", sourceKind: "official" }),
        ],
      }),
      ctx,
    );
    expect(hot.heat).toBeGreaterThan(single.heat);
  });

  it("趋势：今天条数多于前三天均值 → up", () => {
    const c = classify(
      view({
        items: [
          item({ day: shiftDay(TODAY, -3) }),
          item({ day: TODAY }),
          item({ day: TODAY, sourceId: "thu-official", sourceKind: "official" }),
        ],
      }),
      ctx,
    );
    expect(c.trend).toBe("up");
  });

  it("全部为 Mock 条目 → evidence=mock 且 why 标注", () => {
    const c = classify(
      view({
        items: [item({ day: TODAY, sourceId: "mock-forum", sourceKind: "mock", isMock: true })],
      }),
      ctx,
    );
    expect(c.evidence).toBe("mock");
    expect(c.why.join()).toContain("Mock");
  });

  it("关注关键词命中加分；未命中且非新话题 → 降为 low", () => {
    const kwCtx = { ...ctx, includeKeywords: ["食堂"] };
    const hit = classify(view({ title: "紫荆食堂新窗口开放", items: [item({ day: TODAY, title: "紫荆食堂新窗口开放" })] }), kwCtx);
    expect(hit.matchedKeywords).toContain("食堂");
    expect(hit.lowRelevance).toBe(false);

    const miss = classify(
      view({
        title: "量子实验室揭牌",
        items: [item({ day: shiftDay(TODAY, -2), title: "量子实验室揭牌" }), item({ day: shiftDay(TODAY, -1), title: "量子实验室揭牌后续" })],
      }),
      kwCtx,
    );
    expect(miss.lowRelevance).toBe(true);
    expect(miss.status).toBe("low");
  });

  it("个性化：官方来源的新话题即使未命中关键词也保留为 new", () => {
    const kwCtx = { ...ctx, includeKeywords: ["食堂"] };
    const officialNew = classify(
      view({
        title: "学校举行教师节庆祝大会",
        items: [item({ day: TODAY, title: "学校举行教师节庆祝大会", sourceId: "thu-official", sourceKind: "official" })],
      }),
      kwCtx,
    );
    expect(officialNew.status).toBe("new");

    const mediaNew = classify(
      view({ title: "某地企业来校招聘引关注", items: [item({ day: TODAY, title: "某地企业来校招聘引关注" })] }),
      kwCtx,
    );
    expect(mediaNew.status).toBe("low");
    expect(mediaNew.lowRelevance).toBe(true);
  });
});
