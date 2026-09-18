import type { RunStats } from "@/db/schema";
import {
  Classified,
  EVIDENCE_LABEL,
  STATUS_LABEL,
  TopicStatus,
} from "./classify";
import type { SourceKind } from "./sources/types";

export interface SourceInfo {
  name: string;
  kind: SourceKind;
}

export interface ComposeInput {
  school: string;
  today: string;
  topics: Classified[];
  stats: RunStats;
  sourceInfo: Record<string, SourceInfo>;
  includeKeywords: string[];
  appUrl?: string;
  shareUrl?: string | null;
  /** LLM 增强摘要（topicId → summary）；缺省回退规则式 topicSummary */
  summaries?: Map<number, string>;
}

export interface ComposedReport {
  subject: string;
  html: string;
  text: string;
  counts: Record<TopicStatus, number>;
  hasContent: boolean;
}

/* ---------- 安全工具：外部标题/URL 一律消毒 ---------- */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string | null {
  if (/^https?:\/\//i.test(url)) return url;
  return null; // mock:// 等渲染为纯文本
}

/* ---------- 规则式总结（LLM 不可用时的兜底，永不失败） ---------- */

export function topicSummary(c: Classified): string {
  const rep =
    c.todayItems.find((i) => i.sourceKind === "official")?.title ??
    c.todayItems[0]?.title ??
    c.view.items[0]?.title ??
    c.view.title;
  const short = rep.length > 52 ? rep.slice(0, 52) + "…" : rep;
  const nSources = new Set(c.view.items.map((i) => i.sourceId)).size;
  switch (c.evidence) {
    case "official":
      return short + (nSources > 1 ? `（${nSources} 个来源报道）` : "");
    case "media":
      return `据媒体报道：${short}`;
    case "discussion":
      return `据校园社区讨论（未经证实）：${short.replace(/^[【\[][^】\]]*[】\]]/, "")}`;
    case "mock":
      return `【Mock 演示数据】${short}`;
  }
}

/* ---------- 生命周期与来源行 ---------- */

function lifecycleLine(c: Classified): string {
  const first = c.view.firstSeenDay.slice(5).replace(/-/g, "/");
  const total = c.view.items.length;
  const todayAdd = c.todayItems.length;
  return `首次出现 ${first} · 累计 ${total} 条 · 今日 +${todayAdd}`;
}

function sourceLine(c: Classified, sourceInfo: Record<string, SourceInfo>): string {
  const items = [...c.view.items]
    .sort((a, b) => (b.day > a.day ? 1 : b.day < a.day ? -1 : 0))
    .slice(0, 5);
  return items
    .map((i) => {
      const name = sourceInfo[i.sourceId]?.name ?? i.sourceId;
      const label = `${name} ${i.day.slice(5).replace(/-/g, "/")}`;
      const href = safeHref(i.url);
      return href
        ? `<a href="${esc(href)}" style="color:#2563eb;text-decoration:none;">${esc(label)} ↗</a>`
        : `<span style="color:#9ca3af;">${esc(label)}（Mock·无原文链接）</span>`;
    })
    .join('<span style="color:#d1d5db;margin:0 4px;">·</span>');
}

/* ---------- 徽章 ---------- */

const BADGE: Record<string, { bg: string; fg: string; text: string }> = {
  official: { bg: "#ecfdf5", fg: "#047857", text: "官方发布" },
  media: { bg: "#eff6ff", fg: "#2563eb", text: "媒体报道" },
  discussion: { bg: "#fffbeb", fg: "#b45309", text: "社区讨论·未经证实" },
  mock: { bg: "#f5f3ff", fg: "#7c3aed", text: "Mock 演示" },
};

function badge(evidence: string): string {
  const b = BADGE[evidence] ?? BADGE.discussion;
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;background:${b.bg};color:${b.fg};">${b.text}</span>`;
}

const TREND_ARROW: Record<Classified["trend"], string> = { up: "↗ 升温", flat: "→ 平稳", down: "↘ 退热" };
const TREND_COLOR: Record<Classified["trend"], string> = { up: "#dc2626", flat: "#6b7280", down: "#059669" };

/* ---------- 状态摘要框 ---------- */

function statusBox(input: ComposeInput): { html: string; text: string } {
  const { stats } = input;
  const failed = stats.sources.filter((s) => !s.ok);
  const okLine = `来源 ${stats.okSources}/${stats.okSources + stats.failSources} 正常 · 获取 ${stats.totalFetched} 条 · 本次新增 ${stats.totalNew} 条`;
  const html =
    `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:13px;color:#334155;">` +
    esc(okLine) +
    (failed.length
      ? `<div style="margin-top:6px;color:#b91c1c;">⚠ 获取失败来源：${failed
          .map((f) => `${esc(f.name)}（${esc(f.error ?? "未知错误")}），已自动跳过`)
          .join("；")}</div>`
      : "") +
    `</div>`;
  const text =
    okLine +
    (failed.length
      ? `\n⚠ 获取失败来源：${failed.map((f) => `${f.name}（${f.error ?? ""}）`).join("；")}（已跳过，不影响日报）`
      : "");
  return { html, text };
}

function topicBlock(c: Classified, input: ComposeInput): string {
  const isMock = c.evidence === "mock";
  const summary = input.summaries?.get(c.view.topicId) ?? topicSummary(c);
  return (
    `<div style="margin:14px 0;padding:12px 14px;border:1px solid #e5e7eb;border-left:4px solid ${
      isMock ? "#7c3aed" : c.status === "new" ? "#e11d48" : c.status === "updated" ? "#d97706" : c.status === "ongoing" ? "#2563eb" : "#9ca3af"
    };border-radius:8px;${isMock ? "background:#faf5ff;" : ""}">` +
    `<div style="font-weight:600;font-size:15px;color:#111827;margin-bottom:6px;">${esc(c.view.title)}</div>` +
    `<div style="margin-bottom:6px;">${badge(c.evidence)}` +
    `<span style="margin-left:8px;font-size:12px;color:${TREND_COLOR[c.trend]};">${TREND_ARROW[c.trend]}</span>` +
    `<span style="margin-left:8px;font-size:12px;color:#6b7280;">热度 ${c.heat}</span></div>` +
    `<div style="font-size:14px;color:#374151;line-height:1.6;">${esc(summary)}</div>` +
    `<div style="font-size:12.5px;color:#6b7280;margin-top:6px;">📌 关注原因：${esc(c.why.join("；"))}</div>` +
    `<div style="font-size:12.5px;color:#6b7280;margin-top:4px;">🕒 ${esc(lifecycleLine(c))}</div>` +
    `<div style="font-size:12.5px;margin-top:6px;">来源：${sourceLine(c, input.sourceInfo)}</div>` +
    `</div>`
  );
}

function topicText(c: Classified, input: ComposeInput): string {
  const summary = input.summaries?.get(c.view.topicId) ?? topicSummary(c);
  const srcs = [...c.view.items]
    .sort((a, b) => (b.day > a.day ? 1 : -1))
    .slice(0, 5)
    .map((i) => `${input.sourceInfo[i.sourceId]?.name ?? i.sourceId} ${i.day} ${i.url}`)
    .join("\n  - ");
  return (
    `■ ${c.view.title}\n` +
    `  [${EVIDENCE_LABEL[c.evidence]}] ${TREND_ARROW[c.trend]} 热度${c.heat}\n` +
    `  摘要：${summary}\n` +
    `  关注原因：${c.why.join("；")}\n` +
    `  ${lifecycleLine(c)}\n` +
    `  来源：\n  - ${srcs}`
  );
}

/* ---------- 主体 ---------- */

export function composeReport(input: ComposeInput): ComposedReport {
  const { school, today, topics, stats } = input;
  const order: TopicStatus[] = ["new", "updated", "ongoing", "low"];
  const grouped: Record<TopicStatus, Classified[]> = { new: [], updated: [], ongoing: [], low: [] };
  for (const t of topics) grouped[t.status].push(t);
  for (const k of order) grouped[k].sort((a, b) => b.heat - a.heat);

  const counts: Record<TopicStatus, number> = {
    new: grouped.new.length,
    updated: grouped.updated.length,
    ongoing: grouped.ongoing.length,
    low: grouped.low.length,
  };
  const hasContent = counts.new + counts.updated + counts.ongoing > 0;
  const subject = `【校园热点日报】${school} · ${today} · ${hasContent ? `新增 ${counts.new} 个热点` : "今日无新增热点"}`;

  const SECTION_META: Record<TopicStatus, { icon: string; color: string }> = {
    new: { icon: "🔥", color: "#e11d48" },
    updated: { icon: "📌", color: "#d97706" },
    ongoing: { icon: "⏳", color: "#2563eb" },
    low: { icon: "📎", color: "#6b7280" },
  };
  // 日报保持简洁：每区按热度截断展示，其余折叠为标题列表
  const SECTION_LIMIT: Record<TopicStatus, number> = { new: 8, updated: 5, ongoing: 5, low: 30 };

  const sb = statusBox(input);

  let html =
    `<div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#111827;">` +
    `<div style="border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:14px;">` +
    `<div style="font-size:19px;font-weight:700;">校园热点日报 · ${esc(school)}</div>` +
    `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${esc(today)} · 由 CampusRadar 自动整理</div></div>` +
    sb.html;

  let text = `校园热点日报 · ${school}\n${today}\n\n${sb.text}\n`;

  if (!hasContent && counts.low === 0) {
    // 诚实空路径：明确解释为什么没有内容
    const allOk = stats.failSources === 0;
    const explain = allOk
      ? `今天没有符合条件的新热点：${stats.okSources} 个来源均正常工作，共获取 ${stats.totalFetched} 条内容，其中 ${stats.totalNew} 条为新抓取，但经去重合并后均未形成值得关注的今日热点。这不是数据源故障，请放心。`
      : `今天没有符合条件的新热点。注意：有 ${stats.failSources} 个来源获取失败（见上方失败列表），其余 ${stats.okSources} 个来源正常，共获取 ${stats.totalFetched} 条。无热点的结论仅基于正常来源的数据。`;
    html +=
      `<div style="margin:20px 0;padding:18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:14px;line-height:1.8;color:#166534;">` +
      `<div style="font-weight:700;font-size:15px;margin-bottom:6px;">✅ 今日无新增热点</div>${esc(explain)}</div>`;
    text += `\n✅ 今日无新增热点\n${explain}\n`;
  }

  for (const status of order) {
    const list = grouped[status];
    if (list.length === 0) continue;
    const meta = SECTION_META[status];
    const shown = status === "low" ? list.slice(0, SECTION_LIMIT.low) : list.slice(0, SECTION_LIMIT[status]);
    const folded = list.slice(shown.length);
    html +=
      `<div style="margin:22px 0 6px;font-size:16px;font-weight:700;color:${meta.color};">${meta.icon} ${STATUS_LABEL[status]}（${list.length}）</div>`;
    text += `\n${meta.icon} ${STATUS_LABEL[status]}（${list.length}）\n`;
    if (status === "low" || folded.length > 0) {
      const compactList = status === "low" ? shown : folded;
      // 低相关/被折叠内容：紧凑标题列表
      html +=
        `<div style="font-size:13px;color:#4b5563;line-height:1.9;">` +
        compactList
          .map(
            (c) =>
              `· ${esc(c.view.title)} ${badge(c.evidence)}${c.lowRelevance ? '<span style="font-size:11px;color:#9ca3af;">（不含关注关键词）</span>' : ""}`,
          )
          .join("<br/>") +
        (folded.length > 0 && status !== "low"
          ? `<br/><span style="font-size:12px;color:#9ca3af;">已按热度折叠 ${folded.length} 条较低热度内容（完整列表见网页版）</span>`
          : "") +
        `</div>`;
      text +=
        compactList.map((c) => `· ${c.view.title} [${EVIDENCE_LABEL[c.evidence]}]`).join("\n") +
        (folded.length > 0 && status !== "low" ? `\n（已按热度折叠 ${folded.length} 条）` : "") +
        "\n";
    }
    if (status !== "low") {
      for (const c of shown) {
        html += topicBlock(c, input);
        text += topicText(c, input) + "\n";
      }
    }
  }

  // 失败提示（要求 5）
  const failed = stats.sources.filter((s) => !s.ok);
  if (failed.length) {
    html +=
      `<div style="margin-top:20px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#991b1b;">` +
      `<b>⚠ 来源获取失败提示</b><br/>` +
      failed.map((f) => `${esc(f.name)}：${esc(f.error ?? "未知错误")} — 已跳过并将在下次运行重试`).join("<br/>") +
      `</div>`;
  }

  const footerBits: string[] = [];
  footerBits.push(`本日报由公开来源自动聚合生成；「社区讨论」类内容均为未经证实的传闻，不构成事实陈述。`);
  if (input.includeKeywords.length) footerBits.push(`你的关注关键词：${input.includeKeywords.join("、")}；未命中关键词的内容已降级为低相关。`);
  if (stats.sources.some((s) => s.isMock && s.ok)) footerBits.push(`「模拟校园论坛」为 Mock 演示数据，用于展示分类与生命周期，不代表真实论坛。`);
  if (input.appUrl) footerBits.push(`<a href="${esc(input.appUrl)}/settings" style="color:#2563eb;">修改订阅设置</a>`);
  if (input.shareUrl) footerBits.push(`<a href="${esc(input.shareUrl)}" style="color:#2563eb;">查看/分享网页版日报</a>`);

  html +=
    `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;line-height:1.8;">` +
    footerBits.map((f) => (f.startsWith("<") ? f : esc(f))).join("<br/>") +
    `</div></div>`;

  text += `\n——\n` + footerBits.map((f) => f.replace(/<[^>]+>/g, "")).join("\n") + `\n`;

  return { subject, html, text, counts, hasContent };
}
