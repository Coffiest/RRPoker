"use client"

import { RingButton } from "@/components/BackButton"
import { useDragToClose } from "@/lib/useDragToClose"
import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, getDocs, writeBatch, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { FiX, FiArrowUp, FiArrowDown, FiTrash2, FiAlertTriangle } from "react-icons/fi"
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
  /** 残高の入れ物(系列店なら balanceGroupId、なければ店舗 ID) */
  storeId: string
  /** 履歴を探す店舗(この店。系列店なら同じグループの店すべて)。省略すると storeId だけ */
  storeIds?: string[]
  playerName?: string
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

export default function PlayerHistoryModal({ playerId, storeId, storeIds, playerName, chipUnit, chipUnitBefore, onClose }: Props) {
  // 下から出る画面を指で下に引いて閉じられるように(見た目は元のまま)
  const sheetDrag = useDragToClose(() => onClose())
  const [history, setHistory] = useState<Transaction[]>([])
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [wipeError, setWipeError] = useState("")
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    if (!playerId || !storeId) return
    // 以前は「並べ替え(orderBy createdAt)」付きで読んでいて、それに要る索引がプロジェクトに無く、
    // 読み込みが失敗して 0 件に見えていた(失敗も画面に出ていなかった。2026-11-10)。
    // 並べ替えはこちらで行い、索引の要らない読み方にする。系列店は同じグループの店の記録も出す
    const ids = Array.from(new Set((storeIds && storeIds.length > 0 ? storeIds : [storeId]).filter(Boolean))).slice(0, 30)
    const q = query(
      collection(db, "transactions"),
      where("playerId", "==", playerId),
      ids.length === 1 ? where("storeId", "==", ids[0]) : where("storeId", "in", ids),
    )
    const toMs = (t: any) => (typeof t?.toMillis === "function" ? t.toMillis() : typeof t?.seconds === "number" ? t.seconds * 1000 : 0)
    const unsub = onSnapshot(q, snap => {
      const list: Transaction[] = []
      snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as Omit<Transaction, "id">) }))
      // 書いた直後は createdAt がまだ無い(サーバーの時刻待ち)ので、一番上に置く
      list.sort((a, b) => (toMs(b.createdAt) || Number.MAX_SAFE_INTEGER) - (toMs(a.createdAt) || Number.MAX_SAFE_INTEGER))
      setHistory(list)
      setLoadError("")
    }, () => setLoadError("履歴を読み込めませんでした"))
    return () => unsub()
  }, [playerId, storeId, (storeIds ?? []).join(",")])

  // 履歴とバンクロールをまとめて削除（個別削除は不可・全削除のみ）。
  // balance/netGainを同時にリセットすることで、チップ増減グラフとの不整合を防ぐ。
  const wipeHistoryAndBalance = async () => {
    setWiping(true)
    setWipeError("")
    try {
      const snap = await getDocs(
        query(collection(db, "transactions"), where("playerId", "==", playerId),
          (storeIds && storeIds.length > 1) ? where("storeId", "in", storeIds.slice(0, 30)) : where("storeId", "==", storeIds?.[0] ?? storeId))
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
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div ref={sheetDrag}
        style={{ width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', borderRadius: '34px 34px 0 0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px rgba(0,0,0,0.06), 0 28px 68px rgba(0,0,0,0.16)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, flexShrink: 0 }}>
          <div style={{ width: 36, height: 5, borderRadius: 999, background: 'rgba(60,60,67,0.20)' }}/>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 16px', borderBottom: '1px solid rgba(60,60,67,0.12)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(28,28,30,1)', margin: 0 }}>チップ履歴</p>
            <p style={{ fontSize: 11, color: 'var(--label3)', margin: '4px 0 0' }}>{history.length}件</p>
            <ChipDisclaimer className="mt-1" />
          </div>
          <RingButton label="閉じる" onClick={onClose} icon={<FiX />} />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(120,120,128,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <FiArrowUp size={20} style={{ color: 'var(--label3)' }}/>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: loadError ? '#C62828' : 'var(--label3)', margin: 0 }}>{loadError || '履歴なし'}</p>
              <p style={{ fontSize: 12, color: 'var(--label3)', margin: 0 }}>{loadError ? '時間をおいて開き直してください' : '取引が記録されると表示されます'}</p>
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
                      ? <FiArrowUp size={15} style={{ color: '#D4910A' }}/>
                      : <FiArrowDown size={15} style={{ color: 'var(--label3)' }}/>
                    }
                  </div>

                  {/* Type + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(28,28,30,1)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatType(item.type, item.comment)}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--label3)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ background: 'rgba(120,120,128,0.08)', borderRadius: 4, padding: '4px 4px', fontWeight: 600 }}>
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
                    {(item.amount ?? 0) === 0 ? '' : isAdd ? '+' : '−'}{fmtChip(item.amount ?? 0, chipUnit, chipUnitBefore)}
                  </p>
                </div>
              )
            })
          )}
        </div>

        {/* Danger zone */}
        <div style={{ padding: '16px 16px 0', borderTop: '1px solid rgba(60,60,67,0.12)', flexShrink: 0 }}>
          <button className="rr-btn is-danger is-block is-sm"
            onClick={() => setWipeConfirmOpen(true)}
          >
            <FiTrash2 size={14} />
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
                <FiAlertTriangle size={24} style={{ color: '#FF3B30' }}/>
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
              <button className="rr-btn is-mute" style={{ minHeight: 48 }}
                onClick={() => setWipeConfirmOpen(false)}
                disabled={wiping}
              >キャンセル</button>
              <button className="rr-btn is-danger-solid" style={{ minHeight: 48 }}
                onClick={wipeHistoryAndBalance}
                disabled={wiping}
              >{wiping ? '削除中...' : '完全に削除する'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
