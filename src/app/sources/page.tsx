import { db } from "@/db";
import { sourceHealth, sourceState } from "@/db/schema";
import { allSourceMetas, KIND_LABEL } from "@/lib/sources";
import { fmtDateTimeSH, lastNDays } from "@/lib/time";
import {
  Globe,
  Rss,
  MessageSquareWarning,
  FlaskConical,
  Bug,
  Gauge,
  LifeBuoy,
  TriangleAlert,
  CircleCheck,
  CircleX,
} from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_BADGE: Record<string, { icon: typeof Globe; cls: string }> = {
  official: { icon: Globe, cls: "bg-emerald-50 text-emerald-700" },
  media: { icon: Rss, cls: "bg-blue-50 text-blue-700" },
  forum: { icon: MessageSquareWarning, cls: "bg-amber-50 text-amber-800" },
  mock: { icon: FlaskConical, cls: "bg-purple-50 text-purple-700" },
};

export default async function SourcesPage() {
  const demoSchool = "清华大学";
  const metas = allSourceMetas(demoSchool);
  const [states, health] = await Promise.all([
    db.select().from(sourceState),
    db.select().from(sourceHealth),
  ]);
  const stateById = new Map(states.map((x) => [x.sourceId, x]));
  const healthBySource = new Map<string, Map<string, { ok: number; fail: number }>>();
  for (const h of health) {
    const m = healthBySource.get(h.sourceId) ?? new Map();
    m.set(h.day, { ok: h.okCount, fail: h.failCount });
    healthBySource.set(h.sourceId, m);
  }
  const days = lastNDays(14);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-slate-400">透明度</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">数据来源与运行策略说明</h1>
      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
        本页说明每个来源的获取方式、访问限制、频率控制与失败策略（必做要求第 7 条），以及 Mock 数据与已知限制。
      </p>

      {/* 来源清单 */}
      <section className="mt-7 space-y-3" aria-label="来源清单">
        {metas.map((m) => {
          const st = stateById.get(m.id);
          const hm = healthBySource.get(m.id);
          const badge = KIND_BADGE[m.kind];
          const BadgeIcon = badge?.icon ?? Globe;
          return (
            <div
              key={m.id}
              className={`rounded-xl border p-4 transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] ${
                m.kind === "mock" ? "border-purple-200 bg-purple-50/30" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-ink">{m.name}</span>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge?.cls ?? ""}`}>
                  <BadgeIcon className="h-3 w-3" aria-hidden="true" />
                  {KIND_LABEL[m.kind]}
                </span>
                {st?.lastStatus === "ok" && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CircleCheck className="h-3 w-3" aria-hidden="true" />正常
                  </span>
                )}
                {st?.lastStatus === "fail" && (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                    <CircleX className="h-3 w-3" aria-hidden="true" />失败（已降级）
                  </span>
                )}
                {!st && m.school && m.school !== demoSchool && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    未接入当前演示学校
                  </span>
                )}
                {!st && !m.school && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">未运行</span>}
                <span className="text-xs tabular-nums text-slate-400">
                  累计 {st?.totalOk ?? 0} 成功 / {st?.totalFail ?? 0} 失败 · 最近 {fmtDateTimeSH(st?.lastRunAt)}
                </span>
              </div>
              <dl className="mt-2.5 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[4.5rem_1fr]">
                <dt className="pt-0.5 text-xs text-slate-400">获取方式</dt>
                <dd className="leading-6 text-slate-700">{m.method}</dd>
                <dt className="pt-0.5 text-xs text-slate-400">访问限制</dt>
                <dd className="leading-6 text-slate-700">{m.limits}</dd>
                {st?.lastError && (
                  <>
                    <dt className="pt-0.5 text-xs text-slate-400">最近错误</dt>
                    <dd className="leading-6 text-red-600">{st.lastError}</dd>
                  </>
                )}
              </dl>
              {/* 近 14 天健康格 */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">近 14 天</span>
                <span className="flex gap-1">
                  {days.map((d) => {
                    const h = hm?.get(d);
                    const cls = !h
                      ? "bg-slate-200"
                      : h.fail > 0 && h.ok === 0
                        ? "bg-red-400"
                        : h.ok > 0 && h.fail > 0
                          ? "bg-amber-400"
                          : "bg-emerald-400";
                    return <span key={d} title={`${d}：成功 ${h?.ok ?? 0} / 失败 ${h?.fail ?? 0}`} className={`inline-block h-3.5 w-3.5 rounded-[3px] ${cls}`} />;
                  })}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-emerald-400" aria-hidden="true" />成功</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-amber-400" aria-hidden="true" />部分失败</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-red-400" aria-hidden="true" />失败</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-slate-200" aria-hidden="true" />无记录</span>
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* 策略说明 */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2.5 flex items-center gap-1.5 font-bold text-ink">
            <Bug className="h-4 w-4 text-slate-400" aria-hidden="true" />
            反爬虫与合规策略
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
            <li>不破解验证码、不模拟登录、不伪造请求绕过限制；仅使用对公众开放的页面 / RSS。</li>
            <li>百度贴吧实测服务端直连返回 <b>403 安全验证</b>：作为「受限来源」常驻展示其失败状态，验证降级逻辑，不计入真实来源。</li>
            <li>微博 / 知乎 / 微信公众号等需要登录态的平台未接入。</li>
            <li>请求头声明自定义 User-Agent（CampusRadar/1.0），不伪装成普通浏览器流量抓取受限内容。</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2.5 flex items-center gap-1.5 font-bold text-ink">
            <Gauge className="h-4 w-4 text-slate-400" aria-hidden="true" />
            请求频率控制
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
            <li>全站来源结果缓存 30 分钟（同一服务实例内），避免重复请求。</li>
            <li>每个来源单次请求 8 秒超时，间隔 1.5 秒重试 1 次，最多 2 次尝试。</li>
            <li>每日正式抓取次数 = 定时运行 1 次 + 少量手动触发，远低于来源承受阈值。</li>
            <li>每用户每日邮件上限 5 封，防止误配置导致的邮件风暴。</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2.5 flex items-center gap-1.5 font-bold text-ink">
            <LifeBuoy className="h-4 w-4 text-slate-400" aria-hidden="true" />
            失败重试 / 跳过 / 降级
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
            <li>各来源<b>并行独立抓取</b>，单来源失败仅记录该来源的状态与错误，绝不阻断其他来源与日报生成。</li>
            <li>失败来源在日报「来源获取失败提示」区如实展示，并在下一次运行自动重试。</li>
            <li>来源解析到 0 条（页面改版）视为失败降级；连续失败在上方健康格中直观可见。</li>
            <li>无任何新内容时输出「今日无新增热点」的诚实结论并解释原因，不制造虚假热点。</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="mb-2.5 flex items-center gap-1.5 font-bold text-ink">
            <TriangleAlert className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Mock 数据与已知限制（诚实声明）
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
            <li>「模拟校园论坛 / 模拟校园媒体」为内置 Mock 数据，全部条目打 <b>Mock 徽章</b>、链接不可点击，用于演示传闻分类与热点生命周期，<b>不冒充实时内容</b>。</li>
            <li>Google News 的原文链接为 Google 跳转链（RSS 原样保留）。</li>
            <li>Vercel 免费档 cron 每日仅触发一次（08:30 北京时间）；自定义发送时间由 GitHub Actions 每小时整点补跑，误差 ≤1 小时。</li>
            <li>海外服务器访问 .edu.cn 偶发缓慢；已用超时 + 重试 + 状态展示兜底，极端情况下该来源降级跳过。</li>
            <li>未配置 LLM API Key 时，总结为规则抽取式（代表性标题 + 来源前缀）；LLM 失败自动回退，不编造内容。</li>
            <li>预置历史日报由回填生成并标注「预置回填」；今日及以后的运行均为真实抓取。</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
