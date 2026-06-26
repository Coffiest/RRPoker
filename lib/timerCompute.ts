// Pure, side-effect-free computation of "what level/remaining-time is correct right now"
// from a frozen anchor (set by the last explicit start/pause/resume/setLevel/adjustTime
// action) plus the blind schedule. Used by every screen that displays tournament timer
// state, so they never depend on a server push (Cloud Scheduler) to stay correct.
//
// Mirrors computeCatchUp in functions/src/index.ts — keep both in sync. Duplicated rather
// than shared via a package because the Next.js app and Cloud Functions build separately.

export type TimerLevel = {
  type: "level" | "break"
  duration: number | null
  [key: string]: any
}

export type LiveLevelState = { levelIndex: number; remainingSec: number }

export function computeLiveLevelState(
  anchorLevelIndex: number,
  anchorStartedAtMs: number | null,
  anchorRemainingSec: number,
  levels: TimerLevel[],
  isRunning: boolean,
  nowMs: number = Date.now()
): LiveLevelState {
  if (!isRunning || anchorStartedAtMs === null || levels.length === 0) {
    return { levelIndex: anchorLevelIndex, remainingSec: anchorRemainingSec }
  }

  // Clamped to >= 0: elapsed time since the anchor can never be negative in reality.
  // A negative raw value only happens from residual clock skew/measurement error, and
  // must never be allowed to inflate the displayed remaining time above what was set.
  const elapsed = Math.max(0, Math.floor((nowMs - anchorStartedAtMs) / 1000))
  let timeLeft = anchorRemainingSec - elapsed
  let idx = anchorLevelIndex

  while (timeLeft <= 0) {
    const nextIdx = idx + 1
    if (nextIdx >= levels.length) {
      // Tournament finished: clamp at the last level with 0 remaining.
      return { levelIndex: idx, remainingSec: 0 }
    }
    idx = nextIdx
    const dur =
      typeof levels[idx]?.duration === "number" && levels[idx].duration! > 0
        ? levels[idx].duration! * 60
        : 1
    timeLeft += dur
  }

  return { levelIndex: idx, remainingSec: timeLeft }
}
