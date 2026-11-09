'use client'

/**
 * 店舗が QR を読んだあとの画面(オーナー指定・2026-11-09)。
 * Player 画面(PlayerManageModal)と同じ書き方・同じ決まりで、開催中の大会をすべて 1 つの画面に並べ、右上の ✓ でまとめて確定する。
 * 別の画面は重ねない(残高不足の確認だけは小さな確認を出す。Player 画面と同じ)。
 * - エントリーとリエントリーの金額・スタックが同じ大会は E だけ(+ はエントリーとして記録、− はリエントリーから減らす)
 * - アドオンの金額もスタックも無い大会は A を出さない
 * - 変えた数は「0→1」と赤で出す。Bust も同じ
 * 記録の付け方は lib/quickEntry.ts(Player 画面の保存と同じ)。入店していない人は ✓ で入店も行う。
 */

import { useEffect, useState } from 'react'
import { FiLogIn, FiLogOut } from 'react-icons/fi'
import AppleSheet from '@/components/AppleSheet'
import ConfirmDialog, { type ConfirmRequest } from '@/components/ConfirmDialog'
import Loader from '@/components/Loader'
import PlayerAvatar from '@/components/PlayerAvatar'
import StepButton from '@/components/StepButton'
import { commitQuick, type QuickAction } from '@/lib/quickEntry'
import { showToast } from '@/lib/toast'

type Counts = { entry: number; reentry: number; addon: number }
type Draft = Counts & { bust: number; buys: Counts }
const EMPTY: Draft = { entry: 0, reentry: 0, addon: 0, bust: 0, buys: { entry: 0, reentry: 0, addon: 0 } }

export type QrSheetPlayer = { uid: string; name: string; iconUrl?: string; inStore: boolean; balance: number; loading?: boolean }

function fmt(n: number, unit?: string, before?: boolean) {
  if (!unit || unit === '単位なし') return n.toLocaleString()
  return before !== false ? `${unit}${n.toLocaleString()}` : `${n.toLocaleString()}${unit}`
}

export default function QrPlayerSheet({ player, tournaments, entriesLive, storeId, balanceGroupId, chipUnit, chipUnitBefore, busy, onClose, onCheckIn, onCheckOut, waitLoad }: {
  player: QrSheetPlayer | null
  tournaments: any[]
  entriesLive: Record<string, Record<string, Counts>>
  storeId: string
  balanceGroupId: string
  chipUnit?: string
  chipUnitBefore?: boolean
  busy: boolean
  onClose: () => void
  onCheckIn: () => Promise<void>
  onCheckOut: () => Promise<void>
  /** 初めての人の読み込みを待つ */
  waitLoad: () => Promise<void>
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [saving, setSaving] = useState(false)
  // 別の人を読んだら下書きを消す
  useEffect(() => { setDrafts({}) }, [player?.uid])

  const base = (tid: string): Counts => (player && entriesLive[tid]?.[player.uid]) || { entry: 0, reentry: 0, addon: 0 }
  const d = (tid: string) => drafts[tid] ?? EMPTY
  const fee = (t: any, k: keyof Counts) => Number(t[`${k}Fee`] ?? 0)

  // 確定後の残高(Player 画面の BR の表示と同じ考え方)
  const delta = tournaments.reduce((sum, t) => {
    const x = d(t.id)
    return sum + (['entry', 'reentry', 'addon'] as const).reduce((s, k) => s + x.buys[k] * fee(t, k) - x[k] * fee(t, k), 0)
  }, 0)
  const purchase = tournaments.reduce((sum, t) => { const x = d(t.id); return sum + (['entry', 'reentry', 'addon'] as const).reduce((s, k) => s + x.buys[k] * fee(t, k), 0) }, 0)
  const virtual = (player?.balance ?? 0) + delta
  const dirty = Object.values(drafts).some(x => x.entry || x.reentry || x.addon || x.bust)

  const bump = (tid: string, k: keyof Counts | 'bust', n: number, buy = false) =>
    setDrafts(m => {
      const x = m[tid] ?? EMPTY
      const next: Draft = { ...x, buys: { ...x.buys }, [k]: x[k] + n }
      if (buy && k !== 'bust') next.buys[k] += 1
      // 減らしたとき、その場の会計の分も戻す
      if (n < 0 && k !== 'bust' && next.buys[k] > Math.max(0, next[k])) next.buys[k] = Math.max(0, next[k])
      return { ...m, [tid]: next }
    })

  const plus = (t: any, k: keyof Counts) => {
    const f = fee(t, k)
    if (f > 0 && virtual < f) {
      setConfirm({ title: '所持バンクロール不足', message: '会計をしてください', action: '確認', run: () => bump(t.id, k, 1, true) })
      return
    }
    bump(t.id, k, 1)
  }

  const save = async () => {
    if (!player || saving) return
    if (!dirty) { onClose(); return }
    setSaving(true)
    try {
      if (player.loading) await waitLoad()
      const entering = Object.values(drafts).some(x => x.entry > 0 || x.reentry > 0 || x.addon > 0)
      if (entering && !player.inStore) await onCheckIn()
      for (const t of tournaments) {
        const x = drafts[t.id]
        if (!x) continue
        for (const k of ['entry', 'reentry', 'addon'] as const) {
          const n = x[k]
          for (let i = 0; i < Math.abs(n); i++) {
            await commitQuick({ storeId, balanceGroupId, tournamentId: t.id, playerId: player.uid, playerName: player.name, action: k as QuickAction, fee: fee(t, k), withPurchase: n > 0 && i < x.buys[k] }, n > 0 ? 1 : -1)
          }
        }
        for (let i = 0; i < Math.abs(x.bust); i++) {
          await commitQuick({ storeId, balanceGroupId, tournamentId: t.id, playerId: player.uid, playerName: player.name, action: 'bust', fee: 0 }, x.bust > 0 ? 1 : -1)
        }
      }
      onClose()
    } catch {
      showToast('保存できませんでした')
    } finally { setSaving(false) }
  }

  return (
    <>
      <AppleSheet open={!!player} onClose={onClose} maxWidth={480} maxHeightVh={94}
        title={player && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={onClose} aria-label="閉じる"
              style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(255,255,255,0.6)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#3C3C43', lineHeight: 1, flexShrink: 0 }}>×</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Players</span>
            <button type="button" onClick={() => void save()} disabled={saving} aria-label="確定"
              style={{ width: 34, height: 34, borderRadius: '50%', background: saving ? '#E5E5EA' : 'linear-gradient(135deg,#34C759,#2DAD4D)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(52,199,89,0.35)', fontSize: 18, color: '#fff', lineHeight: 1, flexShrink: 0 }}>{saving ? '…' : '✓'}</button>
          </div>
        )}>
        {player && (
          <div style={{ paddingBottom: 16 }}>
            {/* プレイヤー: 名前・入店・残高(確定後の残高も) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 8 }}>
              <PlayerAvatar src={player.iconUrl} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.loading ? '読み込み中' : player.name || '名前未設定'}</p>
                <p className="tech-num" style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap', fontSize: 10, color: 'var(--label2)' }}>
                  <span className="tech-label" style={{ fontSize: 9, color: player.inStore ? '#1E7B34' : 'var(--label2)' }}>{player.loading ? 'LOADING' : player.inStore ? 'IN STORE' : 'NOT CHECKED IN'}</span>
                  <span style={{ fontWeight: 700, color: '#D4910A' }}>BR</span>
                  <span style={{ fontWeight: 700, color: '#1C1C1E' }}>{fmt(player.balance, chipUnit, chipUnitBefore)}</span>
                  {purchase > 0 && <span style={{ fontWeight: 700, color: '#1E7B34' }}>+{fmt(purchase, chipUnit, chipUnitBefore)}</span>}
                  {delta - purchase !== 0 && <span style={{ fontWeight: 700, color: delta - purchase > 0 ? '#1E7B34' : '#C62828' }}>{delta - purchase > 0 ? '+' : ''}{fmt(delta - purchase, chipUnit, chipUnitBefore)}</span>}
                  {dirty && <><span>→</span><span style={{ fontWeight: 700, color: virtual < 0 ? '#C62828' : '#1C1C1E' }}>{fmt(virtual, chipUnit, chipUnitBefore)}</span></>}
                </p>
              </div>
              {player.loading ? <Loader size={24} /> : player.inStore ? (
                <button type="button" onClick={() => void onCheckOut()} disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', borderRadius: 10, border: 'none', background: 'rgba(255,59,48,0.1)', color: '#C62828', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                  <FiLogOut size={13} /> 退店
                </button>
              ) : (
                <button type="button" onClick={() => void onCheckIn()} disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', borderRadius: 10, border: 'none', background: 'rgba(52,199,89,0.12)', color: '#1E7B34', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                  <FiLogIn size={13} /> 入店
                </button>
              )}
            </div>

            {tournaments.length === 0 && <p className="term-comment" style={{ fontSize: 13, color: 'var(--label2)', padding: '8px 4px' }}>開催中のトーナメントはありません</p>}
            {!player.loading && !player.inStore && tournaments.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--label2)', margin: '0 4px 6px' }}>エントリー等を ✓ で確定すると、入店も同時にします。</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tournaments.map(t => {
                const b = base(t.id), x = d(t.id)
                const eqER = Number(t.entryFee ?? 0) === Number(t.reentryFee ?? 0) && Number(t.entryStack ?? 0) === Number(t.reentryStack ?? 0)
                const hasAddon = Number(t.addonFee ?? 0) > 0 || Number(t.addonStack ?? 0) > 0
                const now = { entry: b.entry + x.entry, reentry: b.reentry + x.reentry, addon: b.addon + x.addon }
                type F = { key: string; label: string; was: number; now: number; plus: () => void; minus: () => void }
                const fields: F[] = [
                  eqER
                    ? { key: 'E', label: 'Entry', was: b.entry + b.reentry, now: now.entry + now.reentry, plus: () => plus(t, 'entry'), minus: () => (now.reentry > 0 ? bump(t.id, 'reentry', -1) : bump(t.id, 'entry', -1)) }
                    : { key: 'E', label: 'Entry', was: b.entry, now: now.entry, plus: () => plus(t, 'entry'), minus: () => bump(t.id, 'entry', -1) },
                  ...(eqER ? [] : [{ key: 'R', label: 'Re-entry', was: b.reentry, now: now.reentry, plus: () => plus(t, 'reentry'), minus: () => bump(t.id, 'reentry', -1) }]),
                  ...(hasAddon ? [{ key: 'A', label: 'Add-on', was: b.addon, now: now.addon, plus: () => plus(t, 'addon'), minus: () => bump(t.id, 'addon', -1) }] : []),
                ]
                const bustWas = Number(t.bustCount ?? 0), bustNow = bustWas + x.bust
                return (
                  <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: '6px 8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <p style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                      {/* Bust(大会全体の数。Player 画面と同じ) */}
                      <span className="tech-label" style={{ fontSize: 9, color: 'var(--label2)' }}>Bust</span>
                      <StepButton kind="minus" label="バストを減らす" size={24} hit={30} disabled={bustNow <= 0} onClick={() => bump(t.id, 'bust', -1)} />
                      <Num now={bustNow} was={bustWas} />
                      <StepButton kind="plus" label="バストを増やす" size={24} hit={30} onClick={() => bump(t.id, 'bust', 1)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}>
                      {fields.map(f => (
                        <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <span className="tech-label" style={{ fontSize: 9, color: 'var(--label2)', width: 12 }}>{f.key}</span>
                          <StepButton kind="minus" label={`${f.label}を減らす`} size={26} hit={32} disabled={f.now <= 0} onClick={f.minus} />
                          <Num now={f.now} was={f.was} />
                          <StepButton kind="plus" label={`${f.label}を増やす`} size={26} hit={32} onClick={f.plus} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </AppleSheet>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} zIndex={3000} />
    </>
  )
}

/** 数と、その下に変えた分(赤で「0→1」) */
function Num({ now, was }: { now: number; was: number }) {
  return (
    <span style={{ position: 'relative', minWidth: 22, textAlign: 'center' }}>
      <span className="tech-num" style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1E' }}>{now}</span>
      {now !== was && <span className="tech-num" style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: '#C62828', whiteSpace: 'nowrap', lineHeight: 1 }}>{was}→{now}</span>}
    </span>
  )
}
