"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(payloadEmail: string, payloadPassword: string, registerName?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(registerName ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerName ? { email: payloadEmail, password: payloadPassword, name: registerName } : { email: payloadEmail, password: payloadPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登录失败");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">{mode === "login" ? "登录" : "注册新账号"}</h1>
        <p className="mb-5 text-sm text-slate-500">校园热点雷达 · 配置学校关键词，收每日热点日报</p>

        <button
          className="mb-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          disabled={busy}
          onClick={() => submit("review@demo.campus", "demo1234")}
        >
          ⚡ 评审一键登录（预置清华大学演示数据）
        </button>

        <div className="space-y-3">
          {mode === "register" && (
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="昵称（可选）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="邮箱"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="密码（至少 6 位）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => submit(email, password, mode === "register" ? name || undefined : undefined)}
          >
            {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {mode === "login" ? (
            <>没有账号？<button className="text-blue-600 hover:underline" onClick={() => setMode("register")}>注册一个</button></>
          ) : (
            <>已有账号？<button className="text-blue-600 hover:underline" onClick={() => setMode("login")}>去登录</button></>
          )}
        </p>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-slate-400">
        测试账号：review@demo.campus / demo1234<br />
        演示学校：清华大学（官网新闻 + Google News 真实来源，预置 7 天历史日报）
      </p>
    </div>
  );
}
