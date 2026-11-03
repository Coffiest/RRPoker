// 終了予定(オーナー指定)。
// 卓の合計チップ = 初期スタック × 人数。ヘッズアップ(残り 2 人)のアベレージ = 合計 ÷ 2。
// そのアベレージが 10BB を切る(アベレージ ÷ BB < 10)最初のレベルを「終了予定」のレベルとする。
// 例: 300 点 × 30 人 = 9000、÷2 = 4500 → 4500 ÷ 500 = 9 < 10 なので 250/500 が終了予定。
// 終了予定時刻は、開始時刻からそのレベルが終わるまでの時間(ブレイクも含む)を足した時刻。

type AnyLevel = { type: string; bigBlind?: number | null; duration?: number | null; rc?: boolean | null }

/** 終了予定のレベルの、表の中での位置(見つからなければ null)。 */
export function endLevelIndex(levels: AnyLevel[], startStack?: number | null, players?: number | null): number | null {
  if (!startStack || !players || startStack <= 0 || players <= 0) return null
  const avgHeadsUp = (startStack * players) / 2
  const i = levels.findIndex(l => l.type === 'level' && (l.bigBlind ?? 0) > 0 && avgHeadsUp / (l.bigBlind as number) < 10)
  return i >= 0 ? i : null
}

/** 開始から終了予定のレベルが終わるまでの分数。 */
export function minutesUntilEnd(levels: AnyLevel[], idx: number): number {
  return levels.slice(0, idx + 1).reduce((s, l) => s + (l.duration ?? 0), 0)
}

/** "19:30" に分を足した時刻("HH:MM"、日をまたぐときは "翌HH:MM")。 */
export function clockAfter(startTime: string | undefined, minutes: number): string | null {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const total = h * 60 + m + minutes
  const day = Math.floor(total / (24 * 60))
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0'), mm = String(total % 60).padStart(2, '0')
  return `${day > 0 ? (day === 1 ? '翌' : `${day}日後 `) : ''}${hh}:${mm}`
}

/** "2026-11-02" と "19:30" から終了予定時刻("HH:MM"、日をまたぐときは "翌HH:MM")。 */
export function endClock(date: string | undefined, startTime: string | undefined, levels: AnyLevel[], startStack?: number | null, players?: number | null): string | null {
  const idx = endLevelIndex(levels, startStack, players)
  if (idx === null) return null
  return clockAfter(startTime, minutesUntilEnd(levels, idx))
}

// RC 時間(レジストクローズ。オーナー指定)。
// ブラインド表の中で「RC ブレイク」にしたブレイクが終わった瞬間を締め切りとする。
// 開始時刻から、その RC ブレイクまで(RC ブレイク自身を含む)の時間を足した時刻。

/** RC ブレイクの位置(無ければ null)。 */
export function rcBreakIndex(levels: AnyLevel[]): number | null {
  const i = levels.findIndex(l => l.type === 'break' && l.rc === true)
  return i >= 0 ? i : null
}

/** RC 時刻("HH:MM")。RC ブレイクが無い・開始時刻が無いときは null。 */
export function rcClock(startTime: string | undefined, levels: AnyLevel[]): string | null {
  const idx = rcBreakIndex(levels)
  if (idx === null) return null
  return clockAfter(startTime, minutesUntilEnd(levels, idx))
}

/**
 * 大会 1 つの RC 時刻と終了予定時刻。店舗・プレイヤーの両方の画面で同じ計算を使う。
 * ブラインドはプリセット(初期スタック・人数も持つ)を優先し、無ければ大会に入っている表を使う。
 */
export function tournamentClocks(
  t: { date?: string; startTime?: string; customBlindLevels?: AnyLevel[] | null },
  preset?: { levels?: AnyLevel[] | null; startStack?: number | null; players?: number | null } | null,
): { rc: string | null; end: string | null } {
  const levels = Array.isArray(preset?.levels) && preset!.levels!.length > 0
    ? preset!.levels!
    : Array.isArray(t.customBlindLevels) ? t.customBlindLevels : []
  return {
    rc: rcClock(t.startTime, levels),
    end: preset ? endClock(t.date, t.startTime, levels, preset.startStack, preset.players) : null,
  }
}
