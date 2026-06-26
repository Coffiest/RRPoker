import { httpsCallable } from "firebase/functions"
import { functions } from "./firebase"

// Device clocks can be off by several seconds (no/stale NTP sync), which silently
// corrupts every wall-clock timer calculation (elapsed = Date.now() - serverTimestamp).
// This measures the offset once via round-trip to the server and corrects for it,
// the same way Firebase Realtime Database's `.info/serverTimeOffset` works —
// Firestore has no built-in equivalent, so it's done here via a callable function.

let offsetMs = 0
let calibrating: Promise<void> | null = null
let intervalStarted = false

const RECALIBRATE_INTERVAL_MS = 5 * 60 * 1000

async function calibrate(): Promise<void> {
  try {
    const fn = httpsCallable<Record<string, never>, { serverTimeMs: number }>(functions, "getServerTime")
    const t0 = Date.now()
    const res = await fn({})
    const t1 = Date.now()
    const roundTrip = t1 - t0
    const serverTimeAtT1 = res.data.serverTimeMs + roundTrip / 2
    offsetMs = serverTimeAtT1 - t1
  } catch {
    // Calibration failed (offline, etc.) — keep the previous offset rather than
    // resetting to 0, since a stale-but-measured offset is still better than none.
  }
}

/** Starts (or refreshes) clock calibration. Safe to call from every mounted component. */
export function ensureClockCalibrated(): void {
  if (!calibrating) calibrating = calibrate().finally(() => { calibrating = null })
  if (!intervalStarted && typeof window !== "undefined") {
    intervalStarted = true
    window.setInterval(() => { void calibrate() }, RECALIBRATE_INTERVAL_MS)
  }
}

/** Best estimate of the current server time, corrected for this device's clock offset. */
export function getServerNow(): number {
  return Date.now() + offsetMs
}
