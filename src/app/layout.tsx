import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "校园热点雷达 CampusRadar",
  description: "多来源校园热点追踪 · 去重合并 · 分类整理 · 每日邮件日报",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">雷</span>
              <span className="text-base font-bold">校园热点雷达</span>
              <span className="hidden text-xs text-slate-400 sm:inline">CampusRadar · 笔试题 6</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">首页</Link>
              <Link href="/history" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">历史日报</Link>
              <Link href="/sources" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">来源说明</Link>
              {user ? (
                <>
                  <Link href="/settings" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">设置</Link>
                  <span className="ml-1 hidden max-w-36 truncate text-xs text-slate-400 md:inline">{user.email}</span>
                  <LogoutButton />
                </>
              ) : (
                <Link href="/login" className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700">登录</Link>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

        <footer className="mt-12 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-6 text-slate-500">
            <p>
              <b className="text-slate-700">数据来源说明：</b>
              清华大学官网新闻、Google News RSS 为真实公开来源；「模拟校园论坛 / 模拟校园媒体」为
              <span className="mx-1 rounded bg-purple-50 px-1.5 py-0.5 font-medium text-purple-700">Mock 演示数据</span>
              （用于演示传闻分类与热点生命周期，不代表真实论坛内容）；百度贴吧为受限来源演示（预期 403 降级）。
            </p>
            <p>
              <b className="text-slate-700">已知限制：</b>
              Vercel 免费档 cron 每日一次（自定义发送时间由 GitHub Actions 每小时补跑，误差 ≤1 小时）；海外服务器访问
              .edu.cn 偶发缓慢（8s 超时 + 重试 + 状态展示）；未配置 LLM Key 时总结为规则抽取式；详见
              <Link href="/sources" className="ml-1 text-blue-600 hover:underline">来源说明页</Link>。
            </p>
            <p className="mt-2 text-slate-400">CampusRadar · 校园热点追踪工具 · 每日自动运行 + 邮件日报</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
