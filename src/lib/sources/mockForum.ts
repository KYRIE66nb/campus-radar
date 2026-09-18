import type { NewsItem, SourceAdapter } from "./types";
import { shDay, shiftDay } from "@/lib/time";

interface MockThread {
  slug: string;
  /** 相对今天的天偏移，负数=过去；0=今天 */
  posts: { dayOffset: number; hour: number; title: string }[];
}

/**
 * Mock 论坛数据 —— 全部条目 isMock=true，UI/邮件一律打「Mock」徽章。
 * 线程按 dayOffset 相对"今天"编排，用于演示热点生命周期：
 * 首次出现 → 升温 → 出现新进展（重要更新）→ 退热（普通/低相关）。
 */
const THREADS: MockThread[] = [
  {
    slug: "zhujin-canteen",
    posts: [
      { dayOffset: -3, hour: 9, title: "【求证】网传紫荆食堂三楼要开新窗口，有同学晒出疑似招标截图" },
      { dayOffset: -2, hour: 14, title: "紫荆食堂新窗口有新讨论：有同学拍到三楼施工照片" },
      { dayOffset: -1, hour: 11, title: "紫荆食堂新窗口传闻后续：后勤处老师称下周试运营（待官方公告确认）" },
    ],
  },
  {
    slug: "sports-meet",
    posts: [
      { dayOffset: -5, hour: 20, title: "校运会时间定了？网传师生组接力赛项目有调整" },
      { dayOffset: -4, hour: 13, title: "校运会时间讨论续：体育部回应以官网通知为准" },
    ],
  },
  {
    slug: "library-seat",
    posts: [
      { dayOffset: -6, hour: 22, title: "图书馆考研季预约规则要改？讨论帖盖到三百楼" },
      { dayOffset: -5, hour: 10, title: "图书馆预约规则讨论更新：有同学整理了各馆现状" },
      { dayOffset: -4, hour: 19, title: "图书馆预约规则传闻再发酵，多数人呼吁官方说明" },
    ],
  },
  {
    slug: "course-reform",
    posts: [
      { dayOffset: -1, hour: 16, title: "传闻：某热门必修课下学期改考核方式？群里截图流传" },
      { dayOffset: 0, hour: 9, title: "必修课考核方式传闻发酵：教务老师称方案尚未最终确定" },
    ],
  },
  {
    slug: "ginkgo",
    posts: [
      { dayOffset: 0, hour: 10, title: "银杏季拍照攻略：近一周讨论热度上升的校内机位整理（讨论帖）" },
    ],
  },
];

/**
 * 模拟校园媒体（第二个 Mock 源）：
 * 演示「同一事件出现新来源跟进 → 已有重要更新」的分类，
 * 以及 Mock 论坛传闻被校园媒体求证的过程叙事。
 */
const MEDIA_POSTS: MockThread[] = [
  {
    // slug 必须与论坛线程一致（zhujin-canteen），同 slug 的 Mock 条目才会归并为同一话题
    slug: "zhujin-canteen",
    posts: [
      {
        dayOffset: -1,
        hour: 17,
        title: "紫荆食堂新窗口追踪：模拟校园媒体向后勤处求证，对方称方案在走流程、下周或有公告（仍未证实）",
      },
    ],
  },
  {
    slug: "ai-lecture",
    posts: [
      { dayOffset: 0, hour: 11, title: "AI 前沿系列讲座明日开讲：模拟校园媒体整理报名与蹭课攻略" },
    ],
  },
];

function makeMockSource(cfg: {
  id: string;
  name: string;
  threads: MockThread[];
  method: string;
}): SourceAdapter {
  return {
    id: cfg.id,
    name: cfg.name,
    kind: "mock",
    url: "about:blank",
    method: cfg.method,
    limits: "Mock 数据，明确标注、绝不冒充实时内容；评审运行日报时它稳定产出，便于观察分类逻辑",
    async fetch(ctx) {
      const now = ctx.now ?? new Date();
      const today = shDay(now);
      const items: NewsItem[] = [];
      for (const t of cfg.threads) {
        for (const [i, p] of t.posts.entries()) {
          const day = shiftDay(today, p.dayOffset);
          const dt = new Date(`${day}T${String(p.hour).padStart(2, "0")}:00:00+08:00`);
          if (dt.getTime() > now.getTime()) continue; // 未来的不发
          items.push({
            sourceId: cfg.id,
            title: p.title,
            url: `mock://${cfg.id === "mock-forum" ? "forum" : "media"}/${t.slug}/${i + 1}`,
            publishedAt: dt,
            fetchedAt: now,
            isMock: true,
          });
        }
      }
      return items;
    },
  };
}

export const mockForum: SourceAdapter = makeMockSource({
  id: "mock-forum",
  name: "模拟校园论坛（Mock 数据）",
  threads: THREADS,
  method: "本地内置演示数据（非网络抓取）。用于演示「讨论/传闻」分类、热点生命周期与降级说明，不代表任何真实论坛内容",
});

export const mockCampusMedia: SourceAdapter = makeMockSource({
  id: "mock-media",
  name: "模拟校园媒体（Mock 数据）",
  threads: MEDIA_POSTS,
  method: "本地内置演示数据（非网络抓取）。演示「校园媒体跟进求证」如何把传闻话题升级为「已有重要更新」",
});
