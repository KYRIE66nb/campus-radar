import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseOfficialList } from "@/lib/sources/officialSites";
import { parseGnewsXml } from "@/lib/sources/gnews";
import { mockForum } from "@/lib/sources/mockForum";

const fixtures = (f: string) =>
  readFileSync(path.resolve(__dirname, "fixtures", f), "utf-8");

describe("parseOfficialList · 清华官网 fixture", () => {
  const items = parseOfficialList(fixtures("thu-news.htm").replace(/^\uFEFF/, ""), {
    sourceId: "thu-official",
    siteOrigin: "https://www.tsinghua.edu.cn",
  });

  it("解析出多条新闻", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("每条都有 /info/ 详情链接与标题", () => {
    for (const it of items) {
      expect(it.url).toMatch(/tsinghua\.edu\.cn\/info\/\d+\/\d+\.htm/);
      expect(it.title.length).toBeGreaterThanOrEqual(6);
      expect(it.isMock).toBe(false);
    }
  });

  it("解析出发布日期（YYYY.MM.DD 格式）", () => {
    const withDate = items.filter((i) => i.publishedAt);
    expect(withDate.length).toBeGreaterThanOrEqual(3);
    expect(withDate[0].publishedAt!.getFullYear()).toBeGreaterThanOrEqual(2024);
  });

  it("按日期倒序", () => {
    const dates = items.filter((i) => i.publishedAt).map((i) => i.publishedAt!.getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });
});

describe("parseOfficialList · 中科大 fixture", () => {
  const items = parseOfficialList(fixtures("ustc-news.htm").replace(/^\uFEFF/, ""), {
    sourceId: "ustc-official",
    siteOrigin: "https://news.ustc.edu.cn",
  });

  it("解析出新闻（YYYY-MM-DD 日期格式）", () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => i.publishedAt)).toBe(true);
  });
});

describe("parseGnewsXml · Google News RSS fixture", () => {
  const items = parseGnewsXml(fixtures("gnews.xml"), "gnews");

  it("解析出多条新闻", () => {
    expect(items.length).toBeGreaterThanOrEqual(10);
  });

  it("字段完整：http 链接 + 标题 + 发布时间", () => {
    for (const it of items) {
      expect(it.url).toMatch(/^https?:\/\//);
      expect(it.title.length).toBeGreaterThan(1);
      expect(it.publishedAt).toBeTruthy();
    }
  });
});

describe("mockForum", () => {
  it("按当前时间产出已到期的线程帖子，全部 isMock", async () => {
    const now = new Date("2026-09-18T12:00:00+08:00");
    const items = await mockForum.fetch({ school: "清华大学", now });
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.every((i) => i.isMock)).toBe(true);
    expect(items.every((i) => i.url.startsWith("mock://forum/"))).toBe(true);
    // 食堂线程三条都已到期
    const canteen = items.filter((i) => i.url.includes("zhujin-canteen"));
    expect(canteen.length).toBe(3);
  });

  it("未来的帖子不产出", async () => {
    const now = new Date("2026-09-15T12:00:00+08:00");
    const items = await mockForum.fetch({ school: "清华大学", now });
    expect(items.every((i) => (i.publishedAt as Date).getTime() <= now.getTime())).toBe(true);
  });
});
