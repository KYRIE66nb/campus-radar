/**
 * 标题归一化与相似度 —— 中文新闻标题聚类。
 * 相似判定 = 集合包含度（shared bigrams / 较短标题的 bigram 数）
 * 辅以「最长公共子串 ≥ 8 字」信号，能覆盖：
 *  - 官网与媒体对同一事件的近同标题（高包含度）
 *  - 同一事件加了前后缀的变体标题（LCS 信号）
 *  - Mock 论坛同一线程（mock:// url 显式同 slug，直接归并）
 */

const NOISE_CHARS = /[\s【】\[\]（）()《》<>「」“”"'‘’·—\-_|,，。.!！?？:：;；~～#*、]/gu;

const SCHOOL_PREFIX =
  /^(清华大学|清华|中国科学技术大学|中国科大|中科大|上海交通大学|上海交大|北京大学|北大)/u;

export function normalizeTitle(t: string): string {
  let s = t.normalize("NFKC").toLowerCase();
  s = s.replace(NOISE_CHARS, "");
  s = s.replace(SCHOOL_PREFIX, "");
  return s;
}

export function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  if (s.length === 0) return set;
  if (s.length === 1) {
    set.add(s);
    return set;
  }
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

export function containment(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  const A = bigrams(na);
  const B = bigrams(nb);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return shared / Math.min(A.size, B.size);
}

/** 最长公共子串长度（标题 ≤ 80 字，O(n·m) 足够） */
export function lcsLen(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  let best = 0;
  let prev = new Array(nb.length + 1).fill(0);
  for (let i = 1; i <= na.length; i++) {
    const cur = new Array(nb.length + 1).fill(0);
    for (let j = 1; j <= nb.length; j++) {
      if (na[i - 1] === nb[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/** mock://<任意源>/<slug>/<n> → slug（Mock 论坛与 Mock 校园媒体同 slug 视为同一线程） */
export function mockThreadSlug(url: string): string | null {
  const m = url.match(/^mock:\/\/[a-z]+\/([^/]+)\//);
  return m ? m[1] : null;
}

export function similarTitles(t1: string, u1: string, t2: string, u2: string): boolean {
  const s1 = mockThreadSlug(u1);
  const s2 = mockThreadSlug(u2);
  if (s1 && s2 && s1 === s2) return true;
  const c = containment(t1, t2);
  if (c >= 0.55) return true;
  if (c >= 0.3 && lcsLen(t1, t2) >= 8) return true;
  return false;
}

export interface ClusterCandidate {
  /** 已有话题或新话题的键 */
  key: string;
  title: string;
  url: string;
}

export interface ClusterResult<T> {
  /** item → key（新话题 key 以 "new:" 前缀） */
  assignment: Map<T, string>;
  /** 每个新 key 的代表标题（优先官方来源、字数适中的标题） */
  newTopics: Map<string, string>;
}

/**
 * 将 newItems 归入 candidates（已有话题），或彼此归并为新话题。
 */
export function clusterItems<T extends { title: string; url: string; sourceKindRank: number }>(
  newItems: T[],
  candidates: ClusterCandidate[],
): ClusterResult<T> {
  const pools: { key: string; titles: string[]; urls: string[]; best: { title: string; rank: number; len: number } | null }[] =
    candidates.map((c) => ({ key: c.key, titles: [c.title], urls: [c.url], best: null }));

  const assignment = new Map<T, string>();
  const newTopics = new Map<string, string>();

  for (const item of newItems) {
    let bestIdx = -1;
    let bestScore = 0;
    pools.forEach((pool, idx) => {
      let poolScore = 0;
      pool.titles.forEach((pt, i) => {
        if (!similarTitles(item.title, item.url, pt, pool.urls[i])) return;
        const score = containment(item.title, pt);
        if (score > poolScore) poolScore = score;
      });
      if (poolScore > bestScore) {
        bestScore = poolScore;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      const pool = pools[bestIdx];
      pool.titles.push(item.title);
      pool.urls.push(item.url);
      assignment.set(item, pool.key);
    } else {
      // 尝试并入本轮新建的池
      let merged = false;
      for (const [key, title] of newTopics) {
        const pool = pools.find((p) => p.key === key)!;
        if (pool.titles.some((pt, i) => similarTitles(item.title, item.url, pt, pool.urls[i]))) {
          pool.titles.push(item.title);
          pool.urls.push(item.url);
          assignment.set(item, key);
          merged = true;
          break;
        }
      }
      if (!merged) {
        const key = `new:${normalizeTitle(item.title).slice(0, 40) || String(newTopics.size)}`;
        pools.push({ key, titles: [item.title], urls: [item.url], best: null });
        newTopics.set(key, item.title);
        assignment.set(item, key);
      }
    }
  }

  // 代表标题：优先来源等级高、字数适中的
  for (const pool of pools) {
    if (!newTopics.has(pool.key)) continue;
    pool.titles.forEach((t, i) => {
      void i;
      const item = newItems.find((it) => it.title === t);
      const rank = item?.sourceKindRank ?? 0;
      if (!pool.best || rank > pool.best.rank || (rank === pool.best.rank && Math.abs(t.length - 22) < Math.abs(pool.best.len - 22))) {
        pool.best = { title: t, rank, len: t.length };
      }
    });
    if (pool.best) newTopics.set(pool.key, pool.best.title);
  }

  return { assignment, newTopics };
}
