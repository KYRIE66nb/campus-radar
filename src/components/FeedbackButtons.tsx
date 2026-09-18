"use client";

import { useState } from "react";

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
      <span className="text-xs text-slate-400">
        {done === "not_interested" ? "已记录：将降低此类话题权重" : "已记录：将复核该话题的事实性"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs text-slate-400">
      <button className="hover:text-slate-600 hover:underline" onClick={() => send("not_interested")}>不感兴趣</button>
      <span>·</span>
      <button className="hover:text-slate-600 hover:underline" onClick={() => send("inaccurate")}>信息不准确</button>
    </span>
  );
}
