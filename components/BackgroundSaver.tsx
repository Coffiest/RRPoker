'use client'

/**
 * 画面が隠れている間は、データベースとの通信を休ませる(電池対策・2026-11-16)。
 * Firestore は画面を閉じても裏で接続を保ち、変化があるたびに受け取り続ける(電波と CPU が起きたまま)。
 * 隠れてから 60 秒たったら通信を止め、画面に戻ったらすぐ再開する(戻ると最新の内容が一度に届く)。
 * 60 秒待つのは、通知を見る・別のアプリを少し開くなどの短い切り替えで毎回つなぎ直さないため。
 * app/layout.tsx に 1 つだけ置く。
 */
import { useEffect } from 'react'
import { disableNetwork, enableNetwork } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function BackgroundSaver() {
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    let off = false
    const onVis = () => {
      if (document.hidden) {
        if (!t && !off) t = setTimeout(() => { t = null; off = true; void disableNetwork(db).catch(() => { off = false }) }, 60_000)
      } else {
        if (t) { clearTimeout(t); t = null }
        if (off) { off = false; void enableNetwork(db).catch(() => {}) }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); if (t) clearTimeout(t) }
  }, [])
  return null
}
