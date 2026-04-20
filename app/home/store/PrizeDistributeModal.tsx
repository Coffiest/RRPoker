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

export default function PrizeDistributeModal({ tournamentId, storeId, onClose }: Props) {
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
        playerId: "",
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

setRows(base)

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

  

  // 仮プレイヤー
  if (userId.startsWith("temp_")) {
    list.push({
      id: userId,
      name: data.name ?? "TEMP",
    })
  } else {
    const uSnap = await getDoc(doc(db, "users", userId))
    const ud: any = uSnap.data()

    list.push({
      id: userId,
      name: ud?.name ?? "Unknown",
      iconUrl: ud?.iconUrl,
    })
  }
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
  if (r.amount !== "" || r.text !== "") {
    prizePool[String(r.rank)] = {
      amount: r.amount === "" ? 0 : Number(r.amount),
      text: r.text ?? ""
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

  const balRef = doc(db, "users", p.playerId, "storeBalances", storeId)

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

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/20 backdrop-blur-[1px] px-4">
   

<div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_25px_80px_rgba(0,0,0,0.18)] border border-gray-200">

  {/* ヘッダー */}
  <div className="flex items-center justify-between mb-3">

    {/* 左：閉じる */}
    <button
      onClick={onClose}
      className="h-9 w-9 rounded-full border border-gray-300 text-gray-700 flex items-center justify-center text-[16px] hover:bg-gray-100"
    >
      ×
    </button>

    <h2 className="text-[17px] font-bold text-gray-900">
      Pay Out
    </h2>

    {/* 右：保存 */}
    <button
      onClick={async () => {
        await saveDraft()
        onClose()
      }}
      className="h-9 w-9 rounded-full bg-green-500 text-white flex items-center justify-center text-[16px] font-bold hover:bg-green-600"
    >
      ✓
    </button>

  </div>

        {loading ? (
          <p className="text-gray-500 text-center">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : (
          <>
            <div className="mb-3 text-[14px] text-gray-900 font-semibold">
         
              <div className="mb-3 text-[13px] text-gray-500">
  総プライズ：
</div>
<div className="text-[20px] font-bold text-gray-900">
  {totalPrize.toLocaleString()}
</div>
            </div>


<div className="space-y-2 max-h-[45vh] overflow-y-auto">
  {rows.map((r, idx) => (
    <div key={idx} className="space-y-2 pb-2 border-b border-gray-100">

      {/* 1行目 */}
      <div className="grid grid-cols-[40px_1fr_90px_40px] gap-2 items-center">

        <div className="text-[13px] text-gray-700">{r.rank}位</div>

        <select
          value={r.playerId}
          onChange={e => {
            const v = e.target.value
            setRows(prev => prev.map((x, i) =>
              i === idx ? { ...x, playerId: v } : x
            ))
          }}
          className="h-10 rounded-xl border border-gray-200 px-2 text-[13px] text-gray-900 bg-white"
        >
          <option value="">選択</option>
          {participants.map(p => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.id}
            </option>
          ))}
        </select>

        <input
          value={r.amount}
          onChange={e => {
            const v = e.target.value
            setRows(prev => prev.map((x, i) =>
              i === idx ? { ...x, amount: v } : x
            ))
          }}
          placeholder="金額"
          inputMode="numeric"
          className="h-10 rounded-xl border border-gray-200 px-2 text-[13px] text-gray-900 bg-white"
        />

        {/* ＋ボタン */}
        <button
          onClick={() => {
            setRows(prev => prev.map((x, i) =>
              i === idx ? { ...x, showText: !x.showText } : x
            ))
          }}
          className="h-10 w-10 rounded-xl border border-gray-300 text-gray-900 font-bold bg-white hover:bg-gray-100"
        >
          ＋
        </button>

      </div>

      {/* 2行目（条件付き表示） */}
      {r.showText && (
  <div className="pl-6 border-l-2 border-gray-200">
    <input
      value={r.text}
      onChange={e => {
        const v = e.target.value
        setRows(prev => prev.map((x, i) =>
          i === idx ? { ...x, text: v } : x
        ))
      }}
      placeholder="景品・メモ"
      className="w-full h-10 rounded-xl border border-gray-200 px-3 text-[13px] text-gray-900 bg-white placeholder:text-gray-400"
    />
  </div>
)}

    </div>
  ))}
</div>



<textarea
  value={comment}
  onChange={e => setComment(e.target.value)}
  placeholder="コメント（タイマー画面に表示される）"
  className="w-full h-20 rounded-xl border border-gray-300 px-3 py-2 text-[14px] text-gray-900 bg-white mt-3 placeholder:text-gray-400"
/>



            <button
              type="button"
              onClick={addRow}
              className="mt-3 w-full rounded-xl border border-gray-200 py-2 text-[13px] text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              ＋入賞者追加
            </button>

            


            <button
              type="button"
              onClick={() => {
                const v = validate()
                if (v) { setError(v); return }
                setConfirmOpen(true)
              }}
              className="mt-3 w-full rounded-full bg-[#F2A900] hover:bg-red-700 text-white font-semibold py-2 text-[13px]"
              disabled={submitting}
            >
              Pay Out
            </button>



            

            {confirmOpen && (
              <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/20 px-4">
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-200">
                  <p className="text-[13px] font-semibold text-gray-900 text-center">
                    この操作は取り消せません。プライズを配布しますか？
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 text-[13px] font-semibold"
                      disabled={submitting}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setConfirmOpen(false)
                        await submitFinish()
                      }}
                      className="rounded-xl bg-red-600 hover:bg-red-700 text-white py-2 text-[13px] font-semibold"
                      disabled={submitting}
                    >
                      実行
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
