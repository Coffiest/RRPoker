"use client"
import { RefreshCwIcon, SearchIcon } from 'lucide-react'

import { useEffect, useMemo, useState } from "react"
import { filterAndSortPlayers, rankByRating, type AdminPlayer, type PlayerSort } from "@/lib/adminPlayers"

type ApiFn = (path: string, method: string, body?: object) => Promise<Response>

const SORT_LABEL: Record<PlayerSort, string> = {
  rating: "偏差値順",
  name: "名前順",
  created: "登録日順",
}

/**
 * 管理者画面のプレイヤー一覧。名前・プレイヤーID・メールで検索し、
 * 偏差値順(ランキング)・名前順・登録日順で並べ替え、BAN / 解除を行う。
 * 偏差値は 45 未満も実際の値を出す(管理者用)。
 */
export default function AdminPlayersTab({ api, onUnauthorized }: { api: ApiFn; onUnauthorized: () => void }) {
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<PlayerSort>("rating")
  const [banTarget, setBanTarget] = useState<AdminPlayer | null>(null)
  const [banReason, setBanReason] = useState("")
  const [savingUid, setSavingUid] = useState<string | null>(null)
  const [recomputing, setRecomputing] = useState(false)

  const fetchPlayers = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await api("/api/admin/players", "GET")
      if (res.status === 401) { onUnauthorized(); return }
      if (!res.ok) { setError("プレイヤーの取得に失敗しました"); return }
      const data = await res.json()
      setPlayers(data.players ?? [])
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchPlayers() }, [])

  const ranks = useMemo(() => rankByRating(players), [players])
  const visible = useMemo(() => filterAndSortPlayers(players, search, sort), [players, search, sort])
  const bannedCount = players.filter(p => p.banned).length

  const setBanned = async (p: AdminPlayer, banned: boolean, reason?: string) => {
    setSavingUid(p.uid)
    setError("")
    setNotice("")
    try {
      const res = await api("/api/admin/ban", "POST", { uid: p.uid, banned, reason })
      if (res.status === 401) { onUnauthorized(); return }
      if (!res.ok) { setError(banned ? "BANに失敗しました" : "BANの解除に失敗しました"); return }
      setBanTarget(null)
      setBanReason("")
      setNotice(`${p.name || p.playerId || p.uid} を${banned ? "BANしました" : "BAN解除しました"}。偏差値を計算し直しました。`)
      await fetchPlayers()
    } finally {
      setSavingUid(null)
    }
  }

  const recomputeAll = async () => {
    setRecomputing(true)
    setError("")
    setNotice("")
    try {
      const res = await api("/api/admin/rr-recompute", "POST")
      if (res.status === 401) { onUnauthorized(); return }
      if (!res.ok) { setError("偏差値の再計算に失敗しました"); return }
      const data = await res.json()
      setNotice(`全員の偏差値を計算し直しました(対象 ${data.rated} 人 / BANで除外 ${data.excluded} 人)。`)
      await fetchPlayers()
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-sm text-gray-400">
          {players.length} 人{bannedCount > 0 && <span className="text-red-400"> (BAN中 {bannedCount})</span>}
        </p>
        <div className="flex gap-2">
          <button onClick={recomputeAll} disabled={recomputing} className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50">
            {recomputing ? "計算中..." : "偏差値を再計算"}
          </button>
          <button onClick={fetchPlayers} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50">
            <RefreshCwIcon size={13} className={loading ? "animate-spin" : ""} /> 更新
          </button>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
      {notice && <div className="mb-4 px-4 py-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400">{notice}</div>}

      <div className="relative mb-4">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="名前・プレイヤーID・メールで検索"
          className="w-full bg-gray-800 rounded-xl pl-10 pr-4 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-[#F2A900]/40"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {(Object.keys(SORT_LABEL) as PlayerSort[]).map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${sort === s ? "bg-[#F2A900] text-black" : "bg-gray-800 text-gray-300"}`}
          >
            {SORT_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && players.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">読み込み中...</p>}
        {!loading && visible.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">プレイヤーが見つかりません</p>}
        {visible.map(p => {
          const rank = ranks.get(p.uid)
          return (
            <div key={p.uid} className={`flex items-center gap-4 rounded-xl px-4 py-4 ${p.banned ? "bg-red-950/40 ring-1 ring-red-500/20" : "bg-gray-900"}`}>
              <div className="w-8 shrink-0 text-center text-xs font-bold text-gray-400 tabular-nums">
                {rank ?? "--"}
              </div>
              {p.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.iconUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-800 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {p.name || "(名前未設定)"}
                  {p.banned && <span className="ml-2 text-[11px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">BAN中</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {p.playerId ?? "ID未設定"}{p.email ? ` ・ ${p.email}` : ""}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  参加 {p.plays} 回
                  {p.createdAt ? ` ・ 登録 ${new Date(p.createdAt).toLocaleDateString("ja-JP")}` : ""}
                  {p.banned && p.banReason ? ` ・ 理由: ${p.banReason}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-gray-400">偏差値</p>
                <p className="text-sm font-bold tabular-nums">{p.rrRating !== null ? p.rrRating.toFixed(2) : "--"}</p>
              </div>
              <button
                onClick={() => p.banned ? setBanned(p, false) : (setBanTarget(p), setBanReason(""))}
                disabled={savingUid === p.uid}
                className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 ${
                  p.banned ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-red-600 text-white hover:bg-red-500"
                }`}
              >
                {savingUid === p.uid ? "..." : p.banned ? "解除" : "BAN"}
              </button>
            </div>
          )
        })}
      </div>

      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold mb-2">このプレイヤーをBANしますか?</h2>
            <p className="text-xs text-gray-400 mb-4 truncate">{banTarget.name || banTarget.playerId || banTarget.uid}</p>
            <ul className="text-xs text-gray-400 mb-4 space-y-2 list-disc pl-4">
              <li>ログインできなくなります(ログイン中の端末も締め出されます)</li>
              <li>入店中なら退店になり、店舗に入店できなくなります</li>
              <li>偏差値・ランキング・検索・プロフィールから外れ、全員の偏差値を計算し直します</li>
              <li>チップ残高・大会履歴などのデータは残ります。解除すれば元に戻ります</li>
            </ul>
            <textarea
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder="理由(任意・管理者画面にだけ表示)"
              maxLength={500}
              rows={3}
              className="w-full bg-gray-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-red-500/40 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setBanTarget(null)} className="flex-1 h-11 rounded-xl bg-gray-800 text-sm font-medium text-gray-300 hover:bg-gray-700">
                キャンセル
              </button>
              <button
                onClick={() => setBanned(banTarget, true, banReason)}
                disabled={savingUid === banTarget.uid}
                className="flex-1 h-11 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {savingUid === banTarget.uid ? "..." : "BANする"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
