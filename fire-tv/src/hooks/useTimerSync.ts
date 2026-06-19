import { useEffect, useState, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface TimerState {
  timeRemaining: number
  timerRunning: boolean
  currentLevelIndex: number
  customBlindLevels: any[]
  levelStartedAt: number | null  // ミリ秒
  levelStartedRemaining: number
  name: string
  comment: string
  entryStack: number
  reentryStack: number
  addonStack: number
  bustCount: number
  totalEntry: number
  totalReentry: number
  totalAddon: number
}

export function useTimerSync(
  storeId: string | null,
  tournamentId: string | null
): TimerState {
  const [state, setState] = useState<TimerState>({
    timeRemaining: 0,
    timerRunning: false,
    currentLevelIndex: 0,
    customBlindLevels: [],
    levelStartedAt: null,
    levelStartedRemaining: 0,
    name: '',
    comment: '',
    entryStack: 0,
    reentryStack: 0,
    addonStack: 0,
    bustCount: 0,
    totalEntry: 0,
    totalReentry: 0,
    totalAddon: 0,
  })

  const lastSeenLsAtMsRef = useRef<number | null>(null)

  useEffect(() => {
    if (!storeId || !tournamentId) return

    const unsub = onSnapshot(
      doc(db, 'stores', storeId, 'tournaments', tournamentId),
      (snap) => {
        const d = snap.data()
        if (!d) return

        // levelStartedAt が変わった時だけ levelStartedRemaining を snapshot
        const newLsAtMs = d.levelStartedAt?.toMillis?.() ?? null
        let newLevelStartedRemaining = state.levelStartedRemaining

        if (newLsAtMs !== lastSeenLsAtMsRef.current) {
          lastSeenLsAtMsRef.current = newLsAtMs
          newLevelStartedRemaining =
            typeof d.levelStartedRemaining === 'number'
              ? d.levelStartedRemaining
              : typeof d.timeRemaining === 'number'
              ? d.timeRemaining
              : 0
        }

        setState((prev) => ({
          ...prev,
          timeRemaining: d.timeRemaining ?? 0,
          timerRunning: d.timerRunning ?? false,
          currentLevelIndex: d.currentLevelIndex ?? 0,
          customBlindLevels: d.customBlindLevels ?? [],
          levelStartedAt: newLsAtMs,
          levelStartedRemaining: newLevelStartedRemaining,
          name: d.name ?? '',
          comment: d.comment ?? '',
          entryStack: d.entryStack ?? 0,
          reentryStack: d.reentryStack ?? 0,
          addonStack: d.addonStack ?? 0,
          bustCount: d.bustCount ?? 0,
          totalEntry: d.totalEntry ?? 0,
          totalReentry: d.totalReentry ?? 0,
          totalAddon: d.totalAddon ?? 0,
        }))
      }
    )

    return () => unsub()
  }, [storeId, tournamentId])

  return state
}

// 現在の経過時間を計算
export function getCurrentElapsedSeconds(
  levelStartedAtMs: number | null,
  timerRunning: boolean
): number {
  if (!levelStartedAtMs || !timerRunning) return 0
  return Math.floor((Date.now() - levelStartedAtMs) / 1000)
}

// リアルタイム表示用の時間を計算
export function getDisplayTime(
  levelStartedRemaining: number,
  elapsed: number
): number {
  return Math.max(0, levelStartedRemaining - elapsed)
}

// 時間を MM:SS フォーマットに変換
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
