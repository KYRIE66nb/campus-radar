import type { Classified, TopicStatus } from "@/lib/classify";
import { EVIDENCE_LABEL } from "@/lib/classify";
import { topicSummary, type SourceInfo } from "@/lib/report";
import { lastNDays, shiftDay } from "@/lib/time";
import {
  Flame,
  Pin,
  Clock3,
  Paperclip,
  BadgeCheck,
  Newspaper,
  MessagesSquare,
  FlaskConical,
  TrendingUp,
  Minus,
  TrendingDown,
  ExternalLink,
} from "lucide-react";
import FeedbackButtons from "./FeedbackButtons";

const STATUS_META: Record<TopicStatus, { icon: typeof Flame; label: string; pill: string; border: string }> = {
  new: { icon: Flame, label: "今天新出现", pill: "bg-hot-soft text-red-700", border: "border-l-hot" },
  updated: { icon: Pin, label: "已有重要更新", pill: "bg-amber-50 text-amber-700", border: "border-l-amber-500" },
  ongoing: { icon: Clock3, label: "持续受到关注", pill: "bg-blue-50 text-blue-700", border: "border-l-blue-500" },
  low: { icon: Paperclip, label: "普通 / 低相关", pill: "bg-slate-100 text-slate-600", border: "border-l-slate-300" },
};

const EVIDENCE_META: Record<string, { icon: typeof BadgeCheck; cls: string }> = {
  official: { icon: BadgeCheck, cls: "bg-emerald-50 text-emerald-700" },
  media: { icon: Newspaper, cls: "bg-blue-50 text-blue-700" },
  discussion: { icon: MessagesSquare, cls: "bg-amber-50 text-amber-800" },
  mock: { icon: FlaskConical, cls: "bg-purple-50 text-purple-700" },
};

const TREND_META: Record<string, { icon: typeof TrendingUp; text: string; cls: string }> = {
  up: { icon: TrendingUp, text: "升温", cls: "text-red-600" },
  flat: { icon: Minus, text: "平稳", cls: "text-slate-400" },
  down: { icon: TrendingDown, text: "退热", cls: "text-emerald-600" },
};

export function TopicSection({
  status,
  topics,
  sourceInfo,
  today,
  limit,
}: {
  status: TopicStatus;
  topics: Classified[];
  sourceInfo: Record<string, SourceInfo>;
  today: string;
  limit?: number;
}) {
  if (topics.length === 0) return null;
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const shown = limit ? topics.slice(0, limit) : topics;
  const rest = topics.length - shown.length;

  return (
    <section className="mt-9" aria-label={meta.label}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${meta.pill}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {meta.label}
          <span className="font-semibold opacity-70">{topics.length}</span>
        </span>
        <span className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
      </div>

      {status === "low" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
          {shown.map((c) => {
            const ev = EVIDENCE_META[c.evidence];
            const EvIcon = ev?.icon ?? MessagesSquare;
            return (
              <div key={c.view.topicId} className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>{c.view.title}</span>
                {c.todayItems.length > 0 && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-600">今日 +{c.todayItems.length}</span>
                )}
                <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${ev?.cls ?? ""}`}>
                  <EvIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {EVIDENCE_LABEL[c.evidence]}
                </span>
                {c.lowRelevance && <span className="text-xs text-slate-400">（不含关注关键词）</span>}
              </div>
            );
          })}
          {rest > 0 && <p className="mt-1.5 text-xs text-slate-400">…其余 {rest} 条略</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((c) => (
            <TopicCard key={c.view.topicId} c={c} sourceInfo={sourceInfo} today={today} meta={meta} />
          ))}
          {rest > 0 && (
            <p className="text-xs text-slate-400">已按热度展示前 {shown.length} 条，其余 {rest} 条在邮件日报中折叠展示</p>
          )}
        </div>
      )}
    </section>
  );
}

function TopicCard({
  c,
  sourceInfo,
  today,
  meta,
}: {
  c: Classified;
  sourceInfo: Record<string, SourceInfo>;
  today: string;
  meta: (typeof STATUS_META)["new"];
}) {
  const ev = EVIDENCE_META[c.evidence];
  const EvIcon = ev?.icon ?? MessagesSquare;
  const trend = TREND_META[c.trend];
  const TrendIcon = trend.icon;
  const heatPct = Math.min(100, Math.round((c.heat / 120) * 100));
  const days = lastNDays(7, today);
  const items = [...c.view.items].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 5);

  return (
    <article
      className={`rounded-xl border border-slate-200 border-l-[3px] ${meta.border} bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.07)] ${
        c.evidence === "mock" ? "bg-purple-50/30" : ""
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold leading-snug text-ink">{c.view.title}</h3>
        <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${ev?.cls ?? ""}`}>
          <EvIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {EVIDENCE_LABEL[c.evidence]}
        </span>
        <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend.cls}`}>
          <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {trend.text}
        </span>
        {c.matchedKeywords.map((k) => (
          <span key={k} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
            关键词·{k}
          </span>
        ))}
      </div>

      <p className="text-sm leading-6 text-slate-700">{topicSummary(c)}</p>

      <p className="mt-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-600">关注原因：</span>
        {c.why.join("；")}
      </p>

      {/* 生命周期：近 7 天活跃点 + 热度条 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2" aria-label={`近 7 天活跃度，首次出现于 ${c.view.firstSeenDay}`}>
          <span className="text-[11px] text-slate-400">近 7 天</span>
          <span className="flex items-end gap-[3px]">
            {days.map((d) => {
              const n = c.view.dayCounts[d] ?? 0;
              const h = n === 0 ? 3 : Math.min(14, 4 + n * 4);
              return (
                <span
                  key={d}
                  title={`${d}：${n} 条`}
                  className={`w-[5px] rounded-sm ${n > 0 ? (d === today ? "bg-hot" : "bg-slate-400") : "bg-slate-200"}`}
                  style={{ height: `${h}px` }}
                  aria-hidden="true"
                />
              );
            })}
          </span>
          <span className="text-[11px] text-slate-400">
            首现 {c.view.firstSeenDay.slice(5).replace(/-/g, "/")} · 累计 {c.view.items.length} 条 · 今日 +{c.todayItems.length}
          </span>
        </div>
        <div className="flex items-center gap-2" aria-label={`热度 ${c.heat}`}>
          <span className="text-[11px] text-slate-400">热度</span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className="block h-full rounded-full bg-gradient-to-r from-orange-400 to-hot" style={{ width: `${heatPct}%` }} />
          </span>
          <span className="text-xs font-semibold tabular-nums text-slate-600">{c.heat}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-xs">
        <span className="text-slate-400">来源：</span>
        {items.map((i, idx) => {
          const name = sourceInfo[i.sourceId]?.name ?? i.sourceId;
          const label = `${name} ${i.day.slice(5).replace(/-/g, "/")}`;
          return /^https?:\/\//.test(i.url) ? (
            <a
              key={idx}
              href={i.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-accent transition-colors duration-200 hover:underline"
            >
              {label}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            <span key={idx} className="text-slate-400">{label}（Mock·无原文）</span>
          );
        })}
      </div>

      <div className="mt-2.5 border-t border-slate-100 pt-2.5">
        <FeedbackButtons topicId={c.view.topicId} />
      </div>
    </article>
  );
}
