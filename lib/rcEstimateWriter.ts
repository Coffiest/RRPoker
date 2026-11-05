/**
 * RC 後の終了予定の再計算(lib/endEstimate.ts の computeRcEstimate)を、大会の文書に書く。
 * 店舗の画面(タイマー画面・店舗ホーム)から呼ぶ。サーバーの毎分の巡回(functions)も同じことをするが、
 * 待つと最大 1 分遅れるので、店舗の画面が開いていればその場で書く。
 * プレイヤーの画面・view=1 のタイマーからは呼ばない(書き込み禁止。CLAUDE.md)。
 */
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { computeRcEstimate, rcBoundaryMs, rcBreakIndex } from '@/lib/endEstimate'

type AnyLevel = { type: string; bigBlind?: number | null; duration?: number | null; rc?: boolean | null }

const pending = new Set<string>()

/** 大会の表(サーバーの resolveLevels と同じ: 大会の表、無ければプリセットの表) */
export function levelsOf(t: any, presetLevels?: AnyLevel[] | null): AnyLevel[] {
  if (Array.isArray(t?.customBlindLevels) && t.customBlindLevels.length > 0) return t.customBlindLevels
  return Array.isArray(presetLevels) ? presetLevels : []
}

/**
 * RC ブレイクが終わっていて、まだ再計算が無ければ書く。
 * t は大会の文書(levelStartedAt は Timestamp でも、ミリ秒の levelStartedAtMs でもよい)。
 */
export function maybeWriteRcEstimate(storeId: string, tournamentId: string, t: any, levels: AnyLevel[], nowMs: number) {
  if (!storeId || !tournamentId || t?.rcEstimate || !t?.timerRunning) return
  if (rcBreakIndex(levels) === null) return
  const lsAt: number | null = typeof t.levelStartedAtMs === 'number' ? t.levelStartedAtMs : (t.levelStartedAt?.toMillis?.() ?? null)
  const boundary = rcBoundaryMs(levels, t.currentLevelIndex ?? 0, lsAt, t.levelStartedRemaining ?? t.timeRemaining ?? 0)
  if (boundary === null || boundary > nowMs) return
  const key = `${storeId}/${tournamentId}`
  if (pending.has(key)) return
  const est = computeRcEstimate(levels, t, boundary)
  if (!est) return
  pending.add(key)
  const ref = doc(db, 'stores', storeId, 'tournaments', tournamentId)
  // 同じ大会を複数の端末が同時に書かないよう、まだ無いときだけ書く
  runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    if (!snap.exists() || snap.data().rcEstimate) return
    tx.update(ref, { rcEstimate: est })
  }).catch(() => {}).finally(() => { setTimeout(() => pending.delete(key), 10_000) })
}
