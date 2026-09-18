import { describe, expect, it } from "vitest";
import { bigrams, clusterItems, containment, lcsLen, normalizeTitle, similarTitles } from "@/lib/dedupe";

describe("normalizeTitle", () => {
  it("去除标点与全角空格并小写", () => {
    expect(normalizeTitle("《校园·生活》——2026 年！")).toBe("校园生活2026年");
  });
  it("去除校名前缀", () => {
    expect(normalizeTitle("清华大学举行教师节庆祝大会")).toBe("举行教师节庆祝大会");
    expect(normalizeTitle("清华团队获突破")).toBe("团队获突破");
  });
});

describe("相似度", () => {
  it("官网与媒体同事件标题（差异为年份）判定相似", () => {
    const a = "清华大学举行2026年教师节庆祝大会";
    const b = "清华大学举行教师节庆祝大会";
    expect(similarTitles(a, "https://a", b, "https://b")).toBe(true);
    expect(containment(a, b)).toBeGreaterThanOrEqual(0.55);
  });

  it("加后缀变体通过 LCS 信号判定相似", () => {
    const a = "学校新建智能计算实验室正式揭牌启用";
    const b = "学校新建智能计算实验室正式揭牌启用（图）";
    expect(similarTitles(a, "https://a", b, "https://b")).toBe(true);
  });

  it("无关标题不相似", () => {
    expect(similarTitles("图书馆调整开放时间的通知", "https://a", "校运会报名通道今日开启", "https://b")).toBe(false);
  });

  it("mock 同线程 URL 直接归并（跨 Mock 源同 slug 也合并）", () => {
    const a = "网传紫荆食堂三楼要开新窗口";
    const b = "后勤处老师称下周试运营";
    expect(similarTitles(a, "mock://forum/canteen/1", b, "mock://forum/canteen/3")).toBe(true);
    expect(similarTitles(a, "mock://forum/canteen/1", b, "mock://media/canteen/1")).toBe(true);
    expect(similarTitles(a, "mock://forum/canteen/1", b, "mock://forum/other/1")).toBe(false);
  });

  it("lcsLen 找最长公共子串", () => {
    expect(lcsLen("紫荆食堂新窗口开放", "新窗口开放的紫荆食堂")).toBeGreaterThanOrEqual(3);
    expect(lcsLen("abcdef", "uvwxyz")).toBe(0);
  });
});

describe("clusterItems", () => {
  const mk = (title: string, url: string, rank = 2) => ({ title, url, sourceKindRank: rank });

  it("同事件不同来源合并为一个新话题", () => {
    const r = clusterItems(
      [
        mk("清华大学举行2026年教师节庆祝大会", "https://thu/1", 3),
        mk("清华大学举行教师节庆祝大会", "https://news/1", 2),
      ],
      [],
    );
    expect(r.newTopics.size).toBe(1);
  });

  it("不同事件分为不同话题", () => {
    const r = clusterItems(
      [
        mk("校运会报名通道今日开启", "https://a"),
        mk("图书馆调整开放时间的通知", "https://b"),
      ],
      [],
    );
    expect(r.newTopics.size).toBe(2);
  });

  it("新条目并入已有话题（key 保留）", () => {
    const r = clusterItems(
      [mk("清华团队在量子计算获重要进展", "https://news/2")],
      [{ key: "77", title: "清华大学团队量子计算研究获重要进展", url: "https://thu/9" }],
    );
    expect([...r.assignment.values()]).toEqual(["77"]);
    expect(r.newTopics.size).toBe(0);
  });

  it("mock 线程三条帖子归为一个话题", () => {
    const r = clusterItems(
      [
        mk("网传紫荆食堂三楼要开新窗口，有同学晒出疑似招标截图", "mock://forum/canteen/1", 0),
        mk("紫荆食堂新窗口有新讨论：有同学拍到三楼施工照片", "mock://forum/canteen/2", 0),
        mk("紫荆食堂新窗口传闻后续：后勤处老师称下周试运营", "mock://forum/canteen/3", 0),
      ],
      [],
    );
    expect(r.newTopics.size).toBe(1);
    // 代表标题取 rank 最高的（全部 mock=0，取字数最接近 22 的）
    const rep = [...r.newTopics.values()][0];
    expect(rep).toContain("紫荆食堂");
  });
});
