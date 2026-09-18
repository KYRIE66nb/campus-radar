"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Radar, History, Newspaper, Settings, LogOut, LogIn, LayoutDashboard } from "lucide-react";

const LINKS = [
  { href: "/", label: "首页", icon: LayoutDashboard, exact: true },
  { href: "/history", label: "历史日报", icon: History },
  { href: "/sources", label: "来源说明", icon: Newspaper },
];

export default function SiteNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="校园热点雷达 首页">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
            <Radar className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={2.2} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight text-ink">校园热点雷达</span>
            <span className="hidden text-[10px] font-medium tracking-widest text-slate-400 sm:block">CAMPUS RADAR</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm" aria-label="主导航">
          {LINKS.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href, exact) ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors duration-200 sm:px-3 ${
                isActive(href, exact)
                  ? "bg-ink font-semibold text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          {email ? (
            <>
              <Link
                href="/settings"
                aria-current={pathname.startsWith("/settings") ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors duration-200 sm:px-3 ${
                  pathname.startsWith("/settings")
                    ? "bg-ink font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                }`}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">设置</span>
              </Link>
              <span className="mx-1 hidden max-w-32 truncate text-xs text-slate-400 lg:inline" title={email}>
                {email}
              </span>
              <button
                className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await fetch("/api/auth/logout", { method: "POST" });
                  router.push("/login");
                  router.refresh();
                }}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                退出
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="ml-2 flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 font-semibold text-white transition-colors duration-200 hover:bg-slate-700"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
