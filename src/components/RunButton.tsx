"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

const EMAIL_LABEL: Record<string, string> = {
  sent: "✅ 日报邮件已发送",
  dry_run: "⚠ 邮件 dry-run（未配置 SMTP/Resend 凭据，未实际发送）",
  failed: "❌ 邮件发送失败",
  skipped_no_recipient: "ℹ 未设置收件邮箱，仅生成了网页版日报",
  skipped_disabled: "ℹ 邮件日报开关已关闭",
  skipped_cap: "⚠ 已达每日发送上限",
  skipped: "ℹ 本次未发送邮件",
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
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
      >
        {busy ? "正在抓取来源并生成日报（约 10–30 秒）…" : "▶ 立即运行一次（实时抓取）"}
      </button>
      {!hasRecipient && (
        <p className="text-xs text-slate-500">
          尚未设置收件邮箱：运行会生成日报与运行记录，但不会发邮件。到
          <a href="/settings" className="mx-1 text-blue-600 hover:underline">设置页</a>
          填写邮箱后再运行，即可收到真实邮件。
        </p>
      )}
      {hasRecipient && !emailEnabled && (
        <p className="text-xs text-slate-500">邮件日报开关已关闭，可在设置页开启。</p>
      )}
      {output && (
        <div className={`rounded-lg border p-3 text-sm ${output.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          {!output.ok && <p className="font-medium text-red-600">运行失败：{output.error}</p>}
          {r && (
            <div className="space-y-1 text-slate-700">
              <p className="font-semibold">{r.subject}</p>
              <p>
                来源 {r.stats.okSources} 成功 / {r.stats.failSources} 失败 · 获取 {r.stats.totalFetched} 条 · 新增入库{" "}
                {r.stats.totalNew} 条 · 话题：新 {r.stats.topicsNew} · 更新 {r.stats.topicsUpdated} · 持续{" "}
                {r.stats.topicsOngoing} · 低相关 {r.stats.topicsLow}
              </p>
              {r.emailStatus && <p>{EMAIL_LABEL[r.emailStatus] ?? r.emailStatus}{r.emailError ? `（${r.emailError}）` : ""}</p>}
              {r.stats.sources.filter((s) => !s.ok).length > 0 && (
                <p className="text-amber-700">
                  失败来源（已跳过，未阻断日报）：
                  {r.stats.sources.filter((s) => !s.ok).map((s) => `${s.name}（${s.error}）`).join("；")}
                </p>
              )}
              <a href="/history" className="inline-block text-blue-600 hover:underline">查看本次日报 →</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
