"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Radar, Zap, Loader2, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function submit(payloadEmail: string, payloadPassword: string, registerName?: string, tag = "submit") {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(registerName ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          registerName
            ? { email: payloadEmail, password: payloadPassword, name: registerName }
            : { email: payloadEmail, password: payloadPassword },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登录失败");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="h-1.5 bg-gradient-to-r from-hot via-rose-500 to-accent" aria-hidden="true" />
        <div className="p-7">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white shadow-inner">
              <Radar className="h-6 w-6" aria-hidden="true" strokeWidth={2.2} />
            </span>
            <h1 className="text-lg font-bold tracking-tight text-ink">
              {mode === "login" ? "登录校园热点雷达" : "创建新账号"}
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">配置学校与关键词，收每日热点日报</p>
          </div>

          <button
            className="mb-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-hot px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => submit("review@demo.campus", "demo1234", undefined, "demo")}
          >
            {busy === "demo" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="h-4 w-4" aria-hidden="true" />
            )}
            {busy === "demo" ? "正在进入…" : "评审一键登录（预置演示数据）"}
          </button>

          <div className="mb-5 flex items-center gap-3 text-[11px] text-slate-300" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-100" />
            或使用邮箱
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(email, password, mode === "register" ? name || undefined : undefined);
            }}
          >
            {mode === "register" && (
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 placeholder:text-slate-400 focus:border-accent"
                placeholder="昵称（可选）"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 placeholder:text-slate-400 focus:border-accent"
              placeholder="邮箱"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 placeholder:text-slate-400 focus:border-accent"
              placeholder="密码（至少 6 位）"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-hot-soft px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full cursor-pointer rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy !== null}
            >
              {busy === "submit" ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            {mode === "login" ? (
              <>没有账号？<button type="button" className="cursor-pointer font-medium text-accent hover:underline" onClick={() => setMode("register")}>注册一个</button></>
            ) : (
              <>已有账号？<button type="button" className="cursor-pointer font-medium text-accent hover:underline" onClick={() => setMode("login")}>去登录</button></>
            )}
          </p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-slate-400">
        测试账号：review@demo.campus / demo1234<br />
        演示学校：清华大学（真实来源 + 预置 7 天历史日报）
      </p>
    </div>
  );
}
