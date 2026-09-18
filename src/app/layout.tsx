import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import SiteNav from "@/components/SiteNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "校园热点雷达 CampusRadar",
  description: "多来源校园热点追踪 · 去重合并 · 分类整理 · 每日邮件日报",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-surface font-sans text-slate-900 antialiased">
        <SiteNav email={user?.email ?? null} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="mt-12 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-7">
            <div className="max-w-4xl space-y-2 text-xs leading-6 text-slate-500">
              <p>
                <b className="font-semibold text-slate-700">数据来源说明：</b>
                清华大学官网新闻、Google News RSS 为真实公开来源；「模拟校园论坛 / 模拟校园媒体」为
                <span className="mx-1 rounded bg-purple-50 px-1.5 py-0.5 font-medium text-purple-700">Mock 演示数据</span>
                （用于演示传闻分类与热点生命周期，不代表真实论坛内容）；百度贴吧为受限来源演示（预期 403 降级）。
              </p>
              <p>
                <b className="font-semibold text-slate-700">已知限制：</b>
                Vercel 免费档 cron 每日一次（自定义发送时间由 GitHub Actions 每小时补跑，误差 ≤1 小时）；海外服务器访问
                .edu.cn 偶发缓慢（8s 超时 + 重试 + 状态展示）；未配置 LLM Key 时总结为规则抽取式；详见
                <Link href="/sources" className="ml-1 text-accent hover:underline">来源说明页</Link>。
              </p>
              <p className="pt-1 text-slate-400">CampusRadar · 校园热点追踪工具 · 每日自动运行 + 邮件日报</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
