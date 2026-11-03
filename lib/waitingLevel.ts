/**
 * 「Waiting for start」(オーナー指定・2026-11-03)。
 *
 * 「開始時刻にタイマースタート」の大会は、開始の 30 分前にタイマーを動かし始める。
 * そのためにブラインド表の先頭に、システムだけが入れる 30 分のレベル { type: 'waiting' } を足す。
 * このレベルが終わった瞬間(=開始時刻)にレベル 1 に上がる。
 *
 * - ストラクチャ表・ブラインド一覧・テキストコピー・終了予定や RC 時刻の計算には一切出さない(withoutWaiting)。
 * - タイマー画面だけは、このレベルの間「WAITING FOR START」と開始までの残り時間を出す。
 * - タイマーの進み方(サーバーの computeCatchUp・一時停止・次のレベル)は普通のレベルと同じ。
 *   「次のレベル」を押せばその場でレベル 1 が始まる。
 * - レベルの番号(LEVEL n / Lv n)は type === 'level' だけを数える(levelNumberAt)。
 */
export const WAITING_MINUTES = 30
export const WAITING_MS = WAITING_MINUTES * 60 * 1000

type AnyLevel = { type?: string; [key: string]: any }

export const WAITING_LEVEL = { type: 'waiting', duration: WAITING_MINUTES, comment: null } as const

export function isWaitingLevel(l: AnyLevel | null | undefined): boolean {
  return l?.type === 'waiting'
}

/** 表示・計算用に、待機レベルを除いたブラインド表。 */
export function withoutWaiting<T extends AnyLevel>(levels: T[] | null | undefined): T[] {
  return Array.isArray(levels) ? levels.filter(l => !isWaitingLevel(l)) : []
}

/** 先頭に待機レベルが入っているか。 */
export function hasWaiting(levels: AnyLevel[] | null | undefined): boolean {
  return Array.isArray(levels) && isWaitingLevel(levels[0])
}

/** 先頭に待機レベルを 1 つだけ入れた表(すでにあれば作り直さない)。 */
export function withWaiting<T extends AnyLevel>(levels: T[]): AnyLevel[] {
  return [{ ...WAITING_LEVEL }, ...withoutWaiting(levels)]
}

/**
 * 表を差し替えるとき、元の表に待機レベルがあれば新しい表にも残す
 * (残さないとレベルの位置がずれ、進行中のタイマーが 1 つ先のレベルに飛ぶ)。
 */
export function keepWaiting<T extends AnyLevel>(prev: AnyLevel[] | null | undefined, next: T[]): AnyLevel[] {
  return hasWaiting(prev) ? withWaiting(next) : withoutWaiting(next)
}

/** 表の idx 番目が「レベル何」か(type === 'level' だけを数える)。レベルでなければ null。 */
export function levelNumberAt(levels: AnyLevel[], idx: number): number | null {
  if (levels[idx]?.type !== 'level') return null
  let n = 0
  for (let i = 0; i <= idx && i < levels.length; i++) if (levels[i]?.type === 'level') n++
  return n
}
