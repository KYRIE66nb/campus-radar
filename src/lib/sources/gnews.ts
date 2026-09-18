import { XMLParser } from "fast-xml-parser";
import { cleanTitle } from "../dedupe";
import type { NewsItem, SourceAdapter } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function gnewsUrl(school: string): string {
  const q = encodeURIComponent(`"${school}"`);
  return `https://news.google.com/rss/search?q=${q}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
}

/** 解析 Google News RSS；标题形如「正文 - 媒体名」，用 <source> 匹配去掉后缀 */
export function parseGnewsXml(xml: string, sourceId: string, now: Date = new Date()): NewsItem[] {
  const doc = parser.parse(xml) as any;
  const channel = doc?.rss?.channel;
  const rawItems: any[] = channel?.item ?? [];
  const items: NewsItem[] = [];
  for (const it of rawItems) {
    if (!it?.title || !it?.link) continue;
    let title = String(it.title).trim();
    const media = typeof it.source === "string" ? it.source : it.source?.["#text"];
    if (media) {
      const suffix = ` - ${String(media).trim()}`;
      if (title.endsWith(suffix)) title = title.slice(0, -suffix.length);
    }
    title = cleanTitle(title);
    const pub = it.pubDate ? new Date(String(it.pubDate)) : null;
    items.push({
      sourceId,
      title,
      url: String(it.link),
      publishedAt: pub && !isNaN(pub.getTime()) ? pub : null,
      fetchedAt: now,
      isMock: false,
    });
  }
  return items;
}

export function makeGnewsSource(school: string): SourceAdapter {
  const id = "gnews";
  const url = gnewsUrl(school);
  return {
    id,
    name: `Google News RSS ·「${school}」`,
    kind: "media",
    url,
    method: `Google News 公开 RSS 搜索接口（GET news.google.com/rss/search?q="${school}"），标准 XML，无需鉴权`,
    limits: "Google 官方 RSS，稳定；链接为 Google News 跳转链；单实例 30 分钟缓存，避免高频请求",
    async fetch(ctx) {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CampusRadar/1.0; +https://github.com/campus-radar)",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const items = parseGnewsXml(xml, id, ctx.now);
      if (items.length === 0) throw new Error("RSS 解析到 0 条");
      return items;
    },
  };
}
