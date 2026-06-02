"use client"

import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { FiX, FiArrowUp, FiArrowDown } from "react-icons/fi"

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
  chipUnit?: string
  chipUnitBefore?: boolean
  onClose: () => void
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
    case "manual_adjustment_net_gain": return "手動調整"
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

export default function PlayerHistoryModal({ playerId, storeId, chipUnit, chipUnitBefore, onClose }: Props) {
  const [history, setHistory] = useState<Transaction[]>([])

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

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(60,60,67,0.12)' }}/>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px', borderBottom: '1px solid rgba(60,60,67,0.12)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(28,28,30,1)', margin: 0 }}>チップ履歴</p>
            <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.5)', margin: '2px 0 0' }}>{history.length}件</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(120,120,128,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <FiX size={14} style={{ color: 'rgba(60,60,67,0.5)' }}/>
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(120,120,128,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <FiArrowUp size={20} style={{ color: 'rgba(60,60,67,0.25)' }}/>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(60,60,67,0.4)', margin: 0 }}>履歴なし</p>
              <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.3)', margin: 0 }}>取引が記録されると表示されます</p>
            </div>
          ) : (
            history.map((item, idx) => {
              const isAdd = item.direction === "add"
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', padding: '12px 18px',
                  borderBottom: idx < history.length - 1 ? '1px solid rgba(60,60,67,0.08)' : 'none',
                }}>
                  {/* Direction icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 11, flexShrink: 0, marginRight: 12,
                    background: isAdd ? 'rgba(242,169,0,0.1)' : 'rgba(120,120,128,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isAdd
                      ? <FiArrowUp size={15} style={{ color: '#D4910A' }}/>
                      : <FiArrowDown size={15} style={{ color: 'rgba(60,60,67,0.4)' }}/>
                    }
                  </div>

                  {/* Type + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(28,28,30,1)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatType(item.type, item.comment)}
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(60,60,67,0.4)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ background: 'rgba(120,120,128,0.08)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                        {formatSubtype(item.type)}
                      </span>
                      <span>{formatDate(item.createdAt)}</span>
                    </p>
                  </div>

                  {/* Amount */}
                  <p style={{
                    fontSize: 14, fontWeight: 800, flexShrink: 0, marginLeft: 8,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px',
                    color: isAdd ? '#D4910A' : 'rgba(60,60,67,0.55)',
                  }}>
                    {isAdd ? '+' : '−'}{fmtChip(item.amount ?? 0, chipUnit, chipUnitBefore)}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
