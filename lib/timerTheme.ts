/**
 * タイマー画面の背景(オーナー指定・2026-11-03)。
 * 複数のトナメを同時に進めるとき、背景の色でどのタイマーかすぐ分かるようにする。
 *
 * - 白(今まで)+ Apple の製品色に寄せた落ち着いた濃い色 9 つ = 10 色。蛍光色は使わない。
 * - 波紋(白・夜)の模様 2 つ(2026-11-10)。
 * - 任意の画像も選べる(画像はそのまま敷く。文字は白にして影を付けて読めるようにする)。
 * - 大会ごとに選べる(tournaments/{id}.timerBg)。選んでいない大会は店舗のデフォルト(stores/{id}.timerBgDefault)。
 * - 文字の色は背景ごとに調整する。濃い色では白・明るい灰・明るい金(どの色の上でもコントラスト 4.5:1 以上)。
 */

export type TimerBgId =
  | 'white' | 'orange' | 'midnight' | 'navy' | 'alpine' | 'teal' | 'burgundy' | 'purple' | 'brown' | 'slate'
  | 'ripple' | 'ripple-night'

export type TimerTheme = {
  id: TimerBgId | 'image'
  label: string
  bg: string
  dark: boolean
  /** 主な文字(大会名・ブラインドの数字) */
  fg: string
  /** 補助の文字(BLIND・NEXT などの見出し) */
  sub: string
  /** 今まで金で出していた文字(残り時間・LEVEL など) */
  accent: string
}

const DARK = { dark: true, fg: '#FFFFFF', sub: '#E5E5EA', accent: '#F7CF6A' } // contrast-ok: 濃い色の背景の上の文字(最低 6.0:1)

export const TIMER_COLORS: TimerTheme[] = [
  { id: 'white', label: 'ホワイト', bg: '#FFFFFF', dark: false, fg: '#1C1C1E', sub: '#545458', accent: '#C8820A' },
  // スペースグレイの代わり(オーナー指定・2026-11-03)。白・灰・金の文字がどれも 5:1 以上で読める焦げたオレンジ
  { id: 'orange', label: 'オレンジ', bg: '#8A3B12', ...DARK },
  { id: 'midnight', label: 'ミッドナイト', bg: '#1E2A3A', ...DARK },
  { id: 'navy', label: 'ネイビー', bg: '#1F3A5F', ...DARK },
  { id: 'alpine', label: 'アルパイングリーン', bg: '#2E4D3A', ...DARK },
  { id: 'teal', label: 'ティール', bg: '#1F4E52', ...DARK },
  { id: 'burgundy', label: 'バーガンディ', bg: '#5C1F2B', ...DARK },
  { id: 'purple', label: 'ディープパープル', bg: '#3E2D57', ...DARK },
  { id: 'brown', label: 'ブラウン', bg: '#4A3426', ...DARK },
  { id: 'slate', label: 'スレート', bg: '#4A5563', ...DARK },
  // 波紋(オーナー指定・2026-11-10。空の状態の .rr-dots と同じ模様)。白地と濃紺地の 2 つ
  { id: 'ripple', label: '波紋', bg: 'repeating-radial-gradient(circle, #fff, #fff 5px, rgba(28,28,30,0.07) 6px) 0 0 / 50px 100px, #fff', dark: false, fg: '#1C1C1E', sub: '#545458', accent: '#C8820A' },
  { id: 'ripple-night', label: '波紋(夜)', bg: 'repeating-radial-gradient(circle, #1E2A3A, #1E2A3A 5px, rgba(255,255,255,0.08) 6px) 0 0 / 50px 100px, #1E2A3A', ...DARK },
]

export const IMAGE_THEME: TimerTheme = { id: 'image', label: '画像', bg: '#1C1C1E', ...DARK }

/** 大会の選択 → 店舗のデフォルト → 白 の順に決める。 */
export function resolveTimerTheme(tournamentBg?: string | null, storeDefault?: string | null): TimerTheme {
  // 以前のスペースグレイ(spacegray)を選んでいた大会・店舗はオレンジにする
  const raw = tournamentBg || storeDefault || 'white'
  const pick = raw === 'spacegray' ? 'orange' : raw
  if (pick === 'image') return IMAGE_THEME
  return TIMER_COLORS.find(c => c.id === pick) ?? TIMER_COLORS[0]
}
