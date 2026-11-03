'use client'

/**
 * 店舗のタイマー背景のデフォルト(オーナー指定・2026-11-03)。設定画面に置く。
 * 背景を選んでいない大会は、ここで決めた色(または画像)で始まる。
 * 色は stores/{id}.timerBgDefault に、画像は大きいので店舗の文書ではなく
 * オーナーの users/{uid}.timerBgDefaultImage に置く(店舗の一覧を読むプレイヤーに重い画像を配らないため)。
 */

import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { TimerBgSwatches, TIMER_BG_MAX_BYTES } from '@/components/TimerBgPicker'
import { flyerToDataUrl } from '@/lib/flyer'
import { showToast } from '@/lib/toast'

export default function TimerBgDefaultSetting({ storeId }: { storeId: string }) {
  const [value, setValue] = useState<string | null>(null)
  const [ownerUid, setOwnerUid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => onSnapshot(doc(db, 'stores', storeId), snap => {
    const d = snap.data()
    setValue(typeof d?.timerBgDefault === 'string' ? d.timerBgDefault : 'white')
    setOwnerUid(typeof d?.ownerUid === 'string' ? d.ownerUid : null)
  }, () => {}), [storeId])

  const pick = async (id: string | null) => {
    try { await updateDoc(doc(db, 'stores', storeId), { timerBgDefault: id ?? 'white' }) }
    catch { showToast('保存できませんでした') }
  }
  const image = async (file: File) => {
    if (!ownerUid) return
    setBusy(true)
    try {
      const url = await flyerToDataUrl(file, TIMER_BG_MAX_BYTES)
      await updateDoc(doc(db, 'users', ownerUid), { timerBgDefaultImage: url })
      await updateDoc(doc(db, 'stores', storeId), { timerBgDefault: 'image' })
    } catch (e) {
      showToast(e instanceof Error ? e.message : '画像を読み込めませんでした')
    } finally { setBusy(false) }
  }

  return <TimerBgSwatches value={value} onPick={id => void pick(id)} onImage={f => void image(f)} busy={busy} />
}
