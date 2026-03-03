"use client"

import { useEffect, useMemo, useState } from "react"
import { getDocs } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import PlayerManageModal from "./PlayerManageModal"
import {
  collection,
  doc,
  deleteField,
  getDoc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import { FiPlus, FiMinus, FiCopy, FiHome, FiUser } from "react-icons/fi"

type StoreInfo = {
  name: string
  iconUrl?: string
  code: string
}

type DepositRequest = {
  id: string
  playerId: string
  amount: number
  comment?: string
}

type PlayerInfo = {
  id: string
  name?: string
  iconUrl?: string
}

export default function StorePage() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace("/")
        return
      }

      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data()
      const userRole = data?.role ?? null

      setRole(userRole)

      if (userRole !== "store") {
        router.replace("/home")
      }
    })

    return () => unsub()
  }, [router])


  const [storeId, setStoreId] = useState<string | null>(null)
  // STEP2: 本日のトナメ
  const [todayTournaments, setTodayTournaments] = useState<any[]>([])
  // 仮モーダル用state（フック順序エラー根本修正: useState群の一番上に移動）
  const [showPlayerModal, setShowPlayerModal] = useState<string|null>(null)

  useEffect(() => {
    if (!storeId) return
    // 今日の日付（yyyy-mm-dd）
    const today = new Date()
    today.setHours(0,0,0,0)
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`

    const tournamentsRef = collection(db, "stores", storeId, "tournaments")
    const q = query(tournamentsRef, where("status", "==", "active"))
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = []
      for (const docSnap of snap.docs) {
        const data = docSnap.data()
        if (typeof data.date !== "string") continue
        if (data.date !== todayStr) continue

        const entry = (data.totalEntry ?? 0) as number
        const reentry = (data.totalReentry ?? 0) as number
        const addon = (data.totalAddon ?? 0) as number
        const bustCount = (data.bustCount ?? 0) as number

        const entryStack = (data.entryStack ?? 0) as number
        const reentryStack = (data.reentryStack ?? 0) as number
        const addonStack = (data.addonStack ?? 0) as number

        const totalEntries = entry + reentry
        const alive = totalEntries - bustCount

        list.push({
          id: docSnap.id,
          name: data.name,
          entry,
          reentry,
          addon,
          bustCount,
          entryStack,
          reentryStack,
          addonStack,
          totalEntries,
          alive,
        })
      }
      setTodayTournaments(list)
    })
    return () => unsub()
  }, [storeId])
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([])
  const [players, setPlayers] = useState<PlayerInfo[]>([])
  const [playerSearchInput, setPlayerSearchInput] = useState("")
  const [selectedPlayerId, setSelectedPlayerId] = useState("")
  const [selectedPlayerBalance, setSelectedPlayerBalance] = useState(0)
  const [selectedPlayerNetGain, setSelectedPlayerNetGain] = useState(0)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustError, setAdjustError] = useState("")
  const [showAdjustmentConfirm, setShowAdjustmentConfirm] = useState(false)
  const [showNetGainConfirm, setShowNetGainConfirm] = useState(false)
  const [pendingAdjustment, setPendingAdjustment] = useState<{ direction: "add" | "subtract"; amount: string } | null>(null)

  // 入店履歴プレイヤーリスト
  const [storePlayers, setStorePlayers] = useState<any[]>([])
  const [storePlayersPage, setStorePlayersPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    if (!storeId) return
    const usersSnapUnsub = onSnapshot(collection(db, "users"), async (usersSnap) => {
      const players: any[] = []
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data()
        const balanceRef = doc(db, "users", userDoc.id, "storeBalances", storeId)
        const balanceSnap = await getDoc(balanceRef)
        if (balanceSnap.exists()) {
          const balanceData = balanceSnap.data()
          players.push({
            id: userDoc.id,
            name: userData.name,
            iconUrl: userData.iconUrl,
            playerId: userData.playerId,
            balance: balanceData.balance ?? 0,
            netGain: balanceData.netGain ?? 0,
            lastVisitedAt: balanceData.lastVisitedAt?.toDate?.() ?? null,
          })
        }
      }
      players.sort((a, b) => {
        const atA = a.lastVisitedAt ? a.lastVisitedAt.getTime() : 0
        const atB = b.lastVisitedAt ? b.lastVisitedAt.getTime() : 0
        return atB - atA
      })
      setStorePlayers(players)
    })
    return () => usersSnapUnsub()
  }, [storeId])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data()
      setStoreId(data?.storeId ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!storeId) return
    const fetchStore = async () => {
      const snap = await getDoc(doc(db, "stores", storeId))
      const data = snap.data() as StoreInfo | undefined
      if (!data) return
      setStore(data)
    }
    fetchStore()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(
      collection(db, "depositRequests"),
      where("storeId", "==", storeId),
      where("status", "==", "pending")
    )
    const unsub = onSnapshot(q, snap => {
      const list: DepositRequest[] = []
      snap.forEach(d => {
        const data = d.data()
        list.push({
          id: d.id,
          playerId: data.playerId,
          amount: data.amount,
          comment: data.comment,
        })
      })
      setDepositRequests(list)
    })
    return () => unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(
      collection(db, "users"),
      where("currentStoreId", "==", storeId)
    )
    const unsub = onSnapshot(q, snap => {
      console.log("=== INSTORE DEBUG START ===")
      console.log("storeId:", storeId)
      console.log("instore snap.size:", snap.size)
      const list: PlayerInfo[] = []
      snap.forEach(d => {
        const data = d.data()
        console.log("instore user:", d.id, {
          currentStoreId: data.currentStoreId,
          name: data.name,
        })
        list.push({
          id: d.id,
          name: data.name,
          iconUrl: data.iconUrl,
        })
      })
      console.log("=== INSTORE DEBUG END ===")
      setPlayers(list)
    })
    return () => unsub()
  }, [storeId])

  const playerMap = useMemo(() => {
    const map: Record<string, PlayerInfo> = {}
    players.forEach(p => (map[p.id] = p))
    return map
  }, [players])

  const filteredPlayers = useMemo(() => {
    const q = playerSearchInput.toLowerCase()
    if (!q) return players
    return players.filter(
      p =>
        (p.name ?? "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    )
  }, [playerSearchInput, players])

  const selectPlayer = async (playerId: string) => {
    setSelectedPlayerId(playerId)
    setPlayerSearchInput("")
    if (!storeId) return
    const snap = await getDoc(
      doc(db, "users", playerId, "storeBalances", storeId)
    )
    if (snap.exists()) {
      setSelectedPlayerBalance(snap.data()?.balance ?? 0)
      setSelectedPlayerNetGain(snap.data()?.netGain ?? 0)
    } else {
      setSelectedPlayerBalance(0)
      setSelectedPlayerNetGain(0)
    }
  }

    const approveDeposit = async (
    request: DepositRequest,
    approveType: "purchase" | "pure_increase"
  ) => {
    if (!storeId) return

    const balanceRef = doc(
      db,
      "users",
      request.playerId,
      "storeBalances",
      storeId
    )
    const balanceSnap = await getDoc(balanceRef)

    if (!balanceSnap.exists()) {
      await setDoc(
        balanceRef,
        {
          balance: request.amount,
          netGain: approveType === "pure_increase" ? request.amount : 0,
          storeId,
        },
        { merge: true }
      )
    } else {
      const updates: Record<string, any> = {
        balance: increment(request.amount),
      }
      if (approveType === "pure_increase") {
        updates.netGain = increment(request.amount)
      }
      await updateDoc(balanceRef, updates)
    }

    await updateDoc(doc(db, "depositRequests", request.id), {
      status: "approved",
      type: approveType,
    })

    await setDoc(doc(collection(db, "transactions")), {
      storeId,
      playerId: request.playerId,
      playerName: playerMap[request.playerId]?.name ?? null,
      amount: request.amount,
      direction: "add",
      type:
        approveType === "purchase"
          ? "deposit_approved_purchase"
          : "deposit_approved_pure_increase",
      createdAt: serverTimestamp(),
    })
  }

  const rejectDeposit = async (request: DepositRequest) => {
    await updateDoc(doc(db, "depositRequests", request.id), {
      status: "rejected",
    })
  }

  const runAdjustment = async (
    direction: "add" | "subtract",
    isNetGain: boolean
  ) => {
    if (!storeId || !selectedPlayerId) {
      setAdjustError("プレイヤーを選択してください")
      return
    }

    const amount = Number(adjustAmount)
    if (!amount || amount < 1) {
      setAdjustError("金額は1以上で入力してください")
      return
    }

    setAdjustError("")

    const balanceRef = doc(
      db,
      "users",
      selectedPlayerId,
      "storeBalances",
      storeId
    )
    const balanceSnap = await getDoc(balanceRef)
    const current = balanceSnap.data()?.balance ?? 0
    const currentNetGain = balanceSnap.data()?.netGain ?? 0

    if (direction === "subtract" && current < amount) {
      setAdjustError("残高が不足しています")
      return
    }

    let newBalance = current
    let newNetGain = currentNetGain

    if (!balanceSnap.exists()) {
      newBalance = direction === "add" ? amount : 0
      newNetGain =
        isNetGain && direction === "add" ? amount : 0

      await setDoc(
        balanceRef,
        {
          balance: newBalance,
          netGain: newNetGain,
          storeId,
        },
        { merge: true }
      )
    } else {
      newBalance =
        direction === "add" ? current + amount : current - amount

      if (isNetGain) {
        newNetGain =
          direction === "add"
            ? currentNetGain + amount
            : currentNetGain - amount
      }

      const updates: Record<string, any> = {
        balance: increment(direction === "add" ? amount : -amount),
      }

      if (isNetGain) {
        updates.netGain = increment(
          direction === "add" ? amount : -amount
        )
      }

      await updateDoc(balanceRef, updates)
    }

    await setDoc(doc(collection(db, "transactions")), {
      storeId,
      playerId: selectedPlayerId,
      playerName: playerMap[selectedPlayerId]?.name ?? null,
      amount,
      direction,
      type: isNetGain
        ? "manual_adjustment_net_gain"
        : "manual_adjustment",
      createdAt: serverTimestamp(),
    })

    setAdjustAmount("")
    setSelectedPlayerBalance(newBalance)
    setSelectedPlayerNetGain(newNetGain)
    if (typeof fetchStorePlayers === "function") {
      await fetchStorePlayers();
    }
  }

  const copyCode = async () => {
    if (!store?.code) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(store.code)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = store.code
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
    } catch {}
  }

  if (role === null) {
    return <div className="p-6">Loading...</div>
  }

  if (role !== "store") {
    return null
  }



  return (
    <main className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-white pb-28">
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />

      <div className="mx-auto max-w-sm px-5">
        {/* Player管理モーダル */}
        {showPlayerModal && (
          <PlayerManageModal
            tournamentId={showPlayerModal}
            storeId={storeId}
            onClose={() => setShowPlayerModal(null)}
          />
        )}
        {/* 店舗名・コードセクション */}
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {store?.iconUrl ? (
              <img
                src={store.iconUrl}
                alt={store?.name}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 text-[12px] text-gray-500">
                店舗
              </div>
            )}
            <div>
              <p className="text-[16px] font-semibold text-gray-900">
                {store?.name ?? ""}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[13px] text-gray-500">
                  店舗コード: {store?.code ?? ""}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="text-gray-500"
                >
                  <FiCopy />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 本日のトナメセクション（店舗名直下・mt-4） */}
        <div className="mt-4">
          <section>
            <h2 className="text-[22px] font-semibold text-gray-900 mt-6">Today's Tournaments</h2>
            {todayTournaments.length === 0 ? (
              <p className="text-gray-500 text-sm">本日のトーナメントはありません</p>
            ) : (
              <div>
                {todayTournaments.map(t => {
                  // 必要なstack値はt.entryStack, t.reentryStack, t.addonStackとして渡されている前提
                  const totalEntry = t.entry ?? 0
                  const totalReentry = t.reentry ?? 0
                  const totalAddon = t.addon ?? 0
                  const bustCount = t.bustCount ?? 0
                  const entryStack = t.entryStack ?? 0
                  const reentryStack = t.reentryStack ?? 0
                  const addonStack = t.addonStack ?? 0
                  const alive = (totalEntry + totalReentry) - bustCount
                  const totalEntries = totalEntry + totalReentry
                  const totalStack = (totalEntry * entryStack) + (totalReentry * reentryStack) + (totalAddon * addonStack)
                  const average = alive > 0 ? Math.floor(totalStack / alive) : 0
                  return (
                    <div
                      key={t.id}
                      className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mt-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[16px] font-semibold text-gray-900">{t.name}</p>
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="text-[14px] text-gray-800">Player : {alive} / {totalEntries}</div>
                          <div className="text-[14px] text-gray-800">add on : {totalAddon}</div>
                          <div className="text-[14px] text-gray-800">Ave : {average.toLocaleString()}</div>
                        </div>
                      </div>
                      <button
                        className="text-[13px] px-3 py-1 rounded-full bg-[#F2A900] text-white font-medium ml-4"
                        onClick={() => setShowPlayerModal(t.id)}
                      >
                        Players
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
                <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-gray-900">
            入金申請一覧
          </p>

          {depositRequests.length === 0 ? (
            <p className="mt-3 text-[13px] text-gray-500">
              申請はありません
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {depositRequests.map(req => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-gray-900">
                        {playerMap[req.playerId]?.name ??
                          req.playerId}
                      </p>
                      <p className="text-[12px] text-gray-500">
                        {req.comment || "コメントなし"}
                      </p>
                    </div>
                    <p className="text-[16px] font-semibold text-gray-900">
                      {req.amount}
                    </p>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        approveDeposit(req, "purchase")
                      }
                      className="flex-1 rounded-2xl bg-green-500 py-2 text-[13px] font-semibold text-white"
                    >
                      承認(購入)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        approveDeposit(
                          req,
                          "pure_increase"
                        )
                      }
                      className="flex-1 rounded-2xl bg-blue-500 py-2 text-[13px] font-semibold text-white"
                    >
                      承認(純増)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        rejectDeposit(req)
                      }
                      className="flex-1 rounded-2xl bg-red-500 py-2 text-[13px] font-semibold text-white"
                    >
                      却下
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-gray-900">
            入店中のプレイヤー
          </p>

          {players.length === 0 ? (
            <p className="mt-3 text-[13px] text-gray-500">
              入店中のプレイヤーはいません
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {players.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-2">
                    {player.iconUrl ? (
                      <img
                        src={player.iconUrl}
                        alt={player.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">
                        P
                      </div>
                    )}
                    <span className="text-[13px] text-gray-900">
                      {player.name || player.id}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await updateDoc(
                        doc(db, "users", player.id),
                        { currentStoreId: deleteField() }
                      )
                    }}
                    className="text-[12px] text-gray-500 hover:text-red-500"
                  >
                    退店
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-gray-900">手動調整</p>
          <div className="mt-3 relative">
            <label className="block mb-1 text-[13px] font-semibold text-gray-900" style={{color:'#111'}}>プレイヤー名で検索</label>
            <input
              type="text"
              value={playerSearchInput}
              onChange={e => setPlayerSearchInput(e.target.value)}
              placeholder="プレイヤー名で検索"
              className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-[14px] text-gray-900"
              style={{color:'#111'}}
            />
            {playerSearchInput && filteredPlayers.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg">
                {filteredPlayers.map(player => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => selectPlayer(player.id)}
                    className="block w-full border-b border-gray-100 px-3 py-2 text-left text-[14px] text-gray-900 hover:bg-gray-50"
                  >
                    {player.name ?? player.id}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedPlayerId && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-[12px] text-gray-600">
              <p>
                残高: <span className="font-semibold text-gray-900">{selectedPlayerBalance}</span>
              </p>
              <p className="mt-1">
                純増: <span className="font-semibold text-gray-900">{selectedPlayerNetGain}</span>
              </p>
            </div>
          )}
          <label className="block mt-4 mb-1 text-[13px] font-semibold text-gray-900" style={{color:'#111'}}>金額</label>
          <input
            type="number"
            min={1}
            value={adjustAmount}
            onChange={e => setAdjustAmount(e.target.value)}
            placeholder="金額"
            className="h-11 w-full rounded-2xl border border-gray-200 px-3 text-[14px] text-gray-900"
            style={{color:'#111'}}
          />
          {adjustError && (
            <p className="mt-2 text-[12px] text-red-500">{adjustError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingAdjustment({ direction: "add", amount: adjustAmount })
                setShowAdjustmentConfirm(true)
              }}
              className="flex-1 rounded-full bg-yellow-500 hover:bg-yellow-600 shadow-md py-2 text-[13px] font-semibold text-white flex items-center justify-center"
              aria-label="加算"
            >
              <FiPlus className="text-[20px]" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingAdjustment({ direction: "subtract", amount: adjustAmount })
                setShowAdjustmentConfirm(true)
              }}
              className="flex-1 rounded-full bg-gray-600 hover:bg-gray-800 shadow-md py-2 text-[13px] font-semibold text-white flex items-center justify-center"
              aria-label="減算"
            >
              <FiMinus className="text-[20px]" />
            </button>
          </div>

          {/* 確認ダイアログ（ポップアップ形式） */}
          {showAdjustmentConfirm && pendingAdjustment && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-transparent">
              <div className="bg-white rounded-2xl px-7 py-8 max-w-sm w-[90vw] text-center shadow-2xl border border-gray-200 animate-fadeIn">
                <p className="text-lg font-bold text-gray-900 mb-5 whitespace-pre-line">
                  {`純増値も同時に\n${pendingAdjustment.direction === "add" ? "加算" : "減算"}しますか？`}
                </p>
                <div className="flex flex-col gap-3 mt-2">
                  <button
                    className="w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white py-2.5 font-semibold text-base transition"
                    onClick={async () => {
                      setShowAdjustmentConfirm(false)
                      await runAdjustment(pendingAdjustment.direction, true)
                      setPendingAdjustment(null)
                    }}
                  >はい（純増も変更）</button>
                  <button
                    className="w-full rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-900 py-2.5 font-semibold text-base transition"
                    onClick={async () => {
                      setShowAdjustmentConfirm(false)
                      await runAdjustment(pendingAdjustment.direction, false)
                      setPendingAdjustment(null)
                    }}
                  >いいえ（チップのみ）</button>
                </div>
              </div>
            </div>
          )}

          {/* 入店履歴プレイヤーリスト */}
          <div className="mt-6">
            <p className="text-[13px] font-semibold text-gray-900 mb-2">入店履歴プレイヤー</p>
            {storePlayers.length === 0 ? (
              <p className="text-[13px] text-gray-500">履歴がありません</p>
            ) : (
              <div>
                {storePlayers.slice(0, storePlayersPage * pageSize).map(player => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => selectPlayer(player.id)}
                    className={`w-full text-left rounded-lg border border-gray-200 px-3 py-2 mb-2 hover:bg-gray-50 ${selectedPlayerId === player.id ? "bg-gray-100" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {player.iconUrl ? (
                        <img src={player.iconUrl} alt={player.name} className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">P</div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[13px] text-gray-900">{player.name || player.id}</span>
                        <span className="text-[12px] text-gray-500">{player.playerId}</span>
                      </div>
                      <div className="ml-auto text-right text-[12px]">
                        <span className="text-gray-900">チップ: <span className="font-semibold text-gray-900">{player.balance}</span></span>
                        <span className="ml-2 text-gray-900">({player.netGain >= 0 ? "+" : ""}{player.netGain})</span>
                      </div>
                    </div>
                  </button>
                ))}
                {storePlayers.length > storePlayersPage * pageSize && (
                  <button
                    type="button"
                    className="w-full mt-2 rounded-xl border border-gray-300 py-2 text-[13px] text-gray-700 hover:bg-gray-50"
                    onClick={() => setStorePlayersPage(p => p + 1)}
                  >もっと見る</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] border-t border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-sm w-full items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() =>
              router.push("/home/store")
            }
            className="flex flex-col items-center text-[#111]"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">
              ホーム
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/tournaments")}
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900 shadow-lg"
            aria-label="トーナメント"
          >
            <FiPlus className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">トナメ</span>
          </button>



          <button
            type="button"
            onClick={() =>
              router.push("/home/store/mypage")
            }
            className="flex flex-col items-center text-gray-400"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">
              マイページ
            </span>
          </button>
        </div>
      </nav>
    </main>
  )
}