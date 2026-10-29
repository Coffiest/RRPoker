// 「開始時刻になったらタイマーをスタート」(トーナメントの autoStart)。
//
// 店舗の端末(店舗ホーム・トーナメント画面)が開いている間、毎秒これを呼ぶ。
// 開始時刻を過ぎた autoStart の大会を、開催中にしてタイマーを動かす。
// 端末を開くのが遅れても、タイマーは「開始時刻に始まった」ものとして進める
// (levelStartedAt に開始時刻そのものを入れる)。サーバー側の毎分の見回り
// (functions の recoverStuckTournamentTimers)も同じことをするので、端末が
// 閉じていても始まる。二重に始めないよう、トランザクションで autoStartedAt を見る。

import { doc, getDoc, runTransaction, Timestamp } from "firebase/firestore"
import { db } from "./firebase"

/** "2026-10-28" + "19:30" を、その日時のミリ秒にする(端末の時間帯=日本時間)。 */
export function scheduledStartMs(date?: string, startTime?: string): number | null {
  if (!date || !startTime) return null
  const ms = new Date(`${date}T${startTime}:00`).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function isAutoStartDue(t: any, nowMs: number): boolean {
  if (!t?.autoStart || t.autoStartedAt || t.timerRunning) return false
  if (t.status !== "scheduled" && t.status !== "active") return false
  const at = scheduledStartMs(t.date, t.startTime)
  return at !== null && nowMs >= at
}

const starting = new Set<string>()

export async function autoStartTournament(storeId: string, tournamentId: string): Promise<void> {
  if (starting.has(tournamentId)) return
  starting.add(tournamentId)
  try {
    const ref = doc(db, "stores", storeId, "tournaments", tournamentId)
    // ブラインド表は大会に保存済みのもの、無ければ紐づくプリセットから取る
    const pre = (await getDoc(ref)).data()
    if (!pre) return
    let levels: any[] = Array.isArray(pre.customBlindLevels) && pre.customBlindLevels.length > 0 ? pre.customBlindLevels : []
    if (levels.length === 0 && typeof pre.blindPresetId === "string" && pre.blindPresetId) {
      const ps = await getDoc(doc(db, "stores", storeId, "blindPresets", pre.blindPresetId))
      const pl = ps.data()?.levels
      if (Array.isArray(pl)) levels = pl
    }
    const firstDur = typeof levels[0]?.duration === "number" && levels[0].duration > 0 ? levels[0].duration * 60 : 1200

    await runTransaction(db, async tx => {
      const snap = await tx.get(ref)
      const d = snap.data()
      if (!d || d.autoStartedAt || d.timerRunning || !d.autoStart) return
      const at = scheduledStartMs(d.date, d.startTime)
      if (at === null) return
      tx.update(ref, {
        status: "active",
        startedAt: d.startedAt ?? Timestamp.fromMillis(at),
        timerRunning: true,
        currentLevelIndex: 0,
        levelStartedAt: Timestamp.fromMillis(at),
        levelStartedRemaining: firstDur,
        timeRemaining: firstDur,
        autoStartedAt: Timestamp.fromMillis(at),
        ...(levels.length > 0 && !Array.isArray(d.customBlindLevels) ? { customBlindLevels: levels } : {}),
      })
    })
  } catch (e) {
    console.error("auto start failed", e)
  } finally {
    starting.delete(tournamentId)
  }
}
