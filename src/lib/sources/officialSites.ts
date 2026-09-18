import * as cheerio from "cheerio";
import type { NewsItem, SourceAdapter } from "./types";

// 匹配博达 CMS 详情页（相对或绝对路径）：info/{cat}/{id}.htm，及上交风格 /{section}/{YYYYMMDD}/{id}.html
const LINK_RE = [/(^|\/)info\/\d+\/\d+\.htm/i, /\/[a-z]+\/\d{8}\/\d+\.html/i];
// 支持 2026.09.10 / 2026-09-10 / 2026年09月10日
const DATE_RE = /(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})日?/;

function parseCnDate(s: string): Date | null {
  const m = s.match(DATE_RE);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // 用上海正午避免时区边界把日期推到前一天/后一天
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+08:00`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * 解析高校官网新闻列表页（博达 CMS 风格 /info/{cat}/{id}.htm，
 * 以及上交风格 /{section}/{YYYYMMDD}/{id}.html）。
 * 策略：全页扫描符合详情页 URL 模式的 <a>，取同 URL 下最合适的标题文本，
 * 并在祖先节点（列表项）内找发布日期。
 */
export function parseOfficialList(
  html: string,
  meta: { sourceId: string; siteOrigin: string },
  now: Date = new Date(),
): NewsItem[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, { titles: string[]; publishedAt: Date | null }>();

  $("a").each((_, el) => {
    const a = $(el);
    const href = a.attr("href") ?? "";
    if (!LINK_RE.some((re) => re.test(href))) return;
    let url: string;
    try {
      url = new URL(href, meta.siteOrigin).toString();
    } catch {
      return;
    }
    const text = a.text().replace(/\s+/g, "").trim();
    const cur = byUrl.get(url) ?? { titles: [], publishedAt: null };
    if (text.length >= 6 && text.length <= 80) cur.titles.push(text);

    // 向上最多 5 层找日期；节点文本过大说明已爬到容器，放弃
    if (!cur.publishedAt) {
      let p = a.parent();
      for (let i = 0; i < 5 && p.length; i++) {
        const t = p.text() ?? "";
        if (t.length > 1500) break;
        const dt = parseCnDate(t);
        if (dt) {
          cur.publishedAt = dt;
          break;
        }
        p = p.parent();
      }
    }
    byUrl.set(url, cur);
  });

  const items: NewsItem[] = [];
  for (const [url, v] of byUrl) {
    if (v.titles.length === 0) continue;
    // 同一 URL 多个锚文本（如图片锚+标题锚）：取长度居中的第一个合适标题
    const best = v.titles.find((t) => t.length >= 10) ?? v.titles[0];
    items.push({
      sourceId: meta.sourceId,
      title: best,
      url,
      publishedAt: v.publishedAt,
      fetchedAt: now,
      isMock: false,
    });
  }
  // 日期新的在前
  items.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  return items;
}

export function makeOfficialSource(cfg: {
  id: string;
  name: string;
  school: string;
  listUrl: string;
  siteOrigin: string;
}): SourceAdapter {
  return {
    id: cfg.id,
    name: cfg.name,
    kind: "official",
    school: cfg.school,
    url: cfg.listUrl,
    method: `直接请求列表页 HTML（GET ${cfg.listUrl}），静态解析锚点与日期，无登录、无Cookie`,
    limits: "高校官网偶发海外访问慢/波动；请求带 8 秒超时与 1 次重试，30 分钟结果缓存",
    async fetch(ctx) {
      const res = await fetch(cfg.listUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CampusRadar/1.0; +https://github.com/campus-radar) AppleWebKit/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const items = parseOfficialList(html, { sourceId: cfg.id, siteOrigin: cfg.siteOrigin }, ctx.now);
      if (items.length === 0) throw new Error("页面解析到 0 条新闻（可能改版）");
      return items;
    },
  };
}

export const thuOfficial = makeOfficialSource({
  id: "thu-official",
  name: "清华大学官网·新闻",
  school: "清华大学",
  listUrl: "https://www.tsinghua.edu.cn/news.htm",
  siteOrigin: "https://www.tsinghua.edu.cn",
});

export const ustcOfficial = makeOfficialSource({
  id: "ustc-official",
  name: "中国科大新闻网",
  school: "中国科学技术大学",
  listUrl: "https://news.ustc.edu.cn/",
  siteOrigin: "https://news.ustc.edu.cn",
});
