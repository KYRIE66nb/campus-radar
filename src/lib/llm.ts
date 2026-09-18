import type { Classified } from "./classify";
import { topicSummary } from "./report";

/**
 * 可选 LLM 总结增强。设计原则：
 *  - 未配置 LLM_API_KEY → 直接返回 null，调用方使用规则式总结（永不失败）；
 *  - 超时 12 秒、任何异常 → 返回 null 整体回退，绝不抛错阻断日报；
 *  - 输出校验：必须是 {id, summary} 数组；讨论/传闻类必须保留"未经证实"表述，
 *    否则该条丢弃（宁可用保守的规则总结，也不让 AI 把传闻写成事实）。
 */
export async function enhanceSummaries(
  topics: Classified[],
): Promise<Map<number, string> | null> {
  const key = process.env.LLM_API_KEY;
  if (!key || topics.length === 0) return null;
  const base = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  const payload = topics.map((t) => ({
    id: t.view.topicId,
    evidence: t.evidence,
    titles: t.view.items.slice(-6).map((i) => i.title),
  }));

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是校园新闻编辑。为每个话题写不超过60字的中文总结。规则：evidence=official 时以「官方发布：」开头；media 以「据媒体报道：」开头；discussion/mock 必须以「据讨论（未经证实）：」开头，且不得把传闻写成确定事实。只输出 JSON 数组 [{\"id\":number,\"summary\":string}]。",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const raw = String(data?.choices?.[0]?.message?.content ?? "").trim();
    const jsonText = raw.startsWith("```") ? raw.replace(/^```(json)?|```$/g, "") : raw;
    const arr = JSON.parse(jsonText);
    if (!Array.isArray(arr)) return null;
    const map = new Map<number, string>();
    const byId = new Map(topics.map((t) => [t.view.topicId, t]));
    for (const row of arr) {
      const id = Number(row?.id);
      const summary = String(row?.summary ?? "").trim();
      const t = byId.get(id);
      if (!t || !summary || summary.length > 100) continue;
      const needRumor = t.evidence === "discussion" || t.evidence === "mock";
      if (needRumor && !/未经证实|网传|据讨论/.test(summary)) continue;
      map.set(id, summary);
    }
    return map;
  } catch {
    return null;
  }
}

/** 应用增强：LLM 结果只覆盖规则总结，缺失的条目保持规则版 */
export function applyEnhanced(topics: Classified[], enhanced: Map<number, string> | null) {
  if (!enhanced) return topics.map((t) => ({ t, summary: topicSummary(t) }));
  return topics.map((t) => ({ t, summary: enhanced.get(t.view.topicId) ?? topicSummary(t) }));
}
