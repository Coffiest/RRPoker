"use client"

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
import { db } from "@/lib/firebase"


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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])

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
        
        

const list: Participant[] = []

for (const d of entriesSnap.docs) {

  const data = d.data()
  const userId = d.id

  

// 仮プレイヤーは完全除外
if (userId.startsWith("temp_")) continue

const uSnap = await getDoc(doc(db, "users", userId))
const ud: any = uSnap.data()

list.push({
  id: userId,
  name: ud?.name ?? "Unknown",
  iconUrl: ud?.iconUrl,
})




}







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

            // ---- RR Leaderboard 更新用の値計算 ----

              const buyin =
                entryCount * entryFeeValue +
                reentryCount * reentryFeeValue +
                addonCount * addonFeeValue

              let costValue = 0
              let baseFee = 0

              if (entryFeeValue > 0) {
                costValue = buyin / entryFeeValue
                baseFee = entryFeeValue
              } else if (reentryFeeValue > 0) {
                costValue = buyin / reentryFeeValue
                baseFee = reentryFeeValue
              } else {
                costValue = buyin / addonFeeValue
                baseFee = addonFeeValue
              }

              const rewardValue =
                baseFee > 0 ? reward / baseFee : 0

              const playsValue =
                entryCount + reentryCount

                const rrRef = doc(db, "rrLeaderboard", userId)


        await setDoc(
  rrRef,
  {
    userId: userId,
    storeId: storeId,
    totalCost: increment(costValue),
    totalReward: increment(rewardValue),
    plays: increment(playsValue)
  },
  { merge: true }
)

                
                const updatedSnap = await getDoc(rrRef)
                const updated = updatedSnap.data()

                const totalCost = updated?.totalCost ?? 0
                const totalReward = updated?.totalReward ?? 0
                const totalPlays = updated?.plays ?? 0

                let roi = 0

                if (totalCost > 0) {
                  roi = (totalReward / totalCost) * 100
                }

                await updateDoc(rrRef,{
                  roi: roi,
                  rrRating: 0
                })


          }


for (const p of payouts) {

  // 🔴 仮プレイヤーはスキップ
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
      })

      // ===== RR Rating 再計算 =====

const rrSnap = await getDocs(collection(db, "rrLeaderboard"))

const players: any[] = []

rrSnap.forEach(docSnap => {
  const d = docSnap.data()

  if ((d.totalCost ?? 0) > 0) {
    const roi = d.totalCost > 0 ? d.totalReward / d.totalCost : 0

    players.push({
      userId: d.userId,
      totalCost: d.totalCost,
      totalReward: d.totalReward,
      plays: d.plays ?? 0,
      roi: roi,
    })
  }
})

// μ（平均ROI）
const mu =
  players.length > 0
    ? players.reduce((a, b) => a + b.roi, 0) / players.length
    : 0

// adjustedROI
const k = 20

players.forEach(p => {
  const n = p.plays

  p.adjustedROI =
    (n / (n + k)) * p.roi +
    (k / (n + k)) * mu
})

// σ（標準偏差）
const sigma = Math.sqrt(
  players.reduce((sum, p) => sum + Math.pow(p.adjustedROI - mu, 2), 0) /
    (players.length || 1)
)

// rrRating計算＆保存
for (const p of players) {

  if (p.userId.startsWith("temp_")) continue

  let rr = 50

  if (sigma !== 0) {
    rr = 50 + 10 * ((p.adjustedROI - mu) / sigma)
  }

  const rounded = Number(rr.toFixed(2))

  const rrRef = doc(db, "rrLeaderboard", p.userId)

  await updateDoc(rrRef, {
    roi: p.roi,
    rrRating: rounded,
  })

  if (!p.userId.startsWith("temp_")) {
  const userRef = doc(db, "users", p.userId)

  await updateDoc(userRef, {
    rrRating: rounded,
  })

  // トーナメント履歴にもrr偏差値を保存（吹き出し表示用）
  const histRef = doc(db, "users", p.userId, "tournamentHistory", tournamentId)
  await updateDoc(histRef, { rrRating: rounded }).catch(() => {})
}
}

// ===== RR Rating 再計算 END =====

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
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* ドラッグハンドル */}
        <div style={{ width: 36, height: 4, borderRadius: 99, background: '#D1D1D6', margin: '12px auto 0', flexShrink: 0 }} />

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 14px', flexShrink: 0, borderBottom: '1px solid #F2F2F7' }}>
          <button
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: '50%', background: '#F2F2F7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#3C3C43', lineHeight: 1 }}
          >×</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Pay Out</span>
          <button
            onClick={async () => { await saveDraft(); onClose() }}
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#34C759,#2DAD4D)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(52,199,89,0.35)', fontSize: 18, color: '#fff', lineHeight: 1 }}
          >✓</button>
        </div>

        {/* スクロール可能ボディ */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 16px 8px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#8E8E93', padding: '48px 0', fontSize: 14 }}>読み込み中…</p>
          ) : (
            <>
              {/* Prize Pool カード */}
              <div style={{ background: 'linear-gradient(135deg,#FFFBF0,#FFF3CC)', border: '1px solid rgba(242,169,0,0.22)', borderRadius: 18, padding: '14px 18px', marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D4910A', marginBottom: 4 }}>Prize Pool</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.5px', lineHeight: 1 }}>{fmtChip(totalPrize, chipUnit, chipUnitBefore)}</p>
              </div>

              {/* 順位行 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {rows.map((r, idx) => (
                  <div key={idx} style={{ background: '#F2F2F7', borderRadius: 16, padding: '12px 14px' }}>
                    {/* 順位バッジ + プレイヤー選択 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: r.rank <= 3 ? MEDAL[r.rank] : '#D1D1D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: r.rank <= 3 ? '0 2px 6px rgba(0,0,0,0.18)' : 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{r.rank}</span>
                      </div>
                      <select
                        value={r.playerId}
                        onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, playerId: e.target.value } : x))}
                        style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: '#fff', padding: '0 10px', fontSize: 14, color: '#1C1C1E', outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer' }}
                      >
                        <option value="">プレイヤーを選択</option>
                        {participants.map(p => <option key={p.id} value={p.id}>{p.name ?? p.id}</option>)}
                      </select>
                    </div>
                    {/* 金額 + テキストトグル */}
                    <div style={{ display: 'flex', gap: 8, paddingLeft: 40 }}>
                      <input
                        value={r.amount}
                        onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                        placeholder="金額"
                        inputMode="numeric"
                        style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: '#fff', padding: '0 12px', fontSize: 14, color: '#1C1C1E', outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                      />
                      <button
                        onClick={() => setRows(prev => prev.map((x, i) => i === idx ? { ...x, showText: !x.showText } : x))}
                        style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: r.showText ? 'rgba(242,169,0,0.15)' : '#fff', color: r.showText ? '#D4910A' : '#8E8E93', fontSize: 20, fontWeight: 700, cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >＋</button>
                    </div>
                    {/* 景品テキスト */}
                    {r.showText && (
                      <div style={{ paddingLeft: 40, marginTop: 8 }}>
                        <input
                          value={r.text}
                          onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                          placeholder="景品・メモ"
                          style={{ width: '100%', height: 36, borderRadius: 10, border: '1.5px solid rgba(242,169,0,0.3)', background: '#fff', padding: '0 12px', fontSize: 13, color: '#1C1C1E', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 追加ボタン */}
              <button
                type="button"
                onClick={addRow}
                disabled={submitting}
                style={{ width: '100%', height: 42, borderRadius: 12, border: '1.5px dashed #C7C7CC', background: 'transparent', color: '#8E8E93', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 12 }}
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
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}>⚠️</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>プライズを配布しますか？</p>
              <p style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>この操作は取り消せません</p>
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
