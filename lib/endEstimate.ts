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

// ── RC 後の再計算(オーナー指定・2026-11-05)──────────────────────────────
// RC ブレイクが終わった瞬間の、卓の合計チップ(= 残り人数 × アベレージスタック)で、
// 最初の終了予定と同じ決め方(ヘッズアップのアベレージが 10BB を切る最初のレベル)をやり直す。
// 時刻は「実際に RC ブレイクが終わった時刻 + その後のレベルの時間」。一時停止や開始の遅れも入る。
// 計算した瞬間の値を大会の文書に rcEstimate として残す(その後のバストで変わらないように)。
// 書くのはサーバー(functions/src/index.ts の毎分の巡回・レベル送り)と、店舗のタイマー画面。

export type RcEstimate = {
  /** 再計算した終了予定(ミリ秒) */
  endAtMs: number
  /** 実際に RC ブレイクが終わった時刻(ミリ秒) */
  rcEndAtMs: number
  /** その瞬間の残り人数・アベレージスタック・卓の合計チップ */
  players: number
  avgStack: number
  totalChips: number
}

type Totals = {
  totalEntry?: number | null; totalReentry?: number | null; totalAddon?: number | null; bustCount?: number | null
  entryStack?: number | null; reentryStack?: number | null; addonStack?: number | null
}

/** 卓の合計チップ。タイマー画面の AVERAGE と同じ式(エントリー・リエントリー・アドオンのスタックの合計) */
export function totalChipsOf(d: Totals): number {
  const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return n(d.totalEntry) * n(d.entryStack) + n(d.totalReentry) * n(d.reentryStack) + n(d.totalAddon) * n(d.addonStack)
}

/** RC ブレイクが終わった時刻 rcEndAtMs での再計算。RC ブレイクが無い・チップが分からない・該当レベルが無いときは null。 */
export function computeRcEstimate(levels: AnyLevel[], d: Totals, rcEndAtMs: number): RcEstimate | null {
  const rc = rcBreakIndex(levels)
  if (rc === null) return null
  const totalChips = totalChipsOf(d)
  if (totalChips <= 0) return null
  const players = Math.max(0, (d.totalEntry ?? 0) + (d.totalReentry ?? 0) - (d.bustCount ?? 0))
  const avgHeadsUp = totalChips / 2
  let minutes = 0
  for (let i = rc + 1; i < levels.length; i++) {
    const l = levels[i]
    minutes += l.duration ?? 0
    if (l.type === 'level' && (l.bigBlind ?? 0) > 0 && avgHeadsUp / (l.bigBlind as number) < 10) {
      return { endAtMs: rcEndAtMs + minutes * 60_000, rcEndAtMs, players, avgStack: players > 0 ? Math.floor(totalChips / players) : 0, totalChips }
    }
  }
  return null
}

/**
 * タイマーの状態から、RC ブレイクが終わる(終わった)時刻。
 * いまのレベルが RC ブレイクより後なら、もう分からないので null。
 */
export function rcBoundaryMs(levels: AnyLevel[], currentIdx: number, levelStartedAtMs: number | null, levelStartedRemaining: number): number | null {
  const rc = rcBreakIndex(levels)
  if (rc === null || levelStartedAtMs === null || currentIdx > rc) return null
  let sec = levelStartedRemaining
  for (let i = currentIdx + 1; i <= rc; i++) sec += (levels[i]?.duration ?? 0) * 60
  return levelStartedAtMs + sec * 1000
}

/** ミリ秒を "HH:MM" に。大会の日付より後の日なら "翌HH:MM"。 */
export function msToClock(ms: number, date?: string): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
  let prefix = ''
  if (date) {
    const base = new Date(`${date}T00:00:00`).getTime()
    if (Number.isFinite(base)) {
      const day = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - base) / 86_400_000 + 0.5)
      if (day === 1) prefix = '翌'
      else if (day > 1) prefix = `${day}日後 `
    }
  }
  return `${prefix}${hh}:${mm}`
}

function isRcEstimate(v: unknown): v is RcEstimate {
  return !!v && typeof (v as RcEstimate).endAtMs === 'number' && Number.isFinite((v as RcEstimate).endAtMs)
}

/**
 * 大会 1 つの開始・RC・終了予定。店舗・プレイヤーの両方の画面で同じ計算を使う。
 * ブラインドはプリセット(初期スタック・人数も持つ)を優先し、無ければ大会に入っている表を使う。
 * RC 後に再計算した終了予定(rcEstimate)があれば end はそちら。endOriginal は最初の終了予定、
 * delayMin は再計算 − 最初(分。プラスなら遅延、マイナスなら早まる。どちらかが無ければ null)。
 */
export function tournamentClocks(
  t: { date?: string; startTime?: string; customBlindLevels?: AnyLevel[] | null; rcEstimate?: unknown },
  preset?: { levels?: AnyLevel[] | null; startStack?: number | null; players?: number | null } | null,
): { start: string | null; rc: string | null; end: string | null; endOriginal: string | null; delayMin: number | null; recalculated: boolean } {
  // 自動スタートの「Waiting for start」(lib/waitingLevel.ts)は計算に入れない
  const levels = (Array.isArray(preset?.levels) && preset!.levels!.length > 0
    ? preset!.levels!
    : Array.isArray(t.customBlindLevels) ? t.customBlindLevels : []).filter(l => l.type !== 'waiting')
  const original = preset ? endClock(t.date, t.startTime, levels, preset.startStack, preset.players) : null
  const est = isRcEstimate(t.rcEstimate) ? t.rcEstimate : null
  let delayMin: number | null = null
  if (est && preset) {
    const idx = endLevelIndex(levels, preset.startStack, preset.players)
    const startMs = t.date && t.startTime ? new Date(`${t.date}T${t.startTime}:00`).getTime() : NaN
    if (idx !== null && Number.isFinite(startMs)) {
      // 分単位で比べる(表示している時刻どうしの差と一致させる)
      const planned = Math.floor((startMs + minutesUntilEnd(levels, idx) * 60_000) / 60_000)
      delayMin = Math.floor(est.endAtMs / 60_000) - planned
    }
  }
  return {
    start: t.startTime && /^\d{1,2}:\d{2}$/.test(t.startTime) ? t.startTime : null,
    rc: rcClock(t.startTime, levels),
    end: est ? msToClock(est.endAtMs, t.date) : original,
    endOriginal: original,
    delayMin,
    recalculated: !!est,
  }
}
