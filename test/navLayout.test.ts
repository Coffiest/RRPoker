import { describe, expect, it } from "vitest";
import {
  DESIGN_WIDTH,
  EDGE_PADDING,
  SCALE_MAX,
  SCALE_MIN,
  computeNavLayout,
  indicatorCenterRatio,
} from "../lib/navLayout";

/**
 * フッターの寸法計算のテスト。
 *
 * 実機で「はみ出す」不具合が出ていたので、ここでは画面幅を細かく振って
 * 「どの幅・どのタブ本数でも絶対に収まる」ことを直接確かめる。
 */

/** 実際に世の中で使われる幅(小さいAndroidからデスクトップまで)。 */
const WIDTHS = [280, 320, 360, 375, 390, 412, 430, 480, 600, 768, 820, 1024, 1280, 1440, 1920];
/** 想定するタブ本数。5本が新しい構成、3本は変更前、7本は将来の余裕。 */
const TAB_COUNTS = [3, 4, 5, 6, 7];

describe("はみ出さないこと", () => {
  for (const width of WIDTHS) {
    for (const tabs of TAB_COUNTS) {
      it(`fits at ${width}px with ${tabs} tabs`, () => {
        const l = computeNavLayout(width, tabs);
        const available = width - EDGE_PADDING * 2;

        // ピルが使える幅を超えない(ピルの外に置く要素はもう無い)。
        expect(l.pillWidth).toBeLessThanOrEqual(available + 0.5);
        // ピルは負の幅にならない。
        expect(l.pillWidth).toBeGreaterThanOrEqual(0);

        // 中央のプレイボタンは1タブ分の枠に収まる(隣のラベルに被らない)。
        expect(l.playSize).toBeLessThanOrEqual(l.tabWidth * 1.6);

        // せり上がった分は必ず上の余白で受ける。ここが足りないと画面外で切れる。
        const overhang = l.playSize / 2 + l.playLift - l.navH / 2;
        expect(l.padTop).toBeGreaterThanOrEqual(Math.max(0, overhang) - 0.5);
      });
    }
  }

  it("gives every tab a usable width at the narrowest realistic screen", () => {
    // 320pxで5タブ。1本あたりが潰れていないこと(アイコンとラベルが載る最低限)。
    const l = computeNavLayout(320, 5);
    expect(l.tabWidth).toBeGreaterThan(30);
    expect(l.iconSize).toBeGreaterThan(10);
    expect(l.labelSize).toBeGreaterThanOrEqual(8);
  });

  it("shrinks as tabs are added, never the other way round", () => {
    const three = computeNavLayout(390, 3);
    const five = computeNavLayout(390, 5);
    const seven = computeNavLayout(390, 7);
    expect(five.scale).toBeLessThanOrEqual(three.scale);
    expect(seven.scale).toBeLessThanOrEqual(five.scale);
    // タブが増えれば1本あたりは必ず狭くなる。
    expect(five.tabWidth).toBeLessThan(three.tabWidth);
    expect(seven.tabWidth).toBeLessThan(five.tabWidth);
  });

  it("grows with the screen but stops at the cap", () => {
    const phone = computeNavLayout(390, 5);
    const tablet = computeNavLayout(768, 5);
    const desktop = computeNavLayout(1920, 5);
    expect(tablet.scale).toBeGreaterThan(phone.scale);
    expect(desktop.scale).toBe(SCALE_MAX);
    // 上限があるので、大画面でも不格好に巨大化しない。
    expect(desktop.navH).toBeLessThanOrEqual(Math.round(56 * SCALE_MAX));
  });

  it("never goes below the readable minimum", () => {
    for (const tabs of TAB_COUNTS) {
      expect(computeNavLayout(240, tabs).scale).toBe(SCALE_MIN);
      expect(computeNavLayout(120, tabs).scale).toBe(SCALE_MIN);
    }
  });

  it("survives nonsense viewport values instead of producing NaN", () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const l = computeNavLayout(bad, 5);
      expect(Number.isFinite(l.scale)).toBe(true);
      expect(Number.isFinite(l.navH)).toBe(true);
      expect(Number.isFinite(l.tabWidth)).toBe(true);
      expect(l.pillWidth).toBeGreaterThanOrEqual(0);
    }
    // 幅が読めないときは設計幅として扱う。
    expect(computeNavLayout(Number.NaN, 5).scale).toBe(computeNavLayout(DESIGN_WIDTH, 5).scale);
  });

  it("treats a silly tab count safely", () => {
    for (const bad of [0, -3, 1.7]) {
      const l = computeNavLayout(390, bad);
      expect(Number.isFinite(l.tabWidth)).toBe(true);
      expect(l.tabWidth).toBeGreaterThan(0);
    }
  });
});

describe("インジケーターの位置", () => {
  it("centres on each tab in an even split", () => {
    // 5等分なら中心は 0.1, 0.3, 0.5, 0.7, 0.9。
    expect([0, 1, 2, 3, 4].map((i) => indicatorCenterRatio(i, 5))).toEqual([0.1, 0.3, 0.5, 0.7, 0.9]);
    // 3等分なら 1/6, 1/2, 5/6(変更前と同じ位置)。
    const three = [0, 1, 2].map((i) => indicatorCenterRatio(i, 3));
    expect(three[0]).toBeCloseTo(1 / 6);
    expect(three[1]).toBeCloseTo(1 / 2);
    expect(three[2]).toBeCloseTo(5 / 6);
  });

  it("clamps an out of range index instead of pointing off the pill", () => {
    expect(indicatorCenterRatio(-1, 5)).toBe(0.1);
    expect(indicatorCenterRatio(99, 5)).toBe(0.9);
  });
});

/**
 * 中央のプレイボタン。
 *
 * フッターで唯一せり上がる要素なので、上へ出た分を余白で受け損ねると画面外で切れる。
 * また、ピルより明確に大きくないと「ここが入口」という意味が伝わらない。
 */
describe("中央のプレイボタン", () => {
  it("is clearly larger than the bar it sits on", () => {
    for (const width of WIDTHS) {
      const l = computeNavLayout(width, 5);
      expect(l.playSize).toBeGreaterThan(l.navH);
    }
  });

  it("always rises above the bar", () => {
    for (const width of WIDTHS) {
      const l = computeNavLayout(width, 5);
      expect(l.playLift).toBeGreaterThan(0);
    }
  });

  it("never produces NaN for nonsense viewports", () => {
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const l = computeNavLayout(width, 5);
      expect(Number.isFinite(l.playSize)).toBe(true);
      expect(Number.isFinite(l.playLift)).toBe(true);
      expect(Number.isFinite(l.padTop)).toBe(true);
      expect(l.padTop).toBeGreaterThanOrEqual(0);
    }
  });
});
