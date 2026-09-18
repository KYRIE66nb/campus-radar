import type { Classified, TopicStatus } from "@/lib/classify";
import { EVIDENCE_LABEL } from "@/lib/classify";
import { topicSummary } from "@/lib/report";
import type { SourceInfo } from "@/lib/report";
import FeedbackButtons from "./FeedbackButtons";

const STATUS_STYLE: Record<TopicStatus, { icon: string; label: string; cls: string; border: string }> = {
  new: { icon: "🔥", label: "今天新出现", cls: "bg-rose-50 text-rose-700", border: "border-l-rose-500" },
  updated: { icon: "📌", label: "已有重要更新", cls: "bg-amber-50 text-amber-700", border: "border-l-amber-500" },
  ongoing: { icon: "⏳", label: "持续受到关注", cls: "bg-blue-50 text-blue-700", border: "border-l-blue-500" },
  low: { icon: "📎", label: "普通 / 低相关", cls: "bg-slate-100 text-slate-600", border: "border-l-slate-300" },
};

const EVIDENCE_STYLE: Record<string, string> = {
  official: "bg-emerald-50 text-emerald-700",
  media: "bg-blue-50 text-blue-700",
  discussion: "bg-amber-50 text-amber-800",
  mock: "bg-purple-50 text-purple-700",
};

const TREND: Record<string, { arrow: string; cls: string }> = {
  up: { arrow: "↗ 升温", cls: "text-rose-600" },
  flat: { arrow: "→ 平稳", cls: "text-slate-400" },
  down: { arrow: "↘ 退热", cls: "text-emerald-600" },
};

export function TopicSection({
  status,
  topics,
  sourceInfo,
  limit,
}: {
  status: TopicStatus;
  topics: Classified[];
  sourceInfo: Record<string, SourceInfo>;
  limit?: number;
}) {
  if (topics.length === 0) return null;
  const meta = STATUS_STYLE[status];
  const shown = limit ? topics.slice(0, limit) : topics;
  const rest = topics.length - shown.length;
  return (
    <section className="mt-8">
      <h2 className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${meta.cls}`}>
        <span>{meta.icon}</span>
        {meta.label}
        <span className="opacity-70">（{topics.length}）</span>
      </h2>
      {status === "low" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
          {shown.map((c) => (
            <div key={c.view.topicId} className="flex flex-wrap items-center gap-2">
              <span>· {c.view.title}</span>
              <Badge cls={EVIDENCE_STYLE[c.evidence]} text={EVIDENCE_LABEL[c.evidence]} />
              {c.lowRelevance && <span className="text-xs text-slate-400">（不含关注关键词）</span>}
            </div>
          ))}
          {rest > 0 && <p className="mt-1 text-xs text-slate-400">…其余 {rest} 条略</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((c) => (
            <TopicCard key={c.view.topicId} c={c} sourceInfo={sourceInfo} meta={meta} />
          ))}
          {rest > 0 && <p className="text-xs text-slate-400">已按热度展示前 {shown.length} 条，其余 {rest} 条见历史日报与邮件折叠区</p>}
        </div>
      )}
    </section>
  );
}

function Badge({ cls, text }: { cls: string; text: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}

function TopicCard({ c, sourceInfo, meta }: { c: Classified; sourceInfo: Record<string, SourceInfo>; meta: (typeof STATUS_STYLE)["new"] }) {
  const first = c.view.firstSeenDay.slice(5).replace(/-/g, "/");
  const todayAdd = c.todayItems.length;
  const items = [...c.view.items].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 5);
  const trend = TREND[c.trend];
  return (
    <article className={`rounded-xl border border-slate-200 border-l-4 ${meta.border} bg-white p-4 ${c.evidence === "mock" ? "bg-purple-50/40" : ""}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-slate-900">{c.view.title}</h3>
        <Badge cls={EVIDENCE_STYLE[c.evidence]} text={EVIDENCE_LABEL[c.evidence]} />
        <span className={`text-xs font-medium ${trend.cls}`}>{trend.arrow}</span>
        <span className="text-xs text-slate-400">热度 {c.heat}</span>
        {c.matchedKeywords.map((k) => (
          <Badge key={k} cls="bg-indigo-50 text-indigo-700" text={`关键词·${k}`} />
        ))}
      </div>
      <p className="text-sm leading-6 text-slate-700">{topicSummary(c)}</p>
      <p className="mt-1.5 text-xs text-slate-500">📌 关注原因：{c.why.join("；")}</p>
      <p className="mt-1 text-xs text-slate-400">🕒 首次出现 {first} · 累计 {c.view.items.length} 条 · 今日 +{todayAdd}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-400">来源：</span>
        {items.map((i, idx) => {
          const name = sourceInfo[i.sourceId]?.name ?? i.sourceId;
          const label = `${name} ${i.day.slice(5).replace(/-/g, "/")}`;
          return /^https?:\/\//.test(i.url) ? (
            <a key={idx} href={i.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {label} ↗
            </a>
          ) : (
            <span key={idx} className="text-slate-400">{label}（Mock·无原文）</span>
          );
        })}
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2">
        <FeedbackButtons topicId={c.view.topicId} />
      </div>
    </article>
  );
}
