"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play, Loader2, CheckCircle2, AlertTriangle, Info, Mail, MailWarning } from "lucide-react";

interface RunResult {
  ok: boolean;
  result?: {
    runId: number;
    stats: {
      totalFetched: number;
      totalNew: number;
      okSources: number;
      failSources: number;
      topicsNew: number;
      topicsUpdated: number;
      topicsOngoing: number;
      topicsLow: number;
      sources: { name: string; ok: boolean; error?: string; isMock: boolean }[];
    };
    emailStatus: string | null;
    emailError: string | null;
    subject: string | null;
  };
  error?: string;
}

const EMAIL_LABEL: Record<string, { text: string; icon: typeof Mail; cls: string }> = {
  sent: { text: "日报邮件已发送，请查收收件箱（含垃圾箱）", icon: CheckCircle2, cls: "text-emerald-700" },
  dry_run: { text: "邮件 dry-run：未配置 SMTP/Resend 凭据，未实际发送（界面如实标注）", icon: MailWarning, cls: "text-amber-700" },
  failed: { text: "邮件发送失败", icon: AlertTriangle, cls: "text-red-700" },
  skipped_no_recipient: { text: "未设置收件邮箱：已生成网页版日报，未发邮件", icon: Info, cls: "text-slate-600" },
  skipped_disabled: { text: "邮件日报开关已关闭", icon: Info, cls: "text-slate-600" },
  skipped_cap: { text: "已达每日发送上限", icon: AlertTriangle, cls: "text-amber-700" },
  skipped: { text: "本次未发送邮件", icon: Info, cls: "text-slate-600" },
};

export default function RunButton({ hasRecipient, emailEnabled }: { hasRecipient: boolean; emailEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<RunResult | null>(null);

  async function run() {
    setBusy(true);
    setOutput(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail: true }),
      });
      setOutput(await res.json());
      router.refresh();
    } catch (e) {
      setOutput({ ok: false, error: e instanceof Error ? e.message : "运行失败" });
    } finally {
      setBusy(false);
    }
  }

  const r = output?.result;
  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={busy}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-hot px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        )}
        {busy ? "正在抓取来源并生成日报…" : "立即运行一次（实时抓取）"}
      </button>
      {busy && <p className="text-xs text-slate-400">并行抓取各来源（8s 超时 + 1 次重试），约需 10–30 秒</p>}
      {!hasRecipient && !busy && (
        <p className="text-xs text-slate-500">
          未设收件邮箱，本次不会发邮件 —— 到
          <a href="/settings" className="mx-1 font-medium text-accent hover:underline">设置页</a>
          填写后再运行即可收到真实邮件。
        </p>
      )}
      {hasRecipient && !emailEnabled && !busy && (
        <p className="text-xs text-slate-500">邮件日报开关已关闭，可在设置页开启。</p>
      )}
      {output && (
        <div
          role="status"
          className={`rounded-xl border p-3.5 text-sm ${
            output.ok ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-hot-soft"
          }`}
        >
          {!output.ok && (
            <p className="flex items-center gap-1.5 font-medium text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />运行失败：{output.error}
            </p>
          )}
          {r && (
            <div className="space-y-1.5 text-slate-700">
              <p className="font-semibold text-ink">{r.subject}</p>
              <p className="tabular-nums">
                来源 {r.stats.okSources} 成功 / {r.stats.failSources} 失败 · 获取 {r.stats.totalFetched} 条 · 新增入库{" "}
                {r.stats.totalNew} 条 · 话题：新 {r.stats.topicsNew} · 更新 {r.stats.topicsUpdated} · 持续{" "}
                {r.stats.topicsOngoing} · 低相关 {r.stats.topicsLow}
              </p>
              {r.emailStatus && (
                <p className={`flex items-start gap-1.5 font-medium ${EMAIL_LABEL[r.emailStatus]?.cls ?? "text-slate-600"}`}>
                  {(() => {
                    const Icon = EMAIL_LABEL[r.emailStatus]?.icon ?? Info;
                    return <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />;
                  })()}
                  {EMAIL_LABEL[r.emailStatus]?.text ?? r.emailStatus}
                  {r.emailError ? `（${r.emailError}）` : ""}
                </p>
              )}
              {r.stats.sources.filter((s) => !s.ok).length > 0 && (
                <p className="flex items-start gap-1.5 text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  失败来源（已跳过，未阻断日报）：
                  {r.stats.sources.filter((s) => !s.ok).map((s) => `${s.name}（${s.error}）`).join("；")}
                </p>
              )}
              <a href="/history" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                查看本次日报 →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
