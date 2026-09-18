export type SourceKind = "official" | "media" | "forum" | "mock";

export interface SourceMeta {
  /** 稳定 id，如 thu-official */
  id: string;
  /** 展示名 */
  name: string;
  /** official=官方发布 media=媒体报道 forum=社区讨论 mock=Mock演示 */
  kind: SourceKind;
  /** 仅对该学校可用；空=任意学校 */
  school?: string;
  /** 入口地址（展示用） */
  url: string;
  /** 获取方式（/sources 页展示） */
  method: string;
  /** 已知访问限制 */
  limits: string;
}

export interface NewsItem {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  fetchedAt: Date;
  isMock: boolean;
}

export interface FetchOutcome {
  sourceId: string;
  name: string;
  kind: SourceKind;
  ok: boolean;
  items: NewsItem[];
  error?: string;
  durationMs: number;
  cached: boolean;
  isMock: boolean;
}

export interface FetchCtx {
  school: string;
  /** 覆盖当前时间（测试/回填用） */
  now?: Date;
}

export interface SourceAdapter extends SourceMeta {
  fetch(ctx: FetchCtx): Promise<NewsItem[]>;
}

export const KIND_LABEL: Record<SourceKind, string> = {
  official: "官方发布",
  media: "媒体报道",
  forum: "社区讨论",
  mock: "Mock 演示",
};

/** 可信度排序：official > media > forum；mock 单独处理 */
export const KIND_RANK: Record<SourceKind, number> = {
  official: 3,
  media: 2,
  forum: 1,
  mock: 0,
};
