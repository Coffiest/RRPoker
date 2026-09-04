import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSubscriptionActive } from "../lib/subscription-client";

/**
 * 契約の有効判定。
 *
 * ここが緩むと「解約済み・期限切れの店舗が使い続けられる」という、お金に
 * 直結する事故になる。実際に、終了日を1ヶ月半過ぎた「キャンセル予定」の契約が
 * そのまま使えていた。原因は Stripe 等で終了日を一切見ていなかったこと。
 *
 * 逆に締めすぎると、正当な契約者を締め出す。両側を固定する。
 */

const NOW = new Date("2026-09-03T00:00:00Z").getTime();
/** 秒単位のUNIX時刻へ。Firestore にはこの形で入っている。 */
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("期限切れを通さない", () => {
  it("終了日を過ぎた契約は、status が active でも無効", () => {
    // 実際に起きた形: ステータス active・キャンセル予定・終了日 2026-07-18。
    expect(
      isSubscriptionActive({
        status: "active",
        currentPeriodEnd: unix("2026-07-18T15:10:00+09:00"),
        provider: "stripe",
      }),
    ).toBe(false);
  });

  it("発行元にかかわらず終了日を見る", () => {
    const expired = unix("2026-08-01T00:00:00Z");
    for (const provider of ["stripe", "apple_iap", "google_play", "admin_free"]) {
      expect(isSubscriptionActive({ status: "active", currentPeriodEnd: expired, provider })).toBe(false);
    }
  });

  it("終了日ちょうどは切れているものとして扱う", () => {
    expect(
      isSubscriptionActive({ status: "active", currentPeriodEnd: Math.floor(NOW / 1000), provider: "stripe" }),
    ).toBe(false);
  });
});

describe("有効なものを締め出さない", () => {
  it("終了日が先ならキャンセル予定でも有効", () => {
    // 解約を予約しただけの契約は、終了日までは使えなければならない。
    expect(
      isSubscriptionActive({
        status: "active",
        currentPeriodEnd: unix("2026-10-01T00:00:00Z"),
        provider: "stripe",
      }),
    ).toBe(true);
  });

  it("終了日を持たないアプリ内課金は status に委ねる", () => {
    // 期限を持たない権利では終了日が送られてこないことがある。
    for (const end of [undefined, null, 0]) {
      expect(isSubscriptionActive({ status: "active", currentPeriodEnd: end, provider: "apple_iap" })).toBe(true);
    }
  });

  it("手動無料化は期限が無ければ通さない(必ず期限とセットで発行するため)", () => {
    expect(isSubscriptionActive({ status: "active", provider: "admin_free" })).toBe(false);
  });
});

describe("status が active 以外", () => {
  it("終了日が先でも通さない", () => {
    const future = unix("2026-10-01T00:00:00Z");
    for (const status of ["canceled", "past_due", "incomplete", "unpaid", "trialing", ""]) {
      expect(isSubscriptionActive({ status, currentPeriodEnd: future, provider: "stripe" })).toBe(false);
    }
  });

  it("契約そのものが無ければ通さない", () => {
    expect(isSubscriptionActive(null)).toBe(false);
    expect(isSubscriptionActive(undefined)).toBe(false);
    expect(isSubscriptionActive({})).toBe(false);
  });
});
