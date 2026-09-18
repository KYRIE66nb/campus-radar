"use client";

import { useState } from "react";

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

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <label className="mb-1 block text-sm font-semibold">学校名称</label>
        <div className="flex gap-2">
          <select
            className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          >
            {SCHOOL_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="其他">其他学校…</option>
          </select>
          {school === "其他" && (
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="输入学校全称（将仅使用 Google News 通用来源）"
              value={customSchool}
              onChange={(e) => setCustomSchool(e.target.value)}
            />
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          已接入官网来源的学校：清华大学、中国科学技术大学；其他学校自动降级为「Google News + Mock 演示」并在来源页说明。
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">关注关键词（用、分隔，≤10 个）</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="如：食堂、讲座、校招、AI"
            value={includeKw}
            onChange={(e) => setIncludeKw(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">命中的话题加权排序；未命中的非官方话题降入「低相关」区。</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">排除关键词</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="如：广告、招生宣讲"
            value={excludeKw}
            onChange={(e) => setExcludeKw(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">命中任一排除词的条目直接丢弃，不进入话题。</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">收件邮箱（日报发送到）</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="reviewer@example.com"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">每日发送时间（北京时间）</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
          >
            {hours.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
        启用邮件日报（关闭后仍会生成日报与运行记录，但不发邮件）
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold">当前邮件通道</p>
        <p className="mt-1 text-slate-600">
          {mailMode === "smtp" && "✅ SMTP 已配置（真实发送，可发任意收件邮箱）"}
          {mailMode === "resend" && "✅ Resend 已配置（真实发送；注意免费档无自有域名时仅能发给 Resend 账户本人邮箱）"}
          {mailMode === "dry_run" && "⚠ 未配置 SMTP / Resend 凭据：当前为 dry-run，邮件不会实际发出（界面会明确标注）。部署方在环境变量中配置 SMTP_HOST/USER/PASS 后即可真实发送。"}
        </p>
        <p className="mt-2 font-semibold">公开分享链接</p>
        <p className="mt-1 break-all text-blue-600">{shareUrl}</p>
      </div>

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
      )}

      <button
        onClick={save}
        disabled={busy || (school === "其他" && !customSchool.trim())}
        className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? "保存中…" : "保存设置"}
      </button>
    </div>
  );
}
