'use client'

/**
 * タイマーの背景を選ぶ(オーナー指定・2026-11-03)。店舗ホームのタイマーのプレビューの上の、小さな丸いペイントボタン。
 * 10 色か任意の画像。選んだ瞬間に大会の文書へ書き、タイマー画面(店舗・TV・分割・プレイヤーの埋め込み)にすぐ出る。
 * 「店舗のデフォルト」を選ぶと大会の選択を消し、設定画面で決めた色(または画像)に戻る。
 */

import { useRef, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { Check, ImagePlus, Paintbrush } from 'lucide-react'
import { db } from '@/lib/firebase'
import AppleSheet from '@/components/AppleSheet'
import { TIMER_COLORS } from '@/lib/timerTheme'
import { flyerToDataUrl } from '@/lib/flyer'
import { showToast } from '@/lib/toast'

/** 背景画像は大会の文書に入るので、チラシより小さく(200KB 以下)する */
export const TIMER_BG_MAX_BYTES = 200_000

export function TimerBgSwatches({ value, onPick, onImage, busy, defaultLabel }: {
  value: string | null
  onPick: (id: string | null) => void
  onImage: (file: File) => void
  busy?: boolean
  /** null を選べるようにするとき(「店舗のデフォルト」)の表示名。undefined なら出さない */
  defaultLabel?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const sw = (key: string, selected: boolean, onClick: () => void, inner: React.ReactNode, bg: string, label: string) => (
    <button key={key} type="button" onClick={onClick} aria-label={label} aria-pressed={selected} title={label}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minHeight: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 48, height: 48, borderRadius: 24, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: selected ? '0 0 0 3px #fff, 0 0 0 5px #F2A900' : 'inset 0 0 0 1px rgba(60,60,67,0.18)' }}>
        {inner}
      </span>
      <span style={{ fontSize: 10, color: 'var(--label2)', maxWidth: 72, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </button>
  )
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 16 }}>
        {defaultLabel !== undefined && sw('default', value === null, () => onPick(null),
          <span className="tech-label" style={{ fontSize: 9, color: 'var(--label2)' }}>AUTO</span>, '#F2F2F7', defaultLabel)}
        {TIMER_COLORS.map(c => sw(c.id, value === c.id, () => onPick(c.id),
          value === c.id ? <Check size={20} strokeWidth={2.5} color={c.dark ? '#fff' : '#1C1C1E'} aria-hidden /> : null, c.bg, c.label))}
        {sw('image', value === 'image', () => fileRef.current?.click(),
          <ImagePlus size={20} strokeWidth={2} color="#545458" aria-hidden />, '#F2F2F7', busy ? '読み込み中…' : '画像')}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImage(f) }} />
    </div>
  )
}

export default function TimerBgPicker({ storeId, tournamentId, value, compact }: {
  storeId: string
  tournamentId: string
  /** 大会の timerBg(未選択なら null) */
  value: string | null
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = doc(db, 'stores', storeId, 'tournaments', tournamentId)

  const pick = async (id: string | null) => {
    try { await updateDoc(ref, { timerBg: id, ...(id !== 'image' ? { timerBgImage: null } : {}) }) }
    catch { showToast('背景を変更できませんでした') }
  }
  const image = async (file: File) => {
    setBusy(true)
    try {
      const url = await flyerToDataUrl(file, TIMER_BG_MAX_BYTES)
      await updateDoc(ref, { timerBg: 'image', timerBgImage: url })
    } catch (e) {
      showToast(e instanceof Error ? e.message : '画像を読み込めませんでした')
    } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="タイマーの背景を変える" title="タイマーの背景"
        style={{ width: 44, height: 44, margin: compact ? -6 : 0, padding: 0, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <span style={{ width: 32, height: 32, borderRadius: 16, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08), inset 0 0 0 1px var(--sep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Paintbrush size={16} strokeWidth={2} color="#D4910A" aria-hidden />
        </span>
      </button>
      <AppleSheet open={open} onClose={() => setOpen(false)} title={<span className="tech-label" style={{ fontSize: 11, color: 'var(--label)', letterSpacing: '0.14em' }}>TIMER BACKGROUND</span>}>
        <p style={{ fontSize: 12, color: 'var(--label2)', margin: '0 0 16px', lineHeight: 1.6 }}>
          選ぶとすぐタイマー画面(TV・分割・プレイヤーの画面も)に反映されます。
        </p>
        <div style={{ paddingBottom: 24 }}>
          <TimerBgSwatches value={value} onPick={id => void pick(id)} onImage={f => void image(f)} busy={busy} defaultLabel="店舗のデフォルト" />
        </div>
      </AppleSheet>
    </>
  )
}
