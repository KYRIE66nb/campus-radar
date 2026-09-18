"use client";

import { useState } from "react";
import { ThumbsDown, ShieldAlert, Check } from "lucide-react";

export default function FeedbackButtons({ topicId }: { topicId: number }) {
  const [done, setDone] = useState<string | null>(null);

  async function send(kind: "not_interested" | "inaccurate") {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, kind }),
      });
      setDone(kind);
    } catch {
      /* 静默失败：反馈不影响主流程 */
    }
  }

  if (done) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {done === "not_interested" ? "已记录：将降低此类话题权重" : "已记录：将复核该话题的事实性"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-3 text-xs text-slate-400">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 transition-colors duration-200 hover:text-ink hover:underline"
        onClick={() => send("not_interested")}
      >
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
        不感兴趣
      </button>
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 transition-colors duration-200 hover:text-ink hover:underline"
        onClick={() => send("inaccurate")}
      >
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        信息不准确
      </button>
    </span>
  );
}
