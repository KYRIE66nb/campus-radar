import { describe, expect, it } from "vitest";
import { itemDay, lastNDays, shiftDay, shDay, isValidSendTime } from "@/lib/time";

describe("time（Asia/Shanghai 统一日期）", () => {
  it("UTC 晚间对应上海次日", () => {
    expect(shDay(new Date("2026-09-18T17:30:00Z"))).toBe("2026-09-19");
  });
  it("UTC 早晨对应上海同日", () => {
    expect(shDay(new Date("2026-09-18T02:30:00Z"))).toBe("2026-09-18");
  });
  it("shiftDay 前后移动", () => {
    expect(shiftDay("2026-09-18", -7)).toBe("2026-09-11");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("lastNDays 旧→新含今天", () => {
    const days = lastNDays(3, "2026-09-18");
    expect(days).toEqual(["2026-09-16", "2026-09-17", "2026-09-18"]);
  });
  it("itemDay 无发布时间回退抓取时间", () => {
    expect(itemDay(null, new Date("2026-09-18T02:00:00Z"))).toBe("2026-09-18");
  });
  it("发送时间格式校验", () => {
    expect(isValidSendTime("08:00")).toBe(true);
    expect(isValidSendTime("23:59")).toBe(true);
    expect(isValidSendTime("24:00")).toBe(false);
    expect(isValidSendTime("8点")).toBe(false);
  });
});
