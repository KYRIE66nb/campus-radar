/**
 * 所有"日期/今天"的业务逻辑统一使用 Asia/Shanghai 时区，
 * 与服务器（可能为 UTC）无关。
 */
export const TZ = "Asia/Shanghai";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 某时刻对应的上海日历日，格式 YYYY-MM-DD */
export function shDay(d: Date = new Date()): string {
  return dayFormatter.format(d);
}

export function shToday(): string {
  return shDay(new Date());
}

/** 上海时间今天此刻的 HH:mm */
export function shNowHM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** 上海时区的日期字符串(YYYY-MM-DD) ± n 天 */
export function shiftDay(day: string, deltaDays: number): string {
  // 用 UTC 正午解析避免时区边界问题，仅做日算术
  const [y, m, d] = day.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

/** 最近 n 天（含今天）的日列表，旧→新 */
export function lastNDays(n: number, today: string = shToday()): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(today, -(n - 1 - i)));
}

export function isValidSendTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** item 的归属日：发布时间（上海日）；无发布时间则用抓取时间 */
export function itemDay(publishedAt: Date | null, fetchedAt: Date = new Date()): string {
  return shDay(publishedAt ?? fetchedAt);
}

/** 上海时间 MM-dd HH:mm 展示 */
export function fmtDateTimeSH(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
