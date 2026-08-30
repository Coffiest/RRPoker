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
export const SCALE_MAX = 1.35;
/** これ以下には小さくしない。極小画面でも読める下限。 */
export const SCALE_MIN = 0.72;
/** 画面の左右端の余白。 */
export const EDGE_PADDING = 8;
/** タブ1本が必要とする最小幅(scale=1のとき)。アイコン+短いラベルが収まる幅。 */
const MIN_TAB_WIDTH = 52;
/** ピルの高さ(scale=1のとき)。 */
const BASE_NAV_HEIGHT = 56;
/** 中央のプレイボタンの直径(scale=1のとき)。ピルより大きく、上へせり出す。 */
const BASE_PLAY_SIZE = 68;
/** プレイボタンをピルの上端からどれだけ持ち上げるか(scale=1のとき)。 */
const BASE_PLAY_LIFT = 14;

export interface NavLayout {
  /** 実際に採用した拡大率。 */
  scale: number;
  /** ピルの高さ。 */
  navH: number;
  /** 中央のプレイボタンの直径。 */
  playSize: number;
  /** プレイボタンをピルの中心からどれだけ上へずらすか。 */
  playLift: number;
  /** 選択中タブの背後に出る円の直径。 */
  indicatorSize: number;
  iconSize: number;
  labelSize: number;
  itemGap: number;
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
 * ピルの外に置く要素はもう無いので、横幅はピルが全部使う。
 * 中央のプレイボタンはピルの上へせり出すため、その分の余白(padTop)も返す。
 */
export function computeNavLayout(viewportWidth: number, tabCount: number): NavLayout {
  const tabs = Math.max(1, Math.floor(tabCount));
  // 画面幅がおかしい値(0や負)で来ても壊れないようにする。
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : DESIGN_WIDTH;
  const available = Math.max(0, width - EDGE_PADDING * 2);

  // 幅から素直に決まるスケール。
  const scaleFromWidth = available / DESIGN_WIDTH;

  // タブ本数から許されるスケール。1本あたりの幅が最小幅を下回らないようにする。
  // scale が大きいほど最小タブ幅も大きくなるので、scale について解く。
  //   available >= scale * tabs * MIN_TAB_WIDTH
  const perScaleCost = tabs * MIN_TAB_WIDTH;
  const scaleFromTabs = available / perScaleCost;

  const scale = Math.min(Math.max(Math.min(scaleFromWidth, scaleFromTabs), SCALE_MIN), SCALE_MAX);

  const navH = Math.round(BASE_NAV_HEIGHT * scale);
  const playSize = Math.round(BASE_PLAY_SIZE * scale);
  const playLift = Math.round(BASE_PLAY_LIFT * scale);
  // ピルの外に置く要素は無くなったので、横幅はピルが全部使う。
  const pillWidth = available;

  // プレイボタンはピルの中心から playLift だけ上へ出る。上端が画面外へ出ないよう、
  // せり出した分をそのまま上の余白にする。
  const playOverhang = Math.max(0, Math.round(playSize / 2 + playLift - navH / 2));

  return {
    scale,
    navH,
    playSize,
    playLift,
    indicatorSize: Math.round(34 * scale),
    iconSize: Math.round(20 * scale),
    labelSize: Math.max(8, Math.round(9 * scale)),
    itemGap: Math.max(2, Math.round(3 * scale)),
    padTop: Math.round(6 * scale) + playOverhang,
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

/**
 * フッターが実際に占める高さ(CSSの式)。
 *
 * 埋め込み(iframe)の下端をフッターに合わせるために使う。固定値で持つと、
 * 寸法を変えたときに必ずどちらかがズレる(下が隠れるか、隙間が空く)ので、
 * 同じ計算から導く。ホームインジケーターぶんの安全域も足す。
 */
export function navInsetCss(layout: NavLayout): string {
  return `calc(${layout.padTop + layout.navH}px + max(${layout.padBottom}px, env(safe-area-inset-bottom)))`;
}
