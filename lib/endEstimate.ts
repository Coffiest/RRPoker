// 終了予定(オーナー指定)。
// 卓の合計チップ = 初期スタック × 人数。ヘッズアップ(残り 2 人)のアベレージ = 合計 ÷ 2。
// そのアベレージが 10BB を切る(アベレージ ÷ BB < 10)最初のレベルを「終了予定」のレベルとする。
// 例: 300 点 × 30 人 = 9000、÷2 = 4500 → 4500 ÷ 500 = 9 < 10 なので 250/500 が終了予定。
// 終了予定時刻は、開始時刻からそのレベルが終わるまでの時間(ブレイクも含む)を足した時刻。

type AnyLevel = { type: string; bigBlind?: number | null; duration?: number | null }

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

/** "2026-11-02" と "19:30" から終了予定時刻("HH:MM"、日をまたぐときは "翌HH:MM")。 */
export function endClock(date: string | undefined, startTime: string | undefined, levels: AnyLevel[], startStack?: number | null, players?: number | null): string | null {
  const idx = endLevelIndex(levels, startStack, players)
  if (idx === null || !startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const total = h * 60 + m + minutesUntilEnd(levels, idx)
  const day = Math.floor(total / (24 * 60))
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0'), mm = String(total % 60).padStart(2, '0')
  return `${day > 0 ? (day === 1 ? '翌' : `${day}日後 `) : ''}${hh}:${mm}`
}
