"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Share2, Mail, BellRing } from "lucide-react";

export interface SettingsData {
  school: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  recipientEmail: string | null;
  sendTime: string;
  emailEnabled: boolean;
  shareToken: string;
}

const SCHOOL_OPTIONS = ["清华大学", "中国科学技术大学"];

export default function SettingsForm({ initial, mailMode }: { initial: SettingsData; mailMode: string }) {
  const [school, setSchool] = useState(SCHOOL_OPTIONS.includes(initial.school) ? initial.school : "其他");
  const [customSchool, setCustomSchool] = useState(SCHOOL_OPTIONS.includes(initial.school) ? "" : initial.school);
  const [includeKw, setIncludeKw] = useState(initial.includeKeywords.join("、"));
  const [excludeKw, setExcludeKw] = useState(initial.excludeKeywords.join("、"));
  const [recipient, setRecipient] = useState(initial.recipientEmail ?? "");
  const [sendTime, setSendTime] = useState(initial.sendTime);
  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${initial.shareToken}` : `/r/${initial.shareToken}`;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const finalSchool = school === "其他" ? customSchool.trim() : school;
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school: finalSchool,
          includeKeywords: includeKw.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10),
          excludeKeywords: excludeKw.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10),
          recipientEmail: recipient.trim() || null,
          sendTime,
          emailEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setMsg({ ok: true, text: "已保存。下次运行（手动或定时）将按新配置生成日报。" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 placeholder:text-slate-400 focus:border-accent";

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">追踪目标</h2>
        <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="school-select">学校名称</label>
        <div className="flex gap-2">
          <select id="school-select" className={`${inputCls} w-44 cursor-pointer`} value={school} onChange={(e) => setSchool(e.target.value)}>
            {SCHOOL_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="其他">其他学校…</option>
          </select>
          {school === "其他" && (
            <input
              className={inputCls}
              placeholder="输入学校全称（将仅使用 Google News 通用来源）"
              value={customSchool}
              onChange={(e) => setCustomSchool(e.target.value)}
            />
          )}
        </div>
        <p className="mt-1.5 text-xs leading-5 text-slate-400">
          已接入官网来源：清华大学、中国科学技术大学；其他学校自动降级为「Google News + Mock 演示」并在来源页说明。
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">关键词（个性化）</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="kw-include">关注关键词（、分隔，≤10 个）</label>
            <input id="kw-include" className={inputCls} placeholder="如：食堂、讲座、校招、AI" value={includeKw} onChange={(e) => setIncludeKw(e.target.value)} />
            <p className="mt-1.5 text-xs leading-5 text-slate-400">命中的话题加权排序；未命中的非官方话题降入「低相关」区。</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="kw-exclude">排除关键词</label>
            <input id="kw-exclude" className={inputCls} placeholder="如：广告、招生宣讲" value={excludeKw} onChange={(e) => setExcludeKw(e.target.value)} />
            <p className="mt-1.5 text-xs leading-5 text-slate-400">命中任一排除词的条目直接丢弃，不进入话题。</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-ink">
          <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
          邮件日报
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="recipient">收件邮箱（日报发送到）</label>
            <input id="recipient" className={inputCls} placeholder="reviewer@example.com" type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="sendtime">每日发送时间（北京时间）</label>
            <select id="sendtime" className={`${inputCls} cursor-pointer`} value={sendTime} onChange={(e) => setSendTime(e.target.value)}>
              {hours.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-[#0f172a]"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
          />
          <BellRing className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          启用邮件日报（关闭后仍会生成日报与运行记录，但不发邮件）
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">当前邮件通道</h2>
        <p className="text-sm leading-6 text-slate-600">
          {mailMode === "smtp" && <span className="font-medium text-emerald-700">✅ SMTP 已配置</span>}
          {mailMode === "smtp" && <span className="text-slate-600">（真实发送，可发任意收件邮箱）</span>}
          {mailMode === "resend" && <span className="font-medium text-emerald-700">✅ Resend 已配置</span>}
          {mailMode === "resend" && <span className="text-slate-600">（真实发送；注意免费档无自有域名时仅能发给 Resend 账户本人邮箱）</span>}
          {mailMode === "dry_run" && (
            <span className="text-amber-700">
              ⚠ 未配置 SMTP / Resend 凭据：当前为 dry-run，邮件不会实际发出（界面会明确标注）。部署方在环境变量中配置 SMTP_HOST / SMTP_USER / SMTP_PASS 后即可真实发送。
            </span>
          )}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Share2 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              公开分享链接
            </p>
            <p className="mt-0.5 truncate text-xs text-accent">{shareUrl}</p>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:border-slate-300 hover:text-ink"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* 剪贴板不可用时忽略 */
              }
            }}
          >
            {copied ? "已复制 ✓" : "复制"}
          </button>
        </div>
      </section>

      {msg && (
        <p
          role="status"
          className={`flex items-start gap-1.5 rounded-xl px-3.5 py-2.5 text-sm ${
            msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-hot-soft text-red-700"
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {msg.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy || (school === "其他" && !customSchool.trim())}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ? "保存中…" : "保存设置"}
      </button>
    </div>
  );
}
