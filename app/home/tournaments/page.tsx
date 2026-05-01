"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { FiArrowLeft, FiAward, FiShare2, FiTrendingUp } from "react-icons/fi"
import { useRouter } from "next/navigation"

// ── Canvas helpers ────────────────────────────────────────────

function roundRectCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

async function generateTournamentCard(opts: {
  tournamentName: string
  storeName: string
  dateStr: string
  rank: string
  buyin: number
  prize: number
  roi: number
  playerName: string
  rrRating: number
}): Promise<Blob> {
  const W = 375, H = 500
  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", sans-serif'
  const isITM = opts.rank !== '-' && opts.rank !== ''

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  if (isITM) {
    bg.addColorStop(0, '#1C1505')
    bg.addColorStop(1, '#1C1C1E')
  } else {
    bg.addColorStop(0, '#1A1A1C')
    bg.addColorStop(1, '#242426')
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Decorative glow
  if (isITM) {
    ctx.fillStyle = 'rgba(242,169,0,0.07)'
    ctx.beginPath(); ctx.arc(W * 0.8, H * 0.2, 160, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.beginPath(); ctx.arc(-20, -20, 140, 0, Math.PI * 2); ctx.fill()
  }

  // Gold top bar
  const goldGrad = ctx.createLinearGradient(0, 0, W, 0)
  goldGrad.addColorStop(0, '#F2A900')
  goldGrad.addColorStop(1, '#D4910A')
  ctx.fillStyle = goldGrad
  ctx.fillRect(0, 0, W, 5)

  // App branding
  ctx.font = `600 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.textAlign = 'right'
  ctx.fillText('RR Poker', W - 18, 28)

  // Rank badge (ITM only)
  if (isITM) {
    const rankCX = W - 58, rankCY = 82, rankR = 36
    const rankGrad = ctx.createLinearGradient(rankCX - rankR, rankCY - rankR, rankCX + rankR, rankCY + rankR)
    rankGrad.addColorStop(0, '#F2A900'); rankGrad.addColorStop(1, '#D4910A')
    ctx.fillStyle = rankGrad
    ctx.beginPath(); ctx.arc(rankCX, rankCY, rankR, 0, Math.PI * 2); ctx.fill()
    // Shadow ring
    ctx.strokeStyle = 'rgba(242,169,0,0.3)'; ctx.lineWidth = 6
    ctx.beginPath(); ctx.arc(rankCX, rankCY, rankR + 5, 0, Math.PI * 2); ctx.stroke()
    ctx.font = `800 ${opts.rank.length > 2 ? 13 : 16}px ${FONT}`
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
    ctx.fillText(opts.rank + '位', rankCX, rankCY + 6)
  }

  // Tournament name
  ctx.textAlign = 'left'
  ctx.font = `700 19px ${FONT}`; ctx.fillStyle = '#FFFFFF'
  let tname = opts.tournamentName
  const maxTW = isITM ? W - 140 : W - 44
  if (ctx.measureText(tname).width > maxTW) {
    while (tname.length > 0 && ctx.measureText(tname + '..').width > maxTW) tname = tname.slice(0, -1)
    tname += '..'
  }
  ctx.fillText(tname, 22, 56)

  // Date + store
  ctx.font = `400 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText(`${opts.dateStr}  ·  ${opts.storeName}`, 22, 76)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(22, 98); ctx.lineTo(W - 22, 98); ctx.stroke()

  // Stats cards
  const cardY = 114, cardH = 92
  const cardW = (W - 56) / 3
  const cards = [
    {
      label: '出費合計',
      value: opts.buyin.toLocaleString(),
      color: 'rgba(255,255,255,0.06)',
      valueColor: '#FFFFFF',
    },
    {
      label: '獲得',
      value: opts.prize > 0 ? opts.prize.toLocaleString() : '-',
      color: isITM ? 'rgba(242,169,0,0.14)' : 'rgba(255,255,255,0.06)',
      valueColor: isITM ? '#F2A900' : '#FFFFFF',
    },
    {
      label: 'ROI',
      value: opts.buyin > 0 ? `${opts.roi >= 0 ? '+' : ''}${opts.roi.toFixed(1)}%` : '-',
      color: opts.roi > 0 ? 'rgba(52,199,89,0.12)' : opts.roi < 0 ? 'rgba(255,59,48,0.12)' : 'rgba(255,255,255,0.06)',
      valueColor: opts.roi > 0 ? '#34C759' : opts.roi < 0 ? '#FF3B30' : '#FFFFFF',
    },
  ]

  cards.forEach((c, i) => {
    const cx = 22 + i * (cardW + 6)
    ctx.fillStyle = c.color
    roundRectCanvas(ctx, cx, cardY, cardW, cardH, 14); ctx.fill()
    ctx.font = `400 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textAlign = 'center'
    ctx.fillText(c.label, cx + cardW / 2, cardY + 24)
    ctx.font = `700 17px ${FONT}`; ctx.fillStyle = c.valueColor
    ctx.fillText(c.value, cx + cardW / 2, cardY + 58)
  })

  // Player info section
  const playerY = cardY + cardH + 28
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(22, playerY - 14); ctx.lineTo(W - 22, playerY - 14); ctx.stroke()

  ctx.font = `600 14px ${FONT}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'
  ctx.fillText(opts.playerName || 'Player', 22, playerY + 6)
  ctx.font = `400 11px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText(`トナメ偏差値 ${opts.rrRating.toFixed(1)}`, 22, playerY + 22)

  // Bottom branding
  ctx.font = `500 11px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.26)'; ctx.textAlign = 'center'
  ctx.fillText('RR Poker でポーカーライフをシェア', W / 2, H - 18)

  // Gold bottom bar
  ctx.fillStyle = goldGrad
  ctx.fillRect(0, H - 5, W, 5)

  return new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'))
}

// ─────────────────────────────────────────────────────────────

export default function TournamentHistoryPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [playerInfo, setPlayerInfo] = useState({ name: '', rrRating: 0 })
  const [sharingCard, setSharingCard] = useState(false)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      setUserId(user?.uid ?? null)
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid))
        const data = snap.data() ?? {}
        setPlayerInfo({ name: data.name ?? '', rrRating: data.rrRating ?? 0 })
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchHistory = async () => {
      if (!userId) return
      const snap = await getDocs(collection(db, "users", userId, "tournamentHistory"))
      const list: any[] = []
      snap.forEach(docSnap => { list.push({ id: docSnap.id, ...docSnap.data() }) })
      list.sort((a, b) => (b.startedAt?.seconds ?? 0) - (a.startedAt?.seconds ?? 0))
      setHistory(list)
    }
    fetchHistory()
  }, [userId])

  const formatDateTime = (seconds?: number) => {
    if (!seconds) return ""
    const date = new Date(seconds * 1000)
    const pad = (v: number) => v.toString().padStart(2, "0")
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const computeStats = (item: any) => {
    const entryCount = item.entryCount ?? 0
    const reentryCount = item.reentryCount ?? 0
    const addonCount = item.addonCount ?? 0
    const entryFee = item.entryFee ?? 0
    const reentryFee = item.reentryFee ?? 0
    const addonFee = item.addonFee ?? 0
    const prize = item.prize ?? 0
    const rank = item.rank ?? "-"
    const buyin = entryCount * entryFee + reentryCount * reentryFee + addonCount * addonFee
    let baseFee = 0
    if (entryFee > 0) baseFee = entryFee
    else if (reentryFee > 0) baseFee = reentryFee
    else baseFee = addonFee
    const cost = baseFee > 0 ? buyin / baseFee : 0
    const reward = baseFee > 0 ? prize / baseFee : 0
    const roi = cost > 0 ? ((reward - cost) / cost * 100) : 0
    return { entryCount, reentryCount, addonCount, entryFee, reentryFee, addonFee, prize, rank, buyin, cost, reward, roi }
  }

  const shareTournamentCard = async (item: any) => {
    setSharingCard(true)
    try {
      const { rank, buyin, prize, roi } = computeStats(item)
      const blob = await generateTournamentCard({
        tournamentName: item.tournamentName ?? '',
        storeName: item.storeName ?? '',
        dateStr: formatDateTime(item.startedAt?.seconds),
        rank: rank === '-' ? '-' : String(rank),
        buyin,
        prize,
        roi,
        playerName: playerInfo.name,
        rrRating: playerInfo.rrRating,
      })
      const file = new File([blob], 'rrpoker-tournament.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${item.tournamentName ?? 'Tournament'} の結果`, text: '#RRPoker' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'rrpoker-tournament.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch {}
    finally { setSharingCard(false) }
  }

  return (
    <main className="min-h-screen bg-[#FFFBF5] px-4 pb-12">
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes sheetUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-fadeIn  { animation: fadeIn 0.4s ease-out; }
        .tour-sheet { animation: sheetUp .38s cubic-bezier(.22,1,.36,1) both; }
        .history-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 0 2px 8px rgba(242,169,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
        }
        .tour-card-tap { cursor: pointer; transition: transform .15s, box-shadow .15s; }
        .tour-card-tap:active { transform: scale(0.98); }
      `}</style>

      <div className="mx-auto max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between pt-6 mb-6">
          <button onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-600 hover:bg-white transition-all active:scale-95 shadow-sm">
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-[20px] font-semibold text-gray-900">Tournament History</h1>
          <div className="w-10" />
        </div>

        {/* Stats Summary */}
        {history.length > 0 && (
          <div className="history-card rounded-3xl p-5 mb-6 animate-slideUp">
            <div className="flex items-center gap-2 mb-3">
              <FiTrendingUp className="text-[#F2A900]" size={18} />
              <p className="text-[14px] font-semibold text-gray-900">サマリー</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[11px] text-gray-500">参加数</p>
                <p className="text-[20px] font-bold text-gray-900">{history.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">インマネ回数</p>
                <p className="text-[20px] font-bold text-[#F2A900]">
                  {history.filter(h => h.rank && h.rank !== "-").length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">インマネ率</p>
                <p className="text-[20px] font-bold text-[#D4910A]">
                  {history.length > 0
                    ? `${Math.round((history.filter(h => h.rank && h.rank !== "-").length / history.length) * 100)}%`
                    : "0%"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* History List */}
        <div className="space-y-3">
          {history.map((item, index) => {
            const { entryCount, reentryCount, addonCount, entryFee, reentryFee, addonFee, prize, rank, buyin, cost, reward, roi } = computeStats(item)

            return (
              <div key={item.id}
                className="history-card rounded-2xl p-4 hover:shadow-lg transition-all animate-fadeIn tour-card-tap"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => setSelectedItem(item)}>

                {/* Tournament Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-gray-900 leading-tight mb-1">
                      {item.tournamentName ?? ""}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {formatDateTime(item.startedAt?.seconds)} • {item.storeName ?? ""}
                    </p>
                  </div>
                  {rank !== "-" && (
                    <div className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] shadow-sm flex-shrink-0">
                      <span className="text-[13px] font-bold text-white">{rank}位</span>
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="col-span-2 rounded-xl bg-gray-50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#F2A900]"></div>
                      <p className="text-[11px] font-semibold text-gray-600">Buy-in</p>
                    </div>
                    <div className="space-y-1 text-[12px] text-gray-600">
                      {entryCount > 0 && (
                        <p className="flex justify-between">
                          <span>Entry:</span>
                          <span className="font-medium">{entryFee} × {entryCount}回</span>
                        </p>
                      )}
                      {reentryCount > 0 && (
                        <p className="flex justify-between">
                          <span>Re-entry:</span>
                          <span className="font-medium">{reentryFee} × {reentryCount}回</span>
                        </p>
                      )}
                      {addonCount > 0 && (
                        <p className="flex justify-between">
                          <span>Add-on:</span>
                          <span className="font-medium">{addonFee} × {addonCount}回</span>
                        </p>
                      )}
                      <div className="h-px bg-gray-200 my-1.5"></div>
                      <p className="flex justify-between text-[13px] font-semibold text-gray-900">
                        <span>合計出費:</span>
                        <span>{buyin.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>

                  <div className={`rounded-xl p-3 ${rank !== "-" ? "bg-gradient-to-br from-[#FFF6E5] to-[#FFFBF5] border border-[#F2A900]/20" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${rank !== "-" ? "bg-[#F2A900]" : "bg-gray-400"}`}></div>
                      <p className="text-[11px] font-semibold text-gray-600">Prize</p>
                    </div>
                    {rank !== "-" ? (
                      <p className="text-[16px] font-bold text-[#D4910A]">{prize.toLocaleString()}</p>
                    ) : (
                      <p className="text-[14px] text-gray-400">-</p>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 mb-1.5">ROI</p>
                    <p className={`text-[16px] font-bold ${reward > cost ? "text-green-600" : reward < cost ? "text-red-600" : "text-gray-600"}`}>
                      {cost > 0 ? `${(((reward - cost) / cost) * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500">Cost:</span>
                    <span className="font-semibold text-gray-700">{cost.toFixed(1)}</span>
                  </div>
                  <div className="h-3 w-px bg-gray-200"></div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500">Reward:</span>
                    <span className="font-semibold text-gray-700">{reward.toFixed(1)}</span>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: '#C7C7CC' }}>タップで詳細 →</div>
                </div>
              </div>
            )
          })}

          {history.length === 0 && (
            <div className="text-center py-16 animate-fadeIn">
              <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FiAward className="text-gray-300" size={36} />
              </div>
              <p className="text-[16px] font-semibold text-gray-900 mb-1">トーナメント履歴がありません</p>
              <p className="text-[14px] text-gray-500">トーナメントに参加すると履歴が表示されます</p>
            </div>
          )}
        </div>
      </div>

      {/* ── トナメ詳細 + シェアシート ── */}
      {selectedItem && (() => {
        const { entryCount, reentryCount, addonCount, entryFee, reentryFee, addonFee, prize, rank, buyin, cost, reward } = computeStats(selectedItem)
        const roi = cost > 0 ? ((reward - cost) / cost * 100) : 0
        const isITM = rank !== '-' && rank !== ''
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setSelectedItem(null)}>
            <div className="tour-sheet" style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, padding: '12px 20px 48px', maxHeight: '88dvh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(60,60,67,0.18)', margin: '0 auto 20px' }} />

              {/* Sheet header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.3, marginBottom: 4 }}>{selectedItem.tournamentName ?? ""}</p>
                  <p style={{ fontSize: 12, color: '#8E8E93' }}>{formatDateTime(selectedItem.startedAt?.seconds)} · {selectedItem.storeName ?? ""}</p>
                </div>
                {isITM && (
                  <div style={{ marginLeft: 12, width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(242,169,0,0.4)' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{rank}位</span>
                  </div>
                )}
              </div>

              {/* Buy-in breakdown */}
              <div style={{ background: '#F2F2F7', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Buy-in 内訳</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {entryCount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#3C3C43' }}>Entry</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{entryFee.toLocaleString()} × {entryCount}回</span>
                    </div>
                  )}
                  {reentryCount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#3C3C43' }}>Re-entry</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{reentryFee.toLocaleString()} × {reentryCount}回</span>
                    </div>
                  )}
                  {addonCount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#3C3C43' }}>Add-on</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{addonFee.toLocaleString()} × {addonCount}回</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>合計出費</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{buyin.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Result stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: isITM ? 'rgba(242,169,0,0.08)' : '#F2F2F7', borderRadius: 16, padding: '14px 16px', border: isITM ? '1px solid rgba(242,169,0,0.2)' : 'none' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Prize</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: isITM ? '#D4910A' : '#C7C7CC' }}>{isITM ? prize.toLocaleString() : '-'}</p>
                </div>
                <div style={{ background: roi > 0 ? 'rgba(52,199,89,0.08)' : roi < 0 ? 'rgba(255,59,48,0.08)' : '#F2F2F7', borderRadius: 16, padding: '14px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>ROI</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: roi > 0 ? '#34C759' : roi < 0 ? '#FF3B30' : '#8E8E93' }}>
                    {cost > 0 ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '-'}
                  </p>
                </div>
              </div>

              <div style={{ background: '#F2F2F7', borderRadius: 16, padding: '12px 16px', display: 'flex', gap: 20, marginBottom: 24 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#8E8E93', marginBottom: 4 }}>Cost</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>{cost.toFixed(2)}</p>
                </div>
                <div style={{ width: 1, background: 'rgba(0,0,0,0.08)' }} />
                <div>
                  <p style={{ fontSize: 11, color: '#8E8E93', marginBottom: 4 }}>Reward</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>{reward.toFixed(2)}</p>
                </div>
              </div>

              {/* Share button */}
              <button type="button" onClick={() => shareTournamentCard(selectedItem)} disabled={sharingCard}
                style={{ width: '100%', height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: sharingCard ? 0.7 : 1 }}>
                {sharingCard
                  ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.6)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }} />
                  : <FiShare2 size={17} />
                }
                {sharingCard ? '生成中...' : 'この結果をシェア'}
              </button>
            </div>
          </div>
        )
      })()}
    </main>
  )
}
