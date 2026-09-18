import type { SourceAdapter } from "./types";

/**
 * 百度贴吧·{学校}吧 —— 「预期失败的受限来源」演示。
 * 实测（2026-09）：服务端直接请求返回 403 + 安全验证页。
 * 设计意图：题目要求展示"不绕过反爬虫，失败→跳过/降级"的策略，
 * 该来源常驻启用，失败状态在界面与日报中如实展示，绝不阻断整份日报。
 */
export function makeTiebaSource(school: string): SourceAdapter {
  const kw = encodeURIComponent(school.replace(/大学|学院$/u, ""));
  const url = `https://tieba.baidu.com/f?kw=${kw}`;
  return {
    id: "tieba",
    name: `百度贴吧·${school.replace(/大学|学院$/u, "")}吧（受限）`,
    kind: "forum",
    url,
    method: "尝试直接 GET 贴吧吧页并解析帖子列表（与浏览器相同请求头）",
    limits:
      "强反爬：服务器直连实测返回 HTTP 403 安全验证；遵守 robots 与服务条款，不破解验证码、不模拟登录、不做请求伪装绕过。此来源按预期降级跳过",
    async fetch() {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.status === 403) throw new Error("HTTP 403：触发反爬安全验证（预期内，降级跳过）");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // 极小概率未触发验证：解析帖子链接 /p/xxxx
      const links = [...html.matchAll(/href="\/p\/(\w+)"[^>]*title="([^"]{6,80})"/g)].map((m) => ({
        sourceId: "tieba",
        title: m[2],
        url: `https://tieba.baidu.com/p/${m[1]}`,
        publishedAt: null,
        fetchedAt: new Date(),
        isMock: false,
      }));
      if (links.length === 0) throw new Error("页面返回但未解析到帖子列表（疑似验证页）");
      return links;
    },
  };
}
