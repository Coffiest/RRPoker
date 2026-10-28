"use client"
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon, TriangleAlertIcon, XIcon } from 'lucide-react'
import AppleSheet from "@/components/AppleSheet"

import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, orderBy, getDocs, writeBatch, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import ChipDisclaimer from "@/components/ChipDisclaimer"

type Transaction = {
  id: string
  amount: number
  createdAt?: any
  direction: "add" | "subtract"
  type: string
  comment?: string
}

type Props = {
  playerId: string
  storeId: string
  playerName?: string
  chipUnit?: string
  chipUnitBefore?: boolean
  onClose: () => void
  /** 重なり順。全画面タイマーの上に出すときに上げる。 */
  zIndex?: number
}

function formatDate(ts: any) {
  if (!ts) return "—"
  if (typeof ts.seconds === "number") {
    const d = new Date(ts.seconds * 1000)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return "—"
}

function formatType(type: string, comment?: string) {
  switch (type) {
    case "manual_adjustment":
    case "manual_adjustment_net_gain": return comment ? `手動調整：${comment}` : "手動調整"
    case "deposit_approved_purchase":  return "預入（購入）"
    case "deposit_approved_pure_increase": return "預入（純増）"
    case "withdraw_approved":          return "引き出し"
    case "withdraw_request":           return "引き出し申請"
    case "store_buyin":                return "バイイン"
    case "store_cashout":              return "キャッシュアウト"
    case "store_chip_purchase":        return "チップ購入"
    case "store_tournament_entry":     return "エントリー"
    case "store_tournament_reentry":   return "リエントリー"
    case "store_tournament_addon":     return "アドオン"
    case "tournament_payout":          return "プライズ"
    case "other":                      return comment ?? "その他"
    default:                           return type
  }
}

function formatSubtype(type: string) {
  if (type.startsWith("store_tournament") || type === "tournament_payout") return "Tournament"
  if (type.startsWith("store_")) return "Ring Game"
  if (type.startsWith("deposit_") || type.startsWith("withdraw")) return "Transfer"
  return "Manual"
}

function fmtChip(amount: number, unit?: string, before?: boolean): string {
  if (!unit) return amount.toLocaleString()
  return before ? `${unit}${amount.toLocaleString()}` : `${amount.toLocaleString()}${unit}`
}

export default function PlayerHistoryModal({ playerId, storeId, playerName, chipUnit, chipUnitBefore, onClose, zIndex }: Props) {
  const [history, setHistory] = useState<Transaction[]>([])
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [wipeError, setWipeError] = useState("")

  useEffect(() => {
    if (!playerId || !storeId) return
    const q = query(
      collection(db, "transactions"),
      where("playerId", "==", playerId),
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc")
    )
    const unsub = onSnapshot(q, snap => {
      const list: Transaction[] = []
      snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as Omit<Transaction, "id">) }))
      setHistory(list)
    })
    return () => unsub()
  }, [playerId, storeId])

  // 履歴とバンクロールをまとめて削除（個別削除は不可・全削除のみ）。
  // balance/netGainを同時にリセットすることで、チップ増減グラフとの不整合を防ぐ。
  const wipeHistoryAndBalance = async () => {
    setWiping(true)
    setWipeError("")
    try {
      const snap = await getDocs(
        query(collection(db, "transactions"), where("playerId", "==", playerId), where("storeId", "==", storeId))
      )
      const docs = snap.docs
      const CHUNK = 450
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db)
        docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref))
        if (i + CHUNK >= docs.length) {
          batch.set(doc(db, "users", playerId, "storeBalances", storeId), { balance: 0, netGain: 0 }, { merge: true })
        }
        await batch.commit()
      }
      if (docs.length === 0) {
        await writeBatch(db)
          .set(doc(db, "users", playerId, "storeBalances", storeId), { balance: 0, netGain: 0 }, { merge: true })
          .commit()
      }
      setWipeConfirmOpen(false)
      onClose()
    } catch {
      setWipeError("削除中にエラーが発生しました")
    } finally {
      setWiping(false)
    }
  }

  return (
    <AppleSheet open onClose={onClose} bare maxWidth={480} maxHeightVh={80} zIndex={zIndex ?? 200}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, flexShrink: 0 }}>
          <div style={{ width: 36, height: 5, borderRadius: 999, background: 'rgba(60,60,67,0.20)' }}/>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 16px', borderBottom: '1px solid rgba(60,60,67,0.12)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(28,28,30,1)', margin: 0 }}>チップ履歴</p>
            <p style={{ fontSize: 11, color: 'var(--label3)', margin: '2px 0 0' }}>{history.length}件</p>
            <ChipDisclaimer className="mt-2" />
          </div>
          <button
            onClick={onClose}
            style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(255,255,255,0.6)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <XIcon size={14} style={{ color: 'var(--label3)' }}/>
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(120,120,128,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <ArrowUpIcon size={20} style={{ color: 'var(--label3)' }}/>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label3)', margin: 0 }}>履歴なし</p>
              <p style={{ fontSize: 12, color: 'var(--label3)', margin: 0 }}>取引が記録されると表示されます</p>
            </div>
          ) : (
            history.map((item, idx) => {
              const isAdd = item.direction === "add"
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', padding: '16px 16px',
                  borderBottom: idx < history.length - 1 ? '1px solid rgba(60,60,67,0.08)' : 'none',
                }}>
                  {/* Direction icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 11, flexShrink: 0, marginRight: 16,
                    background: isAdd ? 'rgba(242,169,0,0.1)' : 'rgba(120,120,128,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isAdd
                      ? <ArrowUpIcon size={15} style={{ color: '#D4910A' }}/>
                      : <ArrowDownIcon size={15} style={{ color: 'var(--label3)' }}/>
                    }
                  </div>

                  {/* Type + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(28,28,30,1)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatType(item.type, item.comment)}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--label3)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: 'rgba(120,120,128,0.08)', borderRadius: 4, padding: '1px 8px', fontWeight: 600 }}>
                        {formatSubtype(item.type)}
                      </span>
                      <span>{formatDate(item.createdAt)}</span>
                    </p>
                  </div>

                  {/* Amount */}
                  <p style={{
                    fontSize: 14, fontWeight: 800, flexShrink: 0, marginLeft: 8,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px',
                    color: isAdd ? '#D4910A' : 'var(--label3)',
                  }}>
                    {isAdd ? '+' : '−'}{fmtChip(item.amount ?? 0, chipUnit, chipUnitBefore)}
                  </p>
                </div>
              )
            })
          )}
        </div>

        {/* Danger zone */}
        <div style={{ padding: '16px 16px 0', borderTop: '1px solid rgba(60,60,67,0.12)', flexShrink: 0 }}>
          <button
            onClick={() => setWipeConfirmOpen(true)}
            style={{
              width: '100%', height: 44, borderRadius: 12, border: 'none', background: 'rgba(255,59,48,0.08)',
              color: '#FF3B30', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Trash2Icon size={14} />
            履歴とチップを全て削除
          </button>
        </div>
      </div>

      {/* Wipe confirmation */}
      {wipeConfirmOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '0 24px' }}
          onClick={e => { e.stopPropagation(); if (!wiping) setWipeConfirmOpen(false) }}
        >
          <div
            style={{ width: '100%', maxWidth: 320, background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '32px 24px 16px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <TriangleAlertIcon size={24} style={{ color: '#FF3B30' }}/>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'rgba(28,28,30,1)', marginBottom: 8 }}>
                {playerName ?? 'このプレイヤー'}の履歴を全て削除しますか？
              </p>
              <p style={{ fontSize: 13, color: 'var(--label2)', lineHeight: 1.5, margin: 0 }}>
                チップ履歴（{history.length}件）と所持チップ・純増値が全て0になります。<br/>この操作は取り消せません。
              </p>
              {wipeError && (
                <p style={{ fontSize: 12, fontWeight: 600, color: '#FF3B30', marginTop: 8 }}>{wipeError}</p>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 24px' }}>
              <button
                onClick={() => setWipeConfirmOpen(false)}
                disabled={wiping}
                style={{ height: 48, borderRadius: 12, border: 'none', background: 'rgba(120,120,128,0.12)', color: 'rgba(28,28,30,1)', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: wiping ? 0.6 : 1 }}
              >Cancel</button>
              <button
                onClick={wipeHistoryAndBalance}
                disabled={wiping}
                style={{ height: 48, borderRadius: 12, border: 'none', background: '#FF3B30', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,59,48,0.3)', opacity: wiping ? 0.6 : 1 }}
              >{wiping ? '削除中...' : '完全に削除する'}</button>
            </div>
          </div>
        </div>
      )}
    </AppleSheet>
  )
}
