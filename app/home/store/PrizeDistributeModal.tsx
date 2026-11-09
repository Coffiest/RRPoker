"use client"

import { TriangleAlert } from 'lucide-react'
import PlayerAvatar from "@/components/PlayerAvatar"
import Loader from "@/components/Loader"
import { useDragToClose } from "@/lib/useDragToClose"
import { useEffect, useMemo, useState } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import ChipDisclaimer from "@/components/ChipDisclaimer"


type Props = {
  tournamentId: string
  storeId: string | null
  balanceGroupId?: string
  chipUnit?: string
  chipUnitBefore?: boolean
  onClose: () => void
}

type Participant = {
  id: string
  name?: string
  iconUrl?: string
}

type Row = {
  rank: number
  playerId: string
  amount: string
  text: string
  showText: boolean
}

function fmtChip(amount: number, unit?: string, before?: boolean): string {
  if (!unit) return amount.toLocaleString()
  return before ? `${unit}${amount.toLocaleString()}` : `${amount.toLocaleString()}${unit}`
}

export default function PrizeDistributeModal({ tournamentId, storeId, balanceGroupId, chipUnit, chipUnitBefore, onClose }: Props) {
  // 下から出る画面を指で下に引いて閉じられるように(見た目は元のまま)
  const sheetDrag = useDragToClose(() => void (async () => { await saveDraft(); onClose() })())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])
  // 入賞者を選ぶ欄を開いている行(1 つだけ)
  const [pickerRow, setPickerRow] = useState<number | null>(null)

  const [entryFee, setEntryFee] = useState(0)
  const [reentryFee, setReentryFee] = useState(0)
  const [addonFee, setAddonFee] = useState(0)
  const [totalEntry, setTotalEntry] = useState(0)
  const [totalReentry, setTotalReentry] = useState(0)
  const [totalAddon, setTotalAddon] = useState(0)
  const [status, setStatus] = useState<string>("active")
  const [comment, setComment] = useState("")

  const [rows, setRows] = useState<Row[]>([
  { rank: 1, playerId: "", amount: "", text: "", showText: false },
  { rank: 2, playerId: "", amount: "", text: "", showText: false },
  { rank: 3, playerId: "", amount: "", text: "", showText: false },
])

  const totalPrize = useMemo(() => {
    return (entryFee * totalEntry) + (reentryFee * totalReentry) + (addonFee * totalAddon)
  }, [entryFee, reentryFee, addonFee, totalEntry, totalReentry, totalAddon])

  useEffect(() => {
    const run = async () => {
      if (!storeId || !tournamentId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError("")
      try {
        const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)
        const tSnap = await getDoc(tournamentRef)
        if (tSnap.exists()) {
           const d: any = tSnap.data()
            setComment(d.comment ?? "")

          if (d.prizePool) {

const restoredRows = Object.entries(d.prizePool)
  .map(([rank, val]: any) => {
    if (typeof val === "number") {
      return {
        rank: Number(rank),
        playerId: "",
        amount: String(val),
        text: "",
        showText: false
      }
    } else {
      return {
        rank: Number(rank),
        playerId: val.playerId ?? "",   // ← 保存した playerId を復元
        amount: String(val.amount ?? ""),
        text: val.text ?? "",
        showText: Boolean(val.text)
      }
    }
  })
  .sort((a, b) => a.rank - b.rank)

const base = [1, 2, 3].map(rank => {
  const found = restoredRows.find(r => r.rank === rank)
  return found ?? {
    rank,
    playerId: "",
    amount: "",
    text: "",
    showText: false
  }
})

const extra = restoredRows.filter(r => r.rank > 3)

setRows([...base, ...extra])

}


          setEntryFee(Number(d.entryFee ?? 0))
          setReentryFee(Number(d.reentryFee ?? 0))
          setAddonFee(Number(d.addonFee ?? 0))
          setTotalEntry(Number(d.totalEntry ?? 0))
          setTotalReentry(Number(d.totalReentry ?? 0))
          setTotalAddon(Number(d.totalAddon ?? 0))
          setStatus(String(d.status ?? "active"))
        }

        // 参加者（entries に doc がある userId）
        const entriesRef = collection(db, "stores", storeId, "tournaments", tournamentId, "entries")
        const entriesSnap = await getDocs(entriesRef)

        
  
        const tournamentSnap = await getDoc(tournamentRef)
        const tournamentData: any = tournamentSnap.data()

        const tournamentName = tournamentData?.name ?? ""
        const startedAt = tournamentData?.startedAt ?? null

        const entryFeeValue = Number(tournamentData?.entryFee ?? 0)
        const reentryFeeValue = Number(tournamentData?.reentryFee ?? 0)
        const addonFeeValue = Number(tournamentData?.addonFee ?? 0)

        const storeRef = doc(db, "stores", storeId)
        const storeSnap = await getDoc(storeRef)
        const storeData: any = storeSnap.data()

        const storeName = storeData?.name ?? ""
        
        

// 入賞者の候補は、この大会でエントリーかリエントリーを 1 回以上した人だけ(2026-11-09)。仮プレイヤーは除く。
// 名前は同時に読む(以前は 1 人ずつ順番に読んでいた)
const targets = entriesSnap.docs.filter(d => {
  const e = d.data()
  return !d.id.startsWith("temp_") && ((e.entryCount ?? 0) + (e.reentryCount ?? 0)) > 0
})
const users = await Promise.all(targets.map(d => getDoc(doc(db, "users", d.id)).catch(() => null)))
const list: Participant[] = targets.map((d, i) => {
  const ud: any = users[i]?.data()
  return { id: d.id, name: ud?.name || d.data().name || "名前なし", iconUrl: ud?.iconUrl }
}).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ja"))

setParticipants(list)




      } catch (e) {
        setError("初期読み込みに失敗しました")
      }
      setLoading(false)
    }
    run()
  }, [storeId, tournamentId])

  const addRow = () => {
  setRows(prev => [...prev, {
    rank: prev.length + 1,
    playerId: "",
    amount: "",
    text: "",
    showText: false
  }])
}

  const validate = (): string | null => {
    // マイナス禁止 & 数値チェック
    for (const r of rows) {
      if (r.amount === "") continue
      const n = Number(r.amount)
      if (!Number.isFinite(n)) return "入力が数値ではありません"
      if (n < 0) return "マイナスは入力できません"
    }
    // 重複選択禁止（空は除外）
    const chosen = rows.map(r => r.playerId).filter(Boolean)
    const set = new Set(chosen)
    if (set.size !== chosen.length) return "同じプレイヤーを複数行で選択できません"
    return null
  }

  async function saveDraft(){
  if (!storeId || !tournamentId) return

  const v = validate()
  if (v) {
    setError(v)
    return
  }

  const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)

  const prizePool: Record<string, any> = {}

rows.forEach(r => {
  // playerId が選択されている場合も保存対象にする（下書き保存でプレイヤー情報を保持）
  if (r.amount !== "" || r.text !== "" || r.playerId !== "") {
    prizePool[String(r.rank)] = {
      amount: r.amount === "" ? 0 : Number(r.amount),
      text: r.text ?? "",
      playerId: r.playerId   // ← playerId を DB に保存
    }
  }
})

  try {

await updateDoc(tournamentRef, {
  prizePool: prizePool,
  comment: comment
})



  } catch (e) {
    console.error(e)
    setError("下書き保存に失敗しました")
  }
}

  const submitFinish = async () => {
    if (!storeId || !tournamentId) return
    if (status === "finished") {
      setError("終了したトナメは編集できません")
      return
    }
    const v = validate()
    if (v) {
      setError(v)
      return
    }

    // --- ここから置換 ---
    const pMap: Record<string, string | undefined> = {}
    participants.forEach(p => { pMap[p.id] = p.name })

    const payouts = rows
      .map(r => ({
        rank: r.rank,
        playerId: r.playerId,
        playerName: r.playerId ? (pMap[r.playerId] ?? null) : null,
        amount: r.amount === "" ? 0 : Number(r.amount),
      }))
      .filter(x => x.playerId && x.amount > 0)
    // --- ここまで置換 ---

    setSubmitting(true)
    setError("")
    try {

      const entriesRef = collection(db, "stores", storeId, "tournaments", tournamentId, "entries")
      const entriesSnap = await getDocs(entriesRef)

      const tournamentRef = doc(db,"stores",storeId,"tournaments",tournamentId)
      const tournamentSnap = await getDoc(tournamentRef)
      const tournamentData:any = tournamentSnap.data()

      const tournamentName = tournamentData?.name ?? ""
      const startedAt = tournamentData?.startedAt ?? null

      const entryFeeValue = Number(tournamentData?.entryFee ?? 0)
      const reentryFeeValue = Number(tournamentData?.reentryFee ?? 0)
      const addonFeeValue = Number(tournamentData?.addonFee ?? 0)

      const storeRef = doc(db,"stores",storeId)
      const storeSnap = await getDoc(storeRef)
      const storeData:any = storeSnap.data()

      const storeName = storeData?.name ?? ""

   
 

      // tournamentHistory 保存
      for (const d of entriesSnap.docs) {
            const userId = d.id
            const entry = d.data()
            if (userId.startsWith("temp_")) continue

            const entryCount = entry.entryCount ?? 0
            const reentryCount = entry.reentryCount ?? 0
            const addonCount = entry.addonCount ?? 0

            if (entryCount + reentryCount + addonCount === 0) {
  continue
}

    


            const payout = payouts.find(p => p.playerId === userId)

            const reward = payout ? payout.amount : 0
            const rank = payout ? payout.rank : "-"
            const inTheMoney = reward > 0

            const historyRef = doc(db, "users", userId, "tournamentHistory", tournamentId)

          

            await setDoc(historyRef, {

              tournamentId: tournamentId,

              storeId: storeId,
              storeName: storeName,

              tournamentName: tournamentName,

         
             startedAt: startedAt,

              entryCount: entryCount,
              reentryCount: reentryCount,
              addonCount: addonCount,

              entryFee: entryFeeValue,
              reentryFee: reentryFeeValue,
              addonFee: addonFeeValue,

              prize: reward,
              rank: rank

            })

          }


for (const p of payouts) {

  // 仮プレイヤーはスキップ
  if (p.playerId.startsWith("temp_")) continue

  const balRef = doc(db, "users", p.playerId, "storeBalances", balanceGroupId ?? storeId!)

  await setDoc(
    balRef,
    {
      storeId,
      balance: increment(p.amount),
      netGain: increment(p.amount),
    },
    { merge: true }
  )
}

for (const p of payouts) {

  if (p.playerId.startsWith("temp_")) continue

  await setDoc(doc(collection(db, "transactions")), {
    storeId,
    playerId: p.playerId,
    playerName: p.playerName ?? null,
    amount: p.amount,
    direction: "add",
    type: "tournament_payout",
    tournamentId: tournamentId,
    createdAt: serverTimestamp(),
  })
}

      // 2) トナメを finished にして履歴保存（doc直下配列）

      await updateDoc(tournamentRef, {
        status: "finished",
        finishedAt: serverTimestamp(),
        payouts: payouts, // 履歴
        totalPrize: totalPrize, // 閲覧用（任意だが便利）
        rrPending: true, // RR Rating への足し込み待ち(サーバーが処理して false にする)
      })

      // ===== RR Rating 再計算(サーバー) =====
      // 成績の足し込みと全員の偏差値の計算は、サーバーがまとめて行う。
      // 失敗しても大会の終了自体は済んでいる。rrPending が立ったまま残るので、
      // 同じ大会であとから呼び直せば足し込まれる。
      try {
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch("/api/rr-rating/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
          body: JSON.stringify({ storeId, tournamentId }),
        })
        if (!res.ok) console.error("RR Rating の更新に失敗しました", res.status)
      } catch (e) {
        console.error("RR Rating の更新に失敗しました", e)
      }

      onClose()
    } catch (e) {
      console.error(e)
      setError("終了処理に失敗しました")
    }
    setSubmitting(false)
  }

  const MEDAL: Record<number, string> = {
    1: 'linear-gradient(135deg,#FFD700,#E8A000)',
    2: 'linear-gradient(135deg,#D4D4D4,#A8A8A8)',
    3: 'linear-gradient(135deg,#CD7F32,#9A5E24)',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
    >
      <div ref={sheetDrag} style={{ width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', borderRadius: '34px 34px 0 0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px rgba(0,0,0,0.06), 0 28px 68px rgba(0,0,0,0.16)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>

        {/* ドラッグハンドル */}
        <div className="a-grabber" />

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 8px', flexShrink: 0, borderBottom: '1px solid #F2F2F7' }}>
          <button
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(255,255,255,0.6)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#3C3C43', lineHeight: 1 }}
          >×</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Pay Out</span>
          <button
            onClick={async () => { await saveDraft(); onClose() }}
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#34C759,#2DAD4D)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(52,199,89,0.35)', fontSize: 18, color: '#fff', lineHeight: 1 }}
          >✓</button>
        </div>

        {/* スクロール可能ボディ */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 8px 8px' }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Loader /></div>
          ) : (
            <>
              {/* Prize Pool カード */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, background: 'linear-gradient(135deg,#FFFBF0,#FFF3CC)', border: '1px solid rgba(242,169,0,0.22)', borderRadius: 12, padding: '8px 12px', marginBottom: 8 }}>
                <p className="tech-label" style={{ fontSize: 10, color: '#D4910A' }}>Prize Pool</p>
                <p className="tech-num" style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.5px', lineHeight: 1 }}>{fmtChip(totalPrize, chipUnit, chipUnitBefore)}</p>
              </div>

              {/* 順位行(1 行に順位・入賞者・金額・景品の切り替え。2026-11-09) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {rows.map((r, idx) => (
                  <div key={idx} style={{ background: '#F2F2F7', borderRadius: 12, padding: '6px 6px 6px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: r.rank <= 3 ? MEDAL[r.rank] : '#6E6E73', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{r.rank}</span>
                      </div>
                      <PlayerPicker
                        participants={participants}
                        value={r.playerId}
                        taken={rows.filter((_, i) => i !== idx).map(x => x.playerId).filter(Boolean)}
                        open={pickerRow === idx}
                        onOpen={() => setPickerRow(pickerRow === idx ? null : idx)}
                        onPick={id => { setRows(prev => prev.map((x, i) => i === idx ? { ...x, playerId: id } : x)); setPickerRow(null) }}
                      />
                      <input
                        value={r.amount}
                        onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                        placeholder="金額" inputMode="numeric" aria-label={`${r.rank}位の金額`}
                        style={{ width: 92, height: 36, padding: '0 10px', fontSize: 14, color: '#1C1C1E', boxSizing: 'border-box', flexShrink: 0 }}
                      />
                      <button
                        onClick={() => setRows(prev => prev.map((x, i) => i === idx ? { ...x, showText: !x.showText } : x))}
                        aria-label="景品・メモを書く" aria-pressed={r.showText}
                        style={{ width: 32, height: 36, borderRadius: 10, border: 'none', background: r.showText ? 'rgba(242,169,0,0.15)' : '#fff', color: r.showText ? '#D4910A' : 'var(--label3)', fontSize: 18, fontWeight: 700, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >＋</button>
                    </div>
                    {pickerRow === idx && (
                      <PlayerPickerList participants={participants} taken={rows.filter((_, i) => i !== idx).map(x => x.playerId).filter(Boolean)} value={r.playerId}
                        onPick={id => { setRows(prev => prev.map((x, i) => i === idx ? { ...x, playerId: id } : x)); setPickerRow(null) }} />
                    )}
                    {r.showText && (
                      <input
                        value={r.text}
                        onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                        placeholder="景品・メモ"
                        style={{ width: '100%', height: 34, marginTop: 6, padding: '0 12px', fontSize: 13, color: '#1C1C1E', boxSizing: 'border-box' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* 追加ボタン */}
              <button
                type="button"
                onClick={addRow}
                disabled={submitting}
                style={{ width: '100%', height: 40, borderRadius: 12, border: '1.5px dashed rgba(60,60,67,0.25)', background: 'transparent', color: 'var(--label2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
              >＋ 入賞者を追加</button>

              {/* コメント */}
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="コメント（タイマー画面に表示）"
                rows={2}
                style={{ width: '100%', borderRadius: 14, border: '1.5px solid #E5E5EA', background: '#F2F2F7', padding: '12px 14px', fontSize: 14, color: '#1C1C1E', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 4 }}
              />

              {error && <p style={{ color: '#FF3B30', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</p>}
            </>
          )}
        </div>

        {/* フッター: Pay Out ボタン */}
        <div style={{ padding: '12px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))', borderTop: '1px solid #F2F2F7', flexShrink: 0 }}>
          <ChipDisclaimer className="pb-2" />
          <button
            type="button"
            onClick={() => { const v = validate(); if (v) { setError(v); return } setConfirmOpen(true) }}
            disabled={submitting}
            style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#1C1C1E', fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', boxShadow: '0 4px 16px rgba(242,169,0,0.35)', opacity: submitting ? 0.6 : 1 }}
          >Pay Out</button>
        </div>
      </div>

      {/* 確認ダイアログ */}
      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '0 24px' }}>
          <div style={{ width: '100%', maxWidth: 320, background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '28px 20px 16px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}><TriangleAlert size={26} strokeWidth={2} color="#C62828" aria-hidden /></div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>プライズを配布しますか？</p>
              <p style={{ fontSize: 13, color: 'var(--label3)', lineHeight: 1.6 }}>この操作は取り消せません</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px 20px' }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                style={{ height: 48, borderRadius: 12, border: 'none', background: '#F2F2F7', color: '#1C1C1E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >キャンセル</button>
              <button
                type="button"
                onClick={async () => { setConfirmOpen(false); await submitFinish() }}
                disabled={submitting}
                style={{ height: 48, borderRadius: 12, border: 'none', background: '#4A1010', color: '#fff', fontSize: 15, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
              >{submitting ? '実行中…' : '実行'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 入賞者の欄(押すと下に検索付きの一覧が開く。別の画面は重ねない) */
function PlayerPicker({ participants, value, open, onOpen }: {
  participants: Participant[]; value: string; taken: string[]; open: boolean; onOpen: () => void; onPick: (id: string) => void
}) {
  const sel = participants.find(p => p.id === value)
  return (
    <button type="button" onClick={onOpen} aria-expanded={open}
      style={{ flex: 1, minWidth: 0, height: 36, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderRadius: 10, border: 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      {sel && <PlayerAvatar src={sel.iconUrl} size={20} />}
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? '#1C1C1E' : 'var(--label2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sel ? sel.name : value ? '(対象外のプレイヤー)' : 'プレイヤーを選択'}
      </span>
      <span aria-hidden style={{ fontSize: 10, color: 'var(--label2)' }}>{open ? '▲' : '▼'}</span>
    </button>
  )
}

function PlayerPickerList({ participants, taken, value, onPick }: {
  participants: Participant[]; taken: string[]; value: string; onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const kw = q.trim().toLowerCase()
  const list = participants.filter(p => !kw || (p.name ?? '').toLowerCase().includes(kw))
  return (
    <div style={{ marginTop: 6, background: '#fff', borderRadius: 10, padding: 6 }}>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="プレイヤー検索"
        style={{ width: '100%', height: 34, padding: '0 12px', fontSize: 13, color: '#1C1C1E', boxSizing: 'border-box', marginBottom: 6 }} />
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {value && (
          <button type="button" onClick={() => onPick('')}
            style={{ width: '100%', minHeight: 36, padding: '0 8px', border: 'none', background: 'none', textAlign: 'left', fontSize: 12, color: '#C62828', cursor: 'pointer', fontFamily: 'inherit' }}>選択を外す</button>
        )}
        {list.length === 0 && <p style={{ fontSize: 12, color: 'var(--label2)', padding: '8px' }}>エントリーしたプレイヤーが見つかりません</p>}
        {list.map(p => {
          const used = taken.includes(p.id)
          return (
            <button key={p.id} type="button" disabled={used} onClick={() => onPick(p.id)}
              style={{ width: '100%', minHeight: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', border: 'none', borderRadius: 8, background: p.id === value ? 'rgba(242,169,0,0.12)' : 'none', textAlign: 'left', cursor: used ? 'default' : 'pointer', fontFamily: 'inherit', opacity: used ? 0.45 : 1 }}>
              <PlayerAvatar src={p.iconUrl} size={22} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              {used && <span style={{ fontSize: 10, color: 'var(--label2)' }}>選択済み</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
