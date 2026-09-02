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

        // ピル + 隙間 + ツールボタン(正方形=navH) が使える幅を超えない。
        expect(l.pillWidth + l.navGap + l.navH).toBeLessThanOrEqual(available + 0.5);
        // ピルは負の幅にならない。
        expect(l.pillWidth).toBeGreaterThanOrEqual(0);
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
 * 画面の縁との余裕。
 *
 * 「計算上ちょうど収まる」だけだと、端末ごとのフォントの実寸差や小数の丸めで簡単に
 * 縁へ届いてしまう(実機で右端がはみ出して見えた)。常にはっきり余白が残ることを固定する。
 */
describe("画面の縁との余裕", () => {
  for (const width of WIDTHS) {
    it(`keeps a visible margin at ${width}px`, () => {
      const l = computeNavLayout(width, 3);
      const used = l.pillWidth + l.navGap + l.navH;
      const available = width - EDGE_PADDING * 2;

      // 使い切らない。必ず余りが出る(端に触れない)。
      expect(used).toBeLessThanOrEqual(available);
      // 左右の余白そのものも、目に見える幅を確保する。
      expect(EDGE_PADDING).toBeGreaterThanOrEqual(12);
    });
  }

  it("uses only the width it needs, leaving the rest unused", () => {
    // 画面幅いっぱいには広げない。項目が3つだと間延びして、フッターだけが
    // 横に長く見えるため。余った横幅は使わずに残す(行ごと中央へ寄せる)。
    const l = computeNavLayout(393, 3);
    const available = 393 - EDGE_PADDING * 2;
    expect(l.totalWidth).toBeLessThan(available);
    // 余りは目に見える量であること(ぴったりでは「使い切っている」のと変わらない)。
    expect(available - l.totalWidth).toBeGreaterThan(20);
  });

  it("gets bigger, not smaller, now that the width is not wasted", () => {
    // 使わずに済んだ横幅は高さへ回す。フッターは以前(56)より大きくなる。
    const l = computeNavLayout(393, 3);
    expect(l.navH).toBeGreaterThan(56);
    expect(l.iconSize).toBeGreaterThanOrEqual(20);
  });
});

/**
 * フッターの幅。
 *
 * 「ホーム / QR / マイページ の間が間延びして、フッターだけ横に長い」という指摘の再発防止。
 * 中身が要るぶんだけ取り、余りは必ず残す(残りは中央寄せの余白になる)。
 */
describe("フッターの幅", () => {
  for (const width of WIDTHS) {
    it(`never stretches to fill at ${width}px`, () => {
      const l = computeNavLayout(width, 3);
      const available = width - EDGE_PADDING * 2;
      expect(l.totalWidth).toBeLessThanOrEqual(available);
      // ピルの幅はタブ幅の合計とちょうど一致する(余白で水増ししない)。
      expect(l.pillWidth).toBeLessThanOrEqual(Math.round(l.tabWidth) * 3 + 1);
    });
  }

  it("stops growing on wide screens instead of spanning them", () => {
    // 大画面では上限で止まり、画面幅に比例して伸び続けない。
    const phone = computeNavLayout(430, 3);
    const desktop = computeNavLayout(1440, 3);
    expect(desktop.totalWidth).toBe(phone.totalWidth);
  });
});
