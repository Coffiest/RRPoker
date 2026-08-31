/**
 * フッターメニューの寸法計算。
 *
 * 以前は「画面幅 ÷ 設計幅(390px)」だけでスケールを決めていたため、次の2点が考慮されず
 * 狭い画面や小さい端末で中身がはみ出していた:
 *  - タブが何本あるか(本数が増えるほど1本あたりの幅は狭くなる)
 *  - ラベルが実際に収まる幅があるか
 *
 * ここでは「入る大きさから逆算する」。幅からのスケールと、タブ本数から許される
 * スケールの小さい方を採る。したがってタブを増やしても自動的に縮んで収まる。
 *
 * この計算はDOMにもFirebaseにも依存しない純粋な関数なので、幅を変えながら
 * 「はみ出さないこと」を単体テストで直接確かめられる。
 */

/** 設計の基準幅(iPhone標準)。この幅で scale=1 になる。 */
export const DESIGN_WIDTH = 390;
/** これ以上は大きくしない。大画面で不格好に巨大化するのを防ぐ。 */
export const SCALE_MAX = 1.2;
/** これ以下には小さくしない。極小画面でも読める下限。 */
export const SCALE_MIN = 0.72;
/** 画面の左右端の余白。端ぎりぎりに置かず、はっきり内側に収める。 */
export const EDGE_PADDING = 14;
/**
 * 逆算した大きさにさらに掛ける安全率。
 *
 * 「計算上ちょうど収まる」だけだと、端末ごとのフォントの実寸差・小数の丸め・
 * ノッチまわりの余白で簡単に縁へ届いてしまう。最初から少し小さく作って、
 * 常に余白が残るようにする。
 */
export const SAFETY_FACTOR = 0.94;
/** タブ1本が必要とする最小幅(scale=1のとき)。アイコン+短いラベルが収まる幅。 */
const MIN_TAB_WIDTH = 52;
/** メインピルとツールボタンの間隔(scale=1のとき)。 */
const BASE_GAP = 4;
/** ツールボタンは正方形なので、幅はピル高さと同じ。 */
const BASE_NAV_HEIGHT = 56;

export interface NavLayout {
  /** 実際に採用した拡大率。 */
  scale: number;
  /** ピルの高さ(=ツールボタンの一辺)。 */
  navH: number;
  /** 中央の強調ボタンの直径。 */
  circleSize: number;
  /** 選択中タブの背後に出る円の直径。 */
  indicatorSize: number;
  iconSize: number;
  labelSize: number;
  itemGap: number;
  navGap: number;
  padTop: number;
  padBottom: number;
  /** メインピルが使える幅。 */
  pillWidth: number;
  /** タブ1本あたりの幅。 */
  tabWidth: number;
}

/**
 * 画面幅とタブ本数から、はみ出さない寸法一式を返す。
 *
 * `tabCount` にはツールボタンを含めない(あれはピルの外にある別要素)。
 */
export function computeNavLayout(viewportWidth: number, tabCount: number): NavLayout {
  const tabs = Math.max(1, Math.floor(tabCount));
  // 画面幅がおかしい値(0や負)で来ても壊れないようにする。
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : DESIGN_WIDTH;
  const available = Math.max(0, width - EDGE_PADDING * 2);

  // 幅から素直に決まるスケール。
  const scaleFromWidth = available / DESIGN_WIDTH;

  // タブ本数から許されるスケール。ピルの外にあるツールボタン(正方形)と隙間を先に引き、
  // 残りをタブ本数で割った幅が、1本あたりの最小幅を下回らないようにする。
  // scale が大きいほどツールボタンも隙間も最小タブ幅も大きくなるので、scale について解く。
  //   available >= scale * (tabs * MIN_TAB_WIDTH + BASE_NAV_HEIGHT + BASE_GAP)
  const perScaleCost = tabs * MIN_TAB_WIDTH + BASE_NAV_HEIGHT + BASE_GAP;
  const scaleFromTabs = available / perScaleCost;

  // 収まる上限まで使い切らず、安全率のぶん小さく作る。
  const fitted = Math.min(scaleFromWidth, scaleFromTabs) * SAFETY_FACTOR;
  const scale = Math.min(Math.max(fitted, SCALE_MIN), SCALE_MAX);

  const navH = Math.round(BASE_NAV_HEIGHT * scale);
  const navGap = Math.max(3, Math.round(BASE_GAP * scale));
  // ツールボタンは navH の正方形。メインピルはその残り全部。
  const pillWidth = Math.max(0, available - navH - navGap);

  return {
    scale,
    navH,
    circleSize: Math.round(42 * scale),
    indicatorSize: Math.round(34 * scale),
    iconSize: Math.round(20 * scale),
    labelSize: Math.max(8, Math.round(9 * scale)),
    itemGap: Math.max(2, Math.round(3 * scale)),
    navGap,
    padTop: Math.round(6 * scale),
    padBottom: Math.round(10 * scale),
    pillWidth,
    tabWidth: pillWidth / tabs,
  };
}

/**
 * 選択中タブのインジケーターの中心位置(ピル左端からの割合)。
 * N等分したときの i 番目の中心は (i + 0.5) / N。
 */
export function indicatorCenterRatio(index: number, tabCount: number): number {
  const tabs = Math.max(1, Math.floor(tabCount));
  const i = Math.min(Math.max(0, Math.floor(index)), tabs - 1);
  return (i + 0.5) / tabs;
}
