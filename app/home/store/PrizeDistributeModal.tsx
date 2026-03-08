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

  const [rows, setRows] = useState<Row[]>([
    { rank: 1, playerId: "", amount: "" },
    { rank: 2, playerId: "", amount: "" },
    { rank: 3, playerId: "", amount: "" },
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
        

        const ids = entriesSnap.docs.map(d => d.id)

        const list: Participant[] = []
        for (const uid of ids) {
          const uSnap = await getDoc(doc(db, "users", uid))
          if (!uSnap.exists()) continue
          const ud: any = uSnap.data()
          list.push({ id: uid, name: ud.name, iconUrl: ud.iconUrl })
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
    setRows(prev => [...prev, { rank: prev.length + 1, playerId: "", amount: "" }])
  }

  const validate = (): string | null => {
    // マイナス禁止 & 数値チェック
    for (const r of rows) {
      if (r.amount === "") continue
      const n = Number(r.amount)
      if (!Number.isFinite(n)) return "金額が数値ではありません"
      if (n < 0) return "金額にマイナスは入力できません"
    }
    // 重複選択禁止（空は除外）
    const chosen = rows.map(r => r.playerId).filter(Boolean)
    const set = new Set(chosen)
    if (set.size !== chosen.length) return "同じプレイヤーを複数行で選択できません"
    return null
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

      const entriesMap: Record<string, any> = {}
        entriesSnap.forEach(d => {
        entriesMap[d.id] = d.data()
      })

 

      // tournamentHistory 保存
      for (const d of entriesSnap.docs) {
  const userId = d.id
  const entry = d.data()

  const entryCount = entry.entryCount ?? 0
  const reentryCount = entry.reentryCount ?? 0
  const addonCount = entry.addonCount ?? 0

  let cost = 0

  if (entryFee > 0) {
    cost += entryCount * entryFee
  } else if (reentryFee > 0) {
    cost += entryCount * reentryFee
  } else {
    cost += entryCount * addonFee
  }

  cost += reentryCount * reentryFee
  cost += addonCount * addonFee

  const payout = payouts.find(p => p.playerId === userId)

  const reward = payout ? payout.amount : 0
  const rank = payout ? payout.rank : null
  const inTheMoney = reward > 0

  const historyRef = doc(db, "users", userId, "tournamentHistory", tournamentId)

  await setDoc(historyRef, {
    storeId: storeId,
    tournamentId: tournamentId,
    entryCount,
    reentryCount,
    addonCount,
    cost,
    reward,
    rank,
    inTheMoney,
    createdAt: serverTimestamp()
  })
}


      for (const p of payouts) {
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

      // 2) トナメを finished にして履歴保存（doc直下配列）
      const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)
      await updateDoc(tournamentRef, {
        status: "finished",
        finishedAt: serverTimestamp(),
        payouts: payouts, // 履歴
        totalPrize: totalPrize, // 閲覧用（任意だが便利）
      })

      onClose()
    } catch (e) {
      console.error(e)
      setError("終了処理に失敗しました")
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/20 backdrop-blur-[1px] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 animate-fadeIn">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[16px] font-semibold text-gray-900">Prize / Finish</h2>
          <button type="button" onClick={onClose} className="text-gray-500 text-[22px] p-1 hover:bg-gray-100 rounded-full">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : (
          <>
            <div className="mb-3 text-[14px] text-gray-900 font-semibold">
              総プライズ額: {totalPrize.toLocaleString()}
            </div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {rows.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[48px_1fr_120px] gap-2 items-center">
                  <div className="text-[13px] text-gray-700">{r.rank}位</div>
                  <select
                    value={r.playerId}
                    onChange={e => {
                      const v = e.target.value
                      setRows(prev => prev.map((x, i) => i === idx ? { ...x, playerId: v } : x))
                    }}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-2 text-[13px] text-gray-900"
                    disabled={submitting}
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
                      setRows(prev => prev.map((x, i) => i === idx ? { ...x, amount: v } : x))
                    }}
                    placeholder="金額"
                    inputMode="numeric"
                    className="h-10 rounded-xl border border-gray-200 bg-white px-2 text-[13px] text-gray-900"
                    disabled={submitting}
                  />
                </div>
              ))}
            </div>

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
              className="mt-3 w-full rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 text-[13px]"
              disabled={submitting}
            >
              終了する
            </button>

            {confirmOpen && (
              <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/20 px-4">
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-200">
                  <p className="text-[14px] font-semibold text-gray-900 text-center">
                    この操作は取り消せません。終了しますか？
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
