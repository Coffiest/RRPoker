"use client"

import { useMemo, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { db } from "@/lib/firebase"
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore"
import { FiX, FiShare2, FiTrash2, FiChevronRight } from "react-icons/fi"

// ── Constants ──────────────────────────────────────────────────────────────
const HAND_RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"]
const HAND_SUITS = ["s","h","d","c"]
const HAND_SUIT_SYM: Record<string,string> = { s:"♠", h:"♥", d:"♦", c:"♣" }
const HAND_SUIT_CLR: Record<string,string> = { s:"#1D1D1F", h:"#E53E3A", d:"#2563EB", c:"#16A34A" }
const HT_ALL_POS = ["UTG","UTG+1","UTG+2","MP","LJ","HJ","CO","BTN","SB","BB"]
const HT_STREET_ORDER = ["preflop","flop","turn","river"] as const
const ACT_JP: Record<string,string> = {
  fold:"fold", check:"check", call:"call", bet:"bet", raise:"raise", allin:"All-in",
}
const CLR = {
  bg:      "#FFFBF5",
  white:   "#FFFFFF",
  surface: "#F5F3EF",
  border:  "#E8E3DB",
  gold:    "#F2A900",
  goldDk:  "#D4910A",
  ink:     "#1D1D1F",
  gray2:   "#6E6E73",
  gray3:   "#AEAEB2",
  red:     "#E53E3A",
}

// ── Pure helpers ────────────────────────────────────────────────────────────
function htGetPositions(n: number): string[] {
  if (n === 2) return ["BTN","BB"]
  return HT_ALL_POS.slice(10 - n)
}

function seatXY(posIdx: number, total: number, btnIdx: number, cx: number, cy: number, rx: number, ry: number) {
  const btn = btnIdx < 0 ? 0 : btnIdx
  const rel = (posIdx - btn + total) % total
  const angle = Math.PI + (rel / total) * Math.PI * 2
  return { x: cx + Math.sin(angle) * rx, y: cy - Math.cos(angle) * ry }
}

function computeOrder(
  street: "preflop"|"flop"|"turn"|"river",
  positions: string[],
  folded: Set<string>
): string[] {
  const active = positions.filter(p => !folded.has(p))
  if (!active.length) return []
  if (street === "preflop") return active
  const si = positions.indexOf("SB")
  const ordered = [...positions.slice(si >= 0 ? si : 0), ...positions.slice(0, si >= 0 ? si : 0)]
  return ordered.filter(p => active.includes(p))
}

function fmtDate(s?: number) {
  if (!s) return ""
  return new Date(s * 1000).toLocaleDateString("ja-JP", { month:"numeric", day:"numeric" })
}

// ── Types ───────────────────────────────────────────────────────────────────
type HAction  = { street:string; position:string; action:string; amount?:number }
type HandRec  = {
  id:string; title:string; heroPosition:string; heroCards:string[]; note:string
  notes?:Record<string,string>; createdAt?:{seconds?:number}
  board?:{flop:string[]|null;turn:string|null;river:string|null}
  actions?:HAction[]; villainCards?:Record<string,string[]>
  playerPositions?:string[]
}
interface Props { userId:string|null; creatorName:string }

// ── Mini card ────────────────────────────────────────────────────────────────
function MiniCard({ card }: { card:string }) {
  const rank = card.slice(0,-1), suit = card.slice(-1)
  return (
    <span className="inline-flex flex-col items-center justify-center rounded-md font-bold leading-none"
      style={{ width:22, height:28, fontSize:8, color:HAND_SUIT_CLR[suit], background:CLR.white, border:`1px solid ${CLR.border}` }}>
      <span className="text-[9px]">{rank}</span><span className="text-[8px]">{HAND_SUIT_SYM[suit]}</span>
    </span>
  )
}

// ── Component ────────────────────────────────────────────────────────────────
export default function HandHistoryModal({ userId, creatorName }: Props) {
  const [isOpen,  setIsOpen]  = useState(false)
  const [view,    setView]    = useState<"record"|"history">("record")

  // record state
  const [htCount,   setHtCount]   = useState(6)
  const [htStreet,  setHtStreet]  = useState<"preflop"|"flop"|"turn"|"river">("preflop")
  const [htBoard,   setHtBoard]   = useState<(string|null)[]>([null,null,null,null,null])
  const [htCards,   setHtCards]   = useState<Record<string,(string|null)[]>>({})
  const [htActions, setHtActions] = useState<HAction[]>([])
  const [htQueue,   setHtQueue]   = useState<string[]>([])
  const [htSeat,    setHtSeat]    = useState<string|null>(null)
  const [htHero,    setHtHero]    = useState<string|null>(null)
  const [htAnte,       setHtAnte]       = useState(true)
  const [htActType,    setHtActType]    = useState("")
  const [htActAmt,     setHtActAmt]     = useState("")
  const [htPick,       setHtPick]       = useState<string|null>(null)
  const [htTitle,      setHtTitle]      = useState("")
  const [htNotes,      setHtNotes]      = useState<Record<string,string>>({})
  const [htSaving,     setHtSaving]     = useState(false)
  const [htSavedId,    setHtSavedId]    = useState<string|null>(null)
  const [showTitlePopup, setShowTitlePopup] = useState(false)
  const [showNoteInput,  setShowNoteInput]  = useState<string|null>(null)

  // history state
  const [history,      setHistory]      = useState<HandRec[]>([])
  const [histLoading,  setHistLoading]  = useState(false)
  const [histError,    setHistError]    = useState<string|null>(null)
  const [delConfirmId,   setDelConfirmId]   = useState<string|null>(null)
  const [expandedHandId, setExpandedHandId] = useState<string|null>(null)
  const [viewingHand,    setViewingHand]    = useState<HandRec|null>(null)
  const [replayStep,     setReplayStep]     = useState(0)
  const [replayPlaying,  setReplayPlaying]  = useState(false)

  // ITM calculator state
  const [itmOpen,      setItmOpen]      = useState(false)
  const [itmRemaining, setItmRemaining] = useState("")
  const [itmSpots,     setItmSpots]     = useState("")
  const [itmMyChips,   setItmMyChips]   = useState("")
  const [itmAvgStack,  setItmAvgStack]  = useState("")

  const itmResult = useMemo(() => {
    const remaining = Number(itmRemaining)
    const spots     = Number(itmSpots)
    const myChips   = Number(itmMyChips)
    const avgStack  = Number(itmAvgStack)
    if (!remaining || !spots || !myChips || !avgStack) return null

    const totalChips = avgStack * remaining
    const chipRatio  = (myChips / totalChips) * 100
    const avgRatio   = myChips / avgStack

    // All-ITM edge case
    if (spots >= remaining) return { probability: 100, chipRatio, avgStack, avgRatio }

    // Malmuth-Harville ICM (equal-opponents assumption)
    // P(i at position p) = C(n-1,p-1) * s * q^(p-1) / Π_{k=0}^{p-1}(1-k*q)
    const s = myChips / totalChips
    const q = (1 - s) / (remaining - 1)
    let itmProb   = 0
    let coeffProd = 1
    let denomProd = 1
    let qPow      = 1
    for (let p = 1; p <= spots; p++) {
      denomProd *= (1 - (p - 1) * q)
      itmProb   += (coeffProd * s * qPow) / denomProd
      coeffProd *= (remaining - p)
      qPow      *= q
    }

    return { probability: Math.min(itmProb, 1) * 100, chipRatio, avgStack, avgRatio }
  }, [itmRemaining, itmSpots, itmMyChips, itmAvgStack])

  const positions = useMemo(() => htGetPositions(htCount), [htCount])


  // Derived fold sets
  const permFolded = useMemo(() => {
    const ci = HT_STREET_ORDER.indexOf(htStreet)
    const s  = new Set<string>()
    for (let i = 0; i < ci; i++) {
      const st   = HT_STREET_ORDER[i]
      const acts = htActions.filter(a => a.street === st)
      positions.forEach(p => {
        if (s.has(p)) return
        if (acts.some(a => a.position===p && a.action==="fold")) s.add(p)
        else if (!acts.some(a => a.position===p)) s.add(p)
      })
    }
    return s
  }, [htActions, htStreet, positions])

  const currFolded = useMemo(() => {
    const s = new Set<string>()
    htActions.filter(a => a.street===htStreet && a.action==="fold").forEach(a => s.add(a.position))
    return s
  }, [htActions, htStreet])

  const allFolded  = useMemo(() => new Set([...permFolded, ...currFolded]), [permFolded, currFolded])

  const pot = useMemo(() => {
    const base = htAnte ? 2.5 : 1.5
    return htActions.reduce((s,a) => s + (a.amount??0), base)
  }, [htActions, htAnte])

  const usedCards = useMemo(() => {
    const s = new Set<string>()
    htBoard.forEach(c => { if (c) s.add(c) })
    Object.values(htCards).forEach(cs => cs.forEach(c => { if (c) s.add(c) }))
    return s
  }, [htBoard, htCards])

  const hasBet     = htActions.some(a => a.street===htStreet && (a.action==="bet"||a.action==="raise"||a.action==="allin"))
  const acts       = (htStreet==="preflop"||hasBet) ? ["fold","call","raise","allin"] : ["check","bet","allin"]

  // Queue management
  const buildQueue = (street: "preflop"|"flop"|"turn"|"river", actions: HAction[], pos: string[]) => {
    const si = HT_STREET_ORDER.indexOf(street)
    const pf = new Set<string>()
    for (let i = 0; i < si; i++) {
      const st = HT_STREET_ORDER[i]; const sActs = actions.filter(a => a.street===st)
      pos.forEach(p => {
        if (pf.has(p)) return
        if (sActs.some(a => a.position===p && a.action==="fold")) pf.add(p)
        else if (!sActs.some(a => a.position===p)) pf.add(p)
      })
    }
    const cf = new Set<string>()
    actions.filter(a => a.street===street && a.action==="fold").forEach(a => cf.add(a.position))
    const q = computeOrder(street, pos, new Set([...pf, ...cf]))
    setHtQueue(q); setHtSeat(q[0]??null); setHtActType(""); setHtActAmt("")
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOpen) buildQueue(htStreet, htActions, positions) }, [positions])

  // Listen for tool events dispatched from PlayerBottomNav
  useEffect(() => {
    const onItm = () => setItmOpen(true)
    const onHandRecord = () => { reset(); setView("record"); setIsOpen(true) }
    window.addEventListener('rrpoker:tool:itm', onItm)
    window.addEventListener('rrpoker:tool:hand-record', onHandRecord)
    return () => {
      window.removeEventListener('rrpoker:tool:itm', onItm)
      window.removeEventListener('rrpoker:tool:hand-record', onHandRecord)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    const dp = htGetPositions(6); const iq = computeOrder("preflop", dp, new Set())
    setHtCount(6); setHtStreet("preflop"); setHtBoard([null,null,null,null,null])
    setHtCards({}); setHtActions([]); setHtQueue(iq); setHtSeat(iq[0]??null)
    setHtHero(null); setHtAnte(true); setHtActType(""); setHtActAmt(""); setHtPick(null)
    setHtTitle(""); setHtNotes({}); setHtSaving(false); setHtSavedId(null)
    setShowTitlePopup(false); setShowNoteInput(null)
  }

  const goStreet = (s: "preflop"|"flop"|"turn"|"river") => { setHtStreet(s); buildQueue(s, htActions, positions) }

  // Auto-advance to next street when action queue empties
  useEffect(() => {
    if (!isOpen || htQueue.length > 0) return
    if (!htActions.some(a => a.street === htStreet)) return
    if (htStreet === "river") return
    const nextMap = { preflop: "flop", flop: "turn", turn: "river" } as const
    const next = nextMap[htStreet as "preflop"|"flop"|"turn"]
    if (!next) return
    const timer = setTimeout(() => {
      setHtStreet(next); buildQueue(next, htActions, positions)
      if (next === "flop") setHtPick("b|0")
      else if (next === "turn" && !htBoard[3]) setHtPick("b|3")
      else if (next === "river" && !htBoard[4]) setHtPick("b|4")
    }, 200)
    return () => clearTimeout(timer)
  }, [htQueue.length, htStreet, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveClick = () => setShowTitlePopup(true)

  // Replay auto-advance
  useEffect(() => {
    if (!viewingHand || !replayPlaying) return
    const total = (viewingHand.actions ?? []).length
    if (replayStep >= total) { setReplayPlaying(false); return }
    const timer = setTimeout(() => setReplayStep(s => s + 1), 2000)
    return () => clearTimeout(timer)
  }, [viewingHand, replayPlaying, replayStep])

  const tapSeat = (pos: string) => {
    if (allFolded.has(pos)) return
    if (htSeat === pos) { setHtSeat(null); setHtActType(""); setHtActAmt(""); setShowNoteInput(null); return }

    const qIdx = htQueue.indexOf(pos)
    if (qIdx > 0) {
      const toFold = htQueue.slice(0, qIdx)
      const foldActs: HAction[] = toFold.map(p => ({ street: htStreet, position: p, action: "fold" as const }))
      const newActions = [
        ...htActions.filter(a => !(a.street === htStreet && toFold.includes(a.position))),
        ...foldActs,
      ]
      setHtActions(newActions)
      setHtQueue(htQueue.slice(qIdx))
    }

    setHtSeat(pos); setHtActType(""); setHtActAmt(""); setShowNoteInput(null)
  }

  const confirm = (forceActType?: string) => {
    const seat    = htSeat; if (!seat) return
    const actType = forceActType ?? htActType; if (!actType) return
    const sActs   = htActions.filter(a => a.street===htStreet)
    const maxBet  = sActs.reduce((m,a) => (a.amount!=null?Math.max(m,a.amount):m), 0)
    let amount: number|null = null
    if (actType==="call")                amount = Math.max(0, maxBet)
    else if (actType==="bet"||actType==="raise"||actType==="allin") { const v=Number(htActAmt); if (isNaN(v)||v<=0) return; amount=v }

    const newAct: HAction = { street:htStreet, position:seat, action:actType }
    if (amount!=null) newAct.amount = amount
    const newActions = [...htActions.filter(a => !(a.street===htStreet&&a.position===seat)), newAct]
    setHtActions(newActions)

    let nq: string[]
    if (actType==="fold") {
      const ncf = new Set(currFolded); ncf.add(seat)
      nq = htQueue.slice(1).filter(p => !new Set([...permFolded,...ncf]).has(p))
    } else if (actType==="bet"||actType==="raise") {
      const active = computeOrder(htStreet, positions, allFolded)
      const mi     = active.indexOf(seat)
      nq = [...active.slice(mi+1), ...active.slice(0,mi)]
    } else { nq = htQueue.slice(1) }

    setHtQueue(nq); setHtSeat(nq[0]??null); setHtActType(""); setHtActAmt("")
  }

  const save = async () => {
    if (!userId) return; setHtSaving(true)
    try {
      const heroPos   = htHero??positions[0]
      const heroCards = (htCards[heroPos]??[]).filter(Boolean) as string[]
      const villains: Record<string,string[]> = {}
      positions.forEach(p => { if (p===heroPos) return; const cs=htCards[p]; if (cs?.[0]&&cs?.[1]) villains[p]=[cs[0],cs[1]] })
      const boardFlop = htBoard.slice(0,3).every(c=>c) ? htBoard.slice(0,3) as string[] : null
      const streets: Array<"preflop"|"flop"|"turn"|"river"> = ["preflop"]
      if (boardFlop) streets.push("flop"); if (htBoard[3]) streets.push("turn"); if (htBoard[4]) streets.push("river")
      const foldedSoFar = new Set<string>()
      const allActs: Record<string,string|number>[] = []
      streets.forEach(st => {
        const sActs = htActions.filter(a => a.street===st)
        sActs.forEach(a => { const o: Record<string,string|number>={street:a.street,position:a.position,action:a.action}; if (a.amount!=null) o.amount=a.amount; allActs.push(o); if (a.action==="fold") foldedSoFar.add(a.position) })
        positions.forEach(p => { if (foldedSoFar.has(p)) return; if (!sActs.some(a=>a.position===p)){allActs.push({street:st,position:p,action:"fold"});foldedSoFar.add(p)} })
      })
      const ref = await addDoc(collection(db,"handHistories"),{
        creatorId:userId, creatorName, createdAt:serverTimestamp(),
        title:htTitle.trim()||"ハンドレビュー", stakes:{sb:0,bb:0},
        heroPosition:heroPos, playerPositions:positions, heroCards, villainCards:villains,
        board:{flop:boardFlop,turn:htBoard[3]??null,river:htBoard[4]??null},
        actions:allActs, notes:htNotes,
      })
      setHtSavedId(ref.id)
    } catch (e){console.error(e)} finally {setHtSaving(false)}
  }

  const share = async (id:string,title:string) => {
    const url=`${window.location.origin}/hand/${id}`
    if (navigator.share){try{await navigator.share({title:title||"ハンドレビュー",url})}catch{}}
    else {try{await navigator.clipboard.writeText(url)}catch{}}
  }

  const delHand = async (id:string) => {
    try{await deleteDoc(doc(db,"handHistories",id))}catch{}
    setHistory(prev=>prev.filter(h=>h.id!==id)); setDelConfirmId(null)
  }

  useEffect(() => {
    if (view!=="history"||!userId||!isOpen) return
    setHistLoading(true); setHistError(null)
    getDocs(query(collection(db,"handHistories"),where("creatorId","==",userId)))
      .then(snap => {
        const list = snap.docs.map(d=>({id:d.id,...d.data()} as HandRec))
        list.sort((a,b)=>(b.createdAt?.seconds??0)-(a.createdAt?.seconds??0))
        setHistory(list)
      })
      .catch(e=>{ setHistError(String(e?.message??e)) })
      .finally(()=>setHistLoading(false))
  }, [view,userId,isOpen])

  const setCard = (target:string, card:string|null) => {
    const p=target.split("|")
    if (p[0]==="b"){const i=Number(p[1]);setHtBoard(prev=>{const n=[...prev] as (string|null)[];n[i]=card;return n})}
    else if(p[0]==="c"){const pos=p[1],i=Number(p[2]);setHtCards(prev=>{const cs=prev[pos]?[...prev[pos]]:[null,null] as (string|null)[];cs[i]=card;return{...prev,[pos]:cs}})}
  }
  const getCard = (target:string):string|null => {
    const p=target.split("|")
    if (p[0]==="b") return htBoard[Number(p[1])]??null
    if (p[0]==="c") return htCards[p[1]]?.[Number(p[2])]??null
    return null
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const btnIdx = positions.indexOf("BTN")
  const cx=160, cy=110, rx=126, ry=80

  return (
    <>
      {typeof window!=="undefined" && isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[200]"
            style={{ background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)" }}
            onClick={() => { if (!htSaving){setIsOpen(false);reset()} }} />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-[201] mx-auto max-w-sm flex flex-col"
            style={{ maxHeight:"94vh", background:CLR.bg, borderRadius:"28px 28px 0 0", boxShadow:"0 -2px 32px rgba(0,0,0,0.18)" }}>

            {/* Handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-9 h-[3px] rounded-full" style={{ background:CLR.border }} />
            </div>

            {/* Header */}
            <div className="shrink-0 px-5 pt-2 pb-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-bold" style={{ color:CLR.ink }}>ハンド記録</h2>
                </div>
                <button type="button"
                  onClick={() => { if (!htSaving){setIsOpen(false);reset()} }}
                  className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95"
                  style={{ background:CLR.surface, color:CLR.gray2 }}>
                  <FiX size={15} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex" style={{ borderBottom:`1.5px solid ${CLR.border}` }}>
                {(["record","history"] as const).map(v => (
                  <button key={v} type="button" onClick={() => setView(v)}
                    className="flex-1 pb-2 text-[13px] font-semibold relative transition-colors"
                    style={{ color:view===v?CLR.ink:CLR.gray3 }}>
                    {v==="record"?"記録":"履歴"}
                    {view===v && <span className="absolute bottom-[-1.5px] left-1/4 right-1/4 h-[2px] rounded-full" style={{ background:CLR.gold }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── RECORD VIEW ─────────────────────────────────────────── */}
            {view==="record" && (
              <div className="flex-1 overflow-y-auto">

                {/* Controls — only on preflop */}
                {htStreet === "preflop" && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    {/* Player count */}
                    <div className="flex items-center rounded-2xl overflow-hidden" style={{ border:`1px solid ${CLR.border}`, background:CLR.white }}>
                      <button type="button" onClick={() => setHtCount(c=>Math.max(2,c-1))}
                        className="w-8 h-8 flex items-center justify-center text-[18px] active:scale-90 transition-transform"
                        style={{ color:CLR.gray2 }}>−</button>
                      <span className="text-[12px] font-bold px-1 min-w-[36px] text-center" style={{ color:CLR.ink }}>{htCount}人</span>
                      <button type="button" onClick={() => setHtCount(c=>Math.min(10,c+1))}
                        className="w-8 h-8 flex items-center justify-center text-[18px] active:scale-90 transition-transform"
                        style={{ color:CLR.gray2 }}>+</button>
                    </div>

                    {/* Ante toggle */}
                    <button type="button" onClick={() => setHtAnte(v=>!v)}
                      className="flex items-center gap-2 h-8 px-3 rounded-full text-[11px] font-semibold transition-all active:scale-95"
                      style={{ background:htAnte?'#FFF8E7':CLR.white, color:htAnte?CLR.goldDk:CLR.gray2, border:`1px solid ${htAnte?CLR.gold:CLR.border}` }}>
                      <div style={{ width:26,height:15,borderRadius:99,background:htAnte?CLR.gold:CLR.border,position:'relative',transition:'background 0.2s',flexShrink:0 }}>
                        <div style={{ position:'absolute',width:11,height:11,borderRadius:'50%',background:'#fff',top:2,left:htAnte?13:2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                      {htAnte ? 'アンティあり' : 'アンティなし'}
                    </button>
                  </div>
                )}

                {/* ── Table ── */}
                <div className="relative mx-4 mb-3 rounded-[999px]"
                  style={{ height:220, background:"#F2EDE4", border:`1.5px solid #D8CEBD`, boxShadow:"inset 0 2px 8px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.06)" }}>

                  {/* Inner decorative ring */}
                  <div className="absolute rounded-[999px] pointer-events-none"
                    style={{ inset:8, border:"1px solid rgba(200,185,160,0.35)" }} />

                  {/* Board + pot */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    {htStreet!=="preflop" && (
                      <div className="flex items-center gap-1">
                        {[0,1,2].map(i => {
                          const c=htBoard[i]
                          return (
                            <button key={i} type="button" onClick={() => setHtPick(`b|${i}`)}
                              className="flex flex-col items-center justify-center rounded-lg font-bold active:scale-95 transition-all"
                              style={{ width:24, height:32,
                                background:c?CLR.white:"rgba(255,255,255,0.45)",
                                border:c?`1px solid ${CLR.border}`:"1.5px dashed rgba(170,155,135,0.6)",
                                boxShadow:c?"0 1px 4px rgba(0,0,0,0.1)":"none",
                                color:c?HAND_SUIT_CLR[c.slice(-1)]:"rgba(155,140,115,0.7)" }}>
                              {c?<><span className="text-[9px]">{c.slice(0,-1)}</span><span className="text-[8px]">{HAND_SUIT_SYM[c.slice(-1)]}</span></>:<span className="text-[8px]">?</span>}
                            </button>
                          )
                        })}

                        {(htStreet==="turn"||htStreet==="river") && <>
                          <div className="w-px h-4 mx-0.5" style={{ background:"rgba(170,155,135,0.4)" }} />
                          {(() => {const c=htBoard[3]; return (
                            <button type="button" onClick={() => setHtPick("b|3")}
                              className="flex flex-col items-center justify-center rounded-lg font-bold active:scale-95"
                              style={{ width:24,height:32, background:c?CLR.white:"rgba(255,255,255,0.45)", border:c?`1px solid ${CLR.border}`:"1.5px dashed rgba(170,155,135,0.6)", boxShadow:c?"0 1px 4px rgba(0,0,0,0.1)":"none", color:c?HAND_SUIT_CLR[c.slice(-1)]:"rgba(155,140,115,0.7)" }}>
                              {c?<><span className="text-[9px]">{c.slice(0,-1)}</span><span className="text-[8px]">{HAND_SUIT_SYM[c.slice(-1)]}</span></>:<span className="text-[8px]">?</span>}
                            </button>
                          )})()}
                        </>}

                        {htStreet==="river" && <>
                          <div className="w-px h-4 mx-0.5" style={{ background:"rgba(170,155,135,0.4)" }} />
                          {(() => {const c=htBoard[4]; return (
                            <button type="button" onClick={() => setHtPick("b|4")}
                              className="flex flex-col items-center justify-center rounded-lg font-bold active:scale-95"
                              style={{ width:24,height:32, background:c?CLR.white:"rgba(255,255,255,0.45)", border:c?`1px solid ${CLR.border}`:"1.5px dashed rgba(170,155,135,0.6)", boxShadow:c?"0 1px 4px rgba(0,0,0,0.1)":"none", color:c?HAND_SUIT_CLR[c.slice(-1)]:"rgba(155,140,115,0.7)" }}>
                              {c?<><span className="text-[9px]">{c.slice(0,-1)}</span><span className="text-[8px]">{HAND_SUIT_SYM[c.slice(-1)]}</span></>:<span className="text-[8px]">?</span>}
                            </button>
                          )})()}
                        </>}
                      </div>
                    )}

                    <div className="rounded-full px-2.5 py-0.5" style={{ background:"rgba(29,29,31,0.12)" }}>
                      <span className="text-[9px] font-bold tracking-wide" style={{ color:"rgba(29,29,31,0.55)" }}>
                        POT {pot%1===0?pot:pot.toFixed(1)} BB
                      </span>
                    </div>
                  </div>

                  {/* Action labels near seats */}
                  {positions.filter(p=>!allFolded.has(p)).map(pos => {
                    const pi={x:0,y:0}
                    const posIdx=positions.indexOf(pos)
                    const {x,y}=seatXY(posIdx,positions.length,btnIdx,cx,cy,rx,ry)
                    const dx=cx-x,dy=cy-y,dist=Math.sqrt(dx*dx+dy*dy)||1
                    const bx=x+(dx/dist)*28, by=y+(dy/dist)*28
                    let label:string|null=null, bg="#fff", fg=CLR.gray2, bd=CLR.border
                    if (htStreet==="preflop"&&pos==="SB"){label="SB";fg="#2563EB";bd="#BFDBFE";bg="#EFF6FF"}
                    if (htStreet==="preflop"&&pos==="BB"){label="BB";fg="#2563EB";bd="#BFDBFE";bg="#EFF6FF"}
                    const sActs=htActions.filter(a=>a.street===htStreet&&a.position===pos)
                    const last=sActs[sActs.length-1]
                    if (last&&last.action!=="fold"){
                      const amtS=last.amount!=null?` ${last.amount}`:""
                      label=`${ACT_JP[last.action]}${amtS}`
                      if (last.action==="bet"||last.action==="raise"){fg="#B45309";bd="#FDE68A";bg="#FFFBEB"}
                      else if (last.action==="allin"){fg=CLR.red;bd="#FCA5A5";bg="#FFF5F5"}
                      else {fg=CLR.gray2;bd=CLR.border;bg="#fff"}
                    }
                    if (!label) return null
                    return (
                      <div key={`lbl_${pos}`} className="absolute pointer-events-none"
                        style={{left:bx,top:by,transform:"translate(-50%,-50%)",zIndex:5}}>
                        <div className="rounded-full px-1.5 py-0.5 text-[7px] font-semibold whitespace-nowrap"
                          style={{background:bg,border:`1px solid ${bd}`,color:fg,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                          {label}
                        </div>
                      </div>
                    )
                  })}

                  {/* Seats */}
                  {positions.map((pos,posIdx) => {
                    const isPerm=permFolded.has(pos)
                    const isCurr=currFolded.has(pos)
                    const isFolded=isPerm||isCurr
                    if (isPerm) return null
                    const {x,y}=seatXY(posIdx,positions.length,btnIdx,cx,cy,rx,ry)
                    const isTurn=htQueue[0]===pos&&!isFolded
                    const isSel=htSeat===pos&&!isFolded
                    const isHero=pos===htHero
                    const hasActed=htActions.some(a=>a.street===htStreet&&a.position===pos)
                    const cards=htCards[pos]??[null,null]

                    return (
                      <button key={pos} type="button"
                        onClick={() => tapSeat(pos)}
                        className="absolute flex flex-col items-center active:scale-95 transition-all"
                        style={{ left:x-22, top:y-28, width:44, opacity:isCurr?0.25:1 }}>

                        {/* Turn pulse ring */}
                        {isTurn && (
                          <div className="absolute pointer-events-none" style={{left:2,top:0,width:40,height:40}}>
                            <div className="w-full h-full rounded-full animate-ping"
                              style={{border:`2px solid ${CLR.gold}`,opacity:0.4}} />
                          </div>
                        )}

                        {/* Hero star */}
                        {isHero && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] z-10" style={{color:CLR.gold}}>★</div>}

                        {/* Dealer button */}
                        {pos==="BTN" && (
                          <div className="absolute -right-1.5 -top-0.5 w-4 h-4 rounded-full flex items-center justify-center z-10"
                            style={{background:CLR.white,border:`1px solid ${CLR.border}`,boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
                            <span className="text-[6px] font-black" style={{color:CLR.ink}}>D</span>
                          </div>
                        )}

                        {/* Seat circle */}
                        <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center transition-all"
                          style={{
                            background: isSel||isTurn ? "#FFF8E7" : CLR.white,
                            border: isSel||isTurn ? `2px solid ${CLR.gold}`
                                  : isHero ? `1.5px solid ${CLR.gold}`
                                  : `1.5px solid ${hasActed?"rgba(210,200,185,0.8)":CLR.border}`,
                            boxShadow: isTurn ? `0 0 0 3px rgba(242,169,0,0.18), 0 2px 8px rgba(0,0,0,0.1)`
                                      : `0 1px 4px rgba(0,0,0,0.07)`,
                          }}>
                          <div className="flex gap-[2px]">
                            {[0,1].map(i => (
                              <div key={i} className="rounded flex items-center justify-center font-bold"
                                style={{ width:12,height:16,
                                  background: cards[i]?CLR.white:"rgba(200,190,175,0.35)",
                                  boxShadow: cards[i]?"0 1px 2px rgba(0,0,0,0.1)":"none",
                                  fontSize:6, color:cards[i]?HAND_SUIT_CLR[(cards[i] as string).slice(-1)]:undefined }}>
                                {cards[i]?HAND_SUIT_SYM[(cards[i] as string).slice(-1)]:""}
                              </div>
                            ))}
                          </div>
                        </div>

                        <span className="text-[8px] font-bold mt-0.5 leading-none"
                          style={{ color:isHero?CLR.gold:hasActed&&!isFolded?CLR.gray3:CLR.gray2 }}>
                          {pos}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Queue */}
                {htQueue.length > 0 && (
                  <div className="px-4 mb-2.5 flex items-center gap-1 overflow-x-auto" style={{scrollbarWidth:"none"}}>
                    <span className="text-[10px] font-medium shrink-0" style={{color:CLR.gray3}}>次のアクション</span>
                    <span className="text-[10px] shrink-0" style={{color:CLR.border}}>→</span>
                    {htQueue.map((pos,i) => (
                      <span key={`q_${i}_${pos}`} className="shrink-0 text-[11px] font-bold"
                        style={{ color:i===0?CLR.goldDk:CLR.gray3 }}>
                        {pos}{i<htQueue.length-1&&<span style={{color:CLR.border,fontWeight:400}}> →</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action panel */}
                {htSeat!==null && !permFolded.has(htSeat) && !currFolded.has(htSeat) && (
                  <div className="mx-4 mb-3 rounded-3xl p-4" style={{background:CLR.white,border:`1px solid ${CLR.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold" style={{color:CLR.ink}}>{htSeat}</span>
                        {/* Hero toggle */}
                        <button type="button" onClick={() => setHtHero(htSeat===htHero?null:htSeat)}
                          className="flex items-center gap-1.5 active:scale-95 transition-all"
                          style={{background:'none',border:'none',cursor:'pointer',padding:0}}>
                          <div style={{width:32,height:18,borderRadius:99,background:htSeat===htHero?CLR.gold:CLR.border,position:'relative',transition:'background 0.2s',flexShrink:0}}>
                            <div style={{position:'absolute',width:14,height:14,borderRadius:'50%',background:'#fff',top:2,left:htSeat===htHero?16:2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
                          </div>
                          <span style={{fontSize:10,fontWeight:600,color:htSeat===htHero?CLR.goldDk:CLR.gray3,fontFamily:'inherit'}}>Hero</span>
                        </button>
                      </div>
                      <button type="button" onClick={() => {setHtSeat(null);setHtActType("");setHtActAmt("")}}
                        className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95"
                        style={{background:CLR.surface,color:CLR.gray2}}>
                        <FiX size={13}/>
                      </button>
                    </div>

                    {/* Cards */}
                    <div className="flex gap-2 mb-3">
                      {[0,1].map(i => {
                        const c=htCards[htSeat]?.[i]??null
                        return (
                          <button key={i} type="button" onClick={() => setHtPick(`c|${htSeat}|${i}`)}
                            className="flex flex-col items-center justify-center rounded-2xl font-bold active:scale-95 transition-all"
                            style={{ width:40,height:50,
                              background:c?CLR.white:CLR.surface,
                              border:c?`1.5px solid ${CLR.border}`:`1.5px dashed ${CLR.border}`,
                              boxShadow:c?"0 2px 8px rgba(0,0,0,0.08)":"none",
                              color:c?HAND_SUIT_CLR[c.slice(-1)]:CLR.border }}>
                            {c?<><span className="text-[13px]">{c.slice(0,-1)}</span><span className="text-[11px]">{HAND_SUIT_SYM[c.slice(-1)]}</span></>:<span className="text-[22px] leading-none">?</span>}
                          </button>
                        )
                      })}
                      {(htCards[htSeat]?.[0]||htCards[htSeat]?.[1]) && (
                        <button type="button" onClick={() => setHtCards(prev=>{const n={...prev};delete n[htSeat!];return n})}
                          className="self-center text-[11px] font-medium ml-1 active:scale-95"
                          style={{color:CLR.red}}>クリア</button>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {acts.map(act => {
                        const isSel    = htActType === act
                        const isFold   = act === "fold"
                        const isInstant = !["bet","raise","allin"].includes(act)
                        return (
                          <button key={act} type="button"
                            onClick={() => isInstant ? confirm(act) : setHtActType(isSel ? "" : act)}
                            className="flex-1 min-w-[70px] h-10 rounded-2xl text-[11px] font-bold active:scale-95 transition-all"
                            style={{
                              background: isSel ? (isFold?"#FFF0F0":CLR.gold) : CLR.surface,
                              color:      isSel ? (isFold?CLR.red:CLR.ink)     : CLR.gray2,
                              border:     isSel ? (isFold?`1px solid #FCA5A5`:`1px solid ${CLR.gold}`) : "1px solid transparent",
                            }}>
                            {ACT_JP[act]}
                          </button>
                        )
                      })}
                    </div>

                    {(htActType==="bet"||htActType==="raise"||htActType==="allin") && (
                      <input type="number" value={htActAmt} onChange={e=>setHtActAmt(e.target.value)}
                        placeholder={htActType==="allin"?"チップ数（BB）":"金額（BB）"} autoFocus
                        className="w-full h-10 rounded-2xl px-3 text-[14px] mb-2 outline-none transition-all"
                        style={{background:CLR.surface,border:`1.5px solid ${CLR.border}`,color:CLR.ink}}
                        onFocus={e=>(e.target.style.borderColor=CLR.gold)}
                        onBlur={e=>(e.target.style.borderColor=CLR.border)} />
                    )}

                    {(htActType==="bet"||htActType==="raise"||htActType==="allin") && (
                      <button type="button" onClick={() => confirm()}
                        className="w-full h-10 rounded-2xl text-[13px] font-bold active:scale-95 transition-all"
                        style={{background:htActType==="allin"?CLR.red:CLR.ink,color:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
                        確定
                      </button>
                    )}

                    {/* Per-player note */}
                    {showNoteInput === htSeat ? (
                      <textarea
                        value={htNotes[htSeat]??''}
                        onChange={e => setHtNotes(prev => ({...prev, [htSeat!]: e.target.value}))}
                        placeholder="このプレイヤーについてメモ..."
                        rows={2}
                        autoFocus
                        className="w-full rounded-2xl px-3 py-2 text-[12px] outline-none resize-none mt-2 transition-all"
                        style={{background:CLR.surface,border:`1px solid ${CLR.border}`,color:CLR.ink}}
                        onFocus={e=>(e.target.style.borderColor=CLR.gold)}
                        onBlur={e=>(e.target.style.borderColor=CLR.border)}
                      />
                    ) : (
                      <button type="button" onClick={() => setShowNoteInput(htSeat)}
                        className="flex items-center gap-1 mt-2 active:scale-95 transition-transform"
                        style={{background:'none',border:'none',cursor:'pointer',padding:0,color:htNotes[htSeat]?CLR.goldDk:CLR.gray3,fontSize:11,fontFamily:'inherit'}}>
                        ✏️ {htNotes[htSeat] ? 'メモを編集' : 'メモを追加'}
                      </button>
                    )}
                  </div>
                )}

                {/* Bottom nav: back button + save */}
                <div className="mx-4 mb-6 flex gap-2">
                  {htStreet !== "preflop" && !htSavedId && (
                    <button type="button"
                      onClick={() => goStreet({flop:"preflop",turn:"flop",river:"turn"}[htStreet] as any)}
                      className="h-12 px-4 rounded-2xl text-[15px] font-semibold active:scale-95 transition-all"
                      style={{background:CLR.surface,color:CLR.ink,border:`1px solid ${CLR.border}`}}>←</button>
                  )}
                  {htSavedId ? (
                    <div className="flex-1 space-y-2">
                      <div className="rounded-2xl p-3 text-center" style={{background:"#F0FDF4",border:"1px solid #BBF7D0"}}>
                        <p className="text-[13px] font-bold" style={{color:"#15803D"}}>✓ 保存しました！</p>
                      </div>
                      <button type="button" onClick={() => share(htSavedId!,htTitle)}
                        className="w-full h-11 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 active:scale-95"
                        style={{background:CLR.gold,color:CLR.ink}}>
                        <FiShare2 size={14}/> シェアする
                      </button>
                      <button type="button" onClick={() => {setIsOpen(false);reset()}}
                        className="w-full h-11 rounded-2xl text-[13px] font-medium active:scale-95"
                        style={{background:CLR.surface,color:CLR.ink,border:`1px solid ${CLR.border}`}}>
                        閉じる
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled={htSaving} onClick={handleSaveClick}
                      className="flex-1 h-12 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                      style={{background:`linear-gradient(135deg,${CLR.gold},${CLR.goldDk})`,color:CLR.ink,boxShadow:'0 4px 16px rgba(242,169,0,0.35)'}}>
                      {htSaving ? '保存中...' : '✓ 保存する'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─── HISTORY VIEW ─────────────────────────────────────────── */}
            {view==="history" && (
              <div className="flex-1 overflow-y-auto px-4 pt-2 pb-6">
                {histLoading ? (
                  <div className="flex justify-center py-16">
                    <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{borderColor:`${CLR.gold} transparent ${CLR.gold} ${CLR.gold}`}} />
                  </div>
                ) : histError ? (
                  <div className="mx-auto mt-8 rounded-2xl p-4" style={{background:"#FFF5F5",border:"1px solid #FCA5A5"}}>
                    <p className="text-[12px] font-bold mb-1" style={{color:CLR.red}}>読み込みエラー</p>
                    <p className="text-[10px] break-all" style={{color:CLR.red}}>{histError}</p>
                  </div>
                ) : history.length===0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <span className="text-[44px] mb-3"></span>
                    <p className="text-[15px] font-bold mb-1" style={{color:CLR.ink}}>まだ記録がありません</p>
                    <p className="text-[12px] mb-5" style={{color:CLR.gray3}}>記録タブからハンドを作成できます</p>
                    <button type="button" onClick={() => setView("record")}
                      className="h-10 px-6 rounded-full text-[13px] font-bold active:scale-95"
                      style={{background:CLR.gold,color:CLR.ink}}>記録を始める</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map(h => {
                      const isExp = expandedHandId === h.id
                      const streets = (["preflop","flop","turn","river"] as const).filter(st =>
                        (h.actions??[]).some(a => a.street===st)
                      )
                      const boardCards = [
                        ...(h.board?.flop??[]),
                        ...(h.board?.turn ? [h.board.turn] : []),
                        ...(h.board?.river ? [h.board.river] : []),
                      ]
                      return (
                        <div key={h.id} className="rounded-3xl overflow-hidden" style={{background:CLR.white,border:`1px solid ${CLR.border}`,boxShadow:"0 1px 6px rgba(0,0,0,0.04)"}}>
                          {/* Header row — tap to expand */}
                          <button type="button"
                            onClick={() => setExpandedHandId(isExp ? null : h.id)}
                            className="w-full text-left px-4 pt-3.5 pb-3 flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold truncate" style={{color:CLR.ink}}>{h.title||"ハンドレビュー"}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-bold rounded-full px-1.5 py-px"
                                  style={{background:"#FFF8E7",color:CLR.goldDk}}>{h.heroPosition}</span>
                                {(h.heroCards??[]).map((c,i) => <MiniCard key={i} card={c}/>)}
                                {boardCards.length>0 && <>
                                  <span style={{color:CLR.border,fontSize:10}}>·</span>
                                  {boardCards.map((c,i) => <MiniCard key={i} card={c}/>)}
                                </>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {h.createdAt?.seconds && (
                                <span className="text-[10px]" style={{color:CLR.gray3}}>{fmtDate(h.createdAt.seconds)}</span>
                              )}
                              <span style={{color:CLR.gray3,fontSize:12,transition:'transform 0.2s',display:'inline-block',transform:isExp?'rotate(180deg)':'none'}}>▾</span>
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {isExp && (
                            <div style={{borderTop:`1px solid ${CLR.surface}`}}>
                              {/* Street-by-street action */}
                              <div className="px-4 pt-2 pb-1 space-y-1">
                                {streets.map(st => {
                                  const stActs = (h.actions??[]).filter(a => a.street===st)
                                  return (
                                    <div key={st} className="flex gap-2 items-start">
                                      <span className="text-[9px] font-bold rounded px-1 py-px shrink-0 mt-0.5"
                                        style={{background:CLR.surface,color:CLR.gray2,minWidth:28,textAlign:'center'}}>
                                        {st==="preflop"?"PF":st==="flop"?"F":st==="turn"?"T":"R"}
                                      </span>
                                      <p className="text-[11px] leading-relaxed" style={{color:CLR.gray2}}>
                                        {stActs.map((a,i) => {
                                          const isHeroAct = a.position===h.heroPosition
                                          const amtStr = a.amount!=null ? ` ${a.amount}` : ""
                                          return (
                                            <span key={i}>
                                              {i>0 && <span style={{color:CLR.border}}> · </span>}
                                              <span style={{color:isHeroAct?CLR.goldDk:CLR.gray2,fontWeight:isHeroAct?700:400}}>
                                                {a.position}
                                              </span>
                                              <span style={{color:CLR.gray3}}> {ACT_JP[a.action]}{amtStr}</span>
                                            </span>
                                          )
                                        })}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Notes (per-player) */}
                              {h.notes && Object.keys(h.notes).length>0 && (
                                <div className="px-4 pb-2 space-y-1">
                                  {Object.entries(h.notes).map(([pos, note]) => note ? (
                                    <p key={pos} className="text-[11px]" style={{color:CLR.gray2}}>
                                      <span style={{fontWeight:600,color:pos===h.heroPosition?CLR.goldDk:CLR.gray2}}>{pos}</span>: {note}
                                    </p>
                                  ) : null)}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 px-4 pb-3">
                                <button type="button" onClick={() => share(h.id,h.title)}
                                  className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-bold active:scale-95"
                                  style={{background:CLR.gold,color:CLR.ink}}>
                                  <FiShare2 size={10}/> シェア
                                </button>
                                <button type="button"
                                  onClick={() => { setViewingHand(h); setReplayStep(0); setReplayPlaying(false) }}
                                  className="flex items-center gap-0.5 h-7 px-2.5 rounded-full text-[11px] font-semibold active:scale-95"
                                  style={{background:CLR.surface,color:CLR.gray2,border:`1px solid ${CLR.border}`}}>
                                  詳細 <FiChevronRight size={10}/>
                                </button>
                                <button type="button" onClick={() => setDelConfirmId(h.id)}
                                  className="ml-auto w-7 h-7 rounded-full flex items-center justify-center active:scale-95"
                                  style={{background:CLR.surface,color:CLR.gray3,border:`1px solid ${CLR.border}`}}>
                                  <FiTrash2 size={11}/>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Title popup (before save) */}
            {showTitlePopup && (
              <div className="absolute inset-0 z-10 flex items-end justify-center"
                style={{background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)",borderRadius:"28px 28px 0 0"}}>
                <div className="w-full p-5 rounded-t-3xl" style={{background:CLR.white}}>
                  <p className="text-[16px] font-bold mb-1" style={{color:CLR.ink}}>タイトルをつける</p>
                  <p className="text-[12px] mb-4" style={{color:CLR.gray2}}>後から履歴で探しやすくなります</p>
                  <input value={htTitle} onChange={e=>setHtTitle(e.target.value)}
                    placeholder="例: BTNからの3bet対応"
                    autoFocus
                    className="w-full h-11 rounded-2xl px-3 text-[14px] outline-none mb-4 transition-all"
                    style={{background:CLR.surface,border:`1.5px solid ${CLR.border}`,color:CLR.ink}}
                    onFocus={e=>(e.target.style.borderColor=CLR.gold)}
                    onBlur={e=>(e.target.style.borderColor=CLR.border)} />
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => { setShowTitlePopup(false); save() }}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-medium active:scale-95"
                      style={{background:CLR.surface,color:CLR.gray2,border:`1px solid ${CLR.border}`}}>
                      スキップ
                    </button>
                    <button type="button"
                      onClick={() => { setShowTitlePopup(false); save() }}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-bold active:scale-95"
                      style={{background:`linear-gradient(135deg,${CLR.gold},${CLR.goldDk})`,color:CLR.ink,boxShadow:'0 3px 12px rgba(242,169,0,0.35)'}}>
                      保存
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete confirm overlay */}
            {delConfirmId && (
              <div className="absolute inset-0 z-10 flex items-end justify-center"
                style={{background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)",borderRadius:"28px 28px 0 0"}}>
                <div className="w-full p-5 rounded-t-3xl" style={{background:CLR.white}}>
                  <p className="text-[16px] font-bold mb-1" style={{color:CLR.ink}}>ハンドを削除しますか？</p>
                  <p className="text-[12px] mb-5" style={{color:CLR.gray2}}>この操作は取り消せません。</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDelConfirmId(null)}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-semibold active:scale-95"
                      style={{background:CLR.surface,color:CLR.ink,border:`1px solid ${CLR.border}`}}>
                      キャンセル
                    </button>
                    <button type="button" onClick={() => delHand(delConfirmId)}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-bold text-white active:scale-95"
                      style={{background:CLR.red}}>
                      削除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Card picker ── */}
          {htPick!==null && (
            <>
              <div className="fixed inset-0 z-[209]"
                style={{background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)"}}
                onClick={() => setHtPick(null)} />
              <div className="fixed bottom-1/2 left-1/2 z-[210] -translate-x-1/2 translate-y-1/2 rounded-3xl flex flex-col w-[88%] max-w-sm max-h-[70vh]"
                style={{background:CLR.white,boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
                <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0" style={{borderBottom:`1px solid ${CLR.border}`}}>
                  <p className="text-[14px] font-bold" style={{color:CLR.ink}}>カードを選択</p>
                  <button type="button" onClick={() => setHtPick(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95"
                    style={{background:CLR.surface,color:CLR.gray2}}><FiX size={13}/></button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
                  {HAND_SUITS.map(suit => (
                    <div key={suit} className="flex gap-1 overflow-x-auto pb-1" style={{scrollbarWidth:"none"}}>
                      {HAND_RANKS.map(rank => {
                        const card=`${rank}${suit}`
                        const curr=getCard(htPick)
                        const used=usedCards.has(card)&&curr!==card
                        return (
                          <button key={card} type="button" disabled={used}
                            onClick={() => {
                              const t=htPick!; const cv=getCard(t)
                              if (cv===card){setCard(t,null);setHtPick(null);return}
                              setCard(t,card)
                              const p=t.split("|")
                              if (p[0]==="c"&&p[2]==="0") setHtPick(`c|${p[1]}|1`)
                              else if (p[0]==="b"&&Number(p[1])<2) setHtPick(`b|${Number(p[1])+1}`)
                              else setHtPick(null)
                            }}
                            className="shrink-0 flex flex-col items-center justify-center rounded-2xl font-bold active:scale-95 transition-all"
                            style={{ width:38,height:46,
                              opacity:used?0.2:1,
                              background:curr===card?"#FFF8E7":CLR.white,
                              border:curr===card?`2px solid ${CLR.gold}`:`1.5px solid ${CLR.border}`,
                              boxShadow:curr===card?"0 2px 8px rgba(242,169,0,0.2)":"0 1px 3px rgba(0,0,0,0.06)",
                              color:used?CLR.border:HAND_SUIT_CLR[suit] }}>
                            <span className="text-[12px]">{rank}</span>
                            <span className="text-[10px]">{HAND_SUIT_SYM[suit]}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>,
        document.body
      )}

      {/* ── Hand Replay Popup ── */}
      {typeof window !== "undefined" && viewingHand && createPortal(
        (() => {
          const allActs   = viewingHand.actions ?? []
          const totalSteps = allActs.length
          const shownActs  = allActs.slice(0, replayStep)
          const curAct     = replayStep > 0 ? allActs[replayStep - 1] : null
          const rPositions = viewingHand.playerPositions ?? [...new Set(allActs.map(a => a.position))]
          const rBtnIdx    = rPositions.indexOf("BTN")
          const rcx=160, rcy=100, rrx=126, rry=76

          // per-seat latest action in shownActs
          const seatActMap: Record<string,HAction> = {}
          shownActs.forEach(a => { seatActMap[a.position] = a })

          // folded seats
          const foldedSeats = new Set(shownActs.filter(a=>a.action==="fold").map(a=>a.position))

          // board visibility
          const hasFlopAct  = shownActs.some(a=>a.street==="flop")
          const hasTurnAct  = shownActs.some(a=>a.street==="turn")
          const hasRiverAct = shownActs.some(a=>a.street==="river")
          const flop  = hasFlopAct  ? (viewingHand.board?.flop  ?? []) : []
          const turn  = hasTurnAct  ? (viewingHand.board?.turn  ?? null) : null
          const river = hasRiverAct ? (viewingHand.board?.river ?? null) : null

          const streets = (["preflop","flop","turn","river"] as const).filter(st =>
            allActs.some(a => a.street === st)
          )

          return (
            <>
              <div className="fixed inset-0 z-[220]"
                style={{background:"rgba(0,0,0,0.72)",backdropFilter:"blur(8px)"}}
                onClick={() => setViewingHand(null)} />
              <div className="fixed z-[221] mx-auto max-w-sm flex flex-col rounded-3xl overflow-hidden"
                style={{inset:'5vh 16px 0',maxHeight:'90vh',background:CLR.bg,boxShadow:"0 8px 48px rgba(0,0,0,0.35)"}}>

                {/* Header */}
                <div className="shrink-0 px-5 pt-4 pb-3 flex items-center justify-between" style={{borderBottom:`1px solid ${CLR.border}`}}>
                  <div>
                    <p className="text-[15px] font-bold" style={{color:CLR.ink}}>{viewingHand.title||"ハンドレビュー"}</p>
                    <p className="text-[11px]" style={{color:CLR.gray2}}>
                      {viewingHand.heroPosition} · {rPositions.length}人
                    </p>
                  </div>
                  <button type="button" onClick={() => setViewingHand(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                    style={{background:CLR.surface,color:CLR.gray2}}><FiX size={15}/></button>
                </div>

                {/* Table */}
                <div className="shrink-0 relative mx-4 mt-3 rounded-[999px]"
                  style={{height:204,background:"#F2EDE4",border:"1.5px solid #D8CEBD",boxShadow:"inset 0 2px 8px rgba(0,0,0,0.04)"}}>
                  <div className="absolute rounded-[999px] pointer-events-none" style={{inset:8,border:"1px solid rgba(200,185,160,0.35)"}} />

                  {/* Board */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    {(flop.length>0||turn||river) && (
                      <div className="flex items-center gap-1">
                        {flop.map((c,i) => c ? (
                          <div key={i} className="flex flex-col items-center justify-center rounded-lg font-bold"
                            style={{width:22,height:30,background:CLR.white,border:`1px solid ${CLR.border}`,color:HAND_SUIT_CLR[c.slice(-1)],fontSize:8}}>
                            <span className="text-[9px]">{c.slice(0,-1)}</span><span className="text-[8px]">{HAND_SUIT_SYM[c.slice(-1)]}</span>
                          </div>
                        ) : null)}
                        {turn && <><div style={{width:1,height:16,background:"rgba(170,155,135,0.4)",margin:"0 2px"}}/>
                          <div className="flex flex-col items-center justify-center rounded-lg font-bold"
                            style={{width:22,height:30,background:CLR.white,border:`1px solid ${CLR.border}`,color:HAND_SUIT_CLR[turn.slice(-1)],fontSize:8}}>
                            <span className="text-[9px]">{turn.slice(0,-1)}</span><span className="text-[8px]">{HAND_SUIT_SYM[turn.slice(-1)]}</span>
                          </div></>}
                        {river && <><div style={{width:1,height:16,background:"rgba(170,155,135,0.4)",margin:"0 2px"}}/>
                          <div className="flex flex-col items-center justify-center rounded-lg font-bold"
                            style={{width:22,height:30,background:CLR.white,border:`1px solid ${CLR.border}`,color:HAND_SUIT_CLR[river.slice(-1)],fontSize:8}}>
                            <span className="text-[9px]">{river.slice(0,-1)}</span><span className="text-[8px]">{HAND_SUIT_SYM[river.slice(-1)]}</span>
                          </div></>}
                      </div>
                    )}
                  </div>

                  {/* Seats */}
                  {rPositions.map((pos,posIdx) => {
                    const {x,y} = seatXY(posIdx,rPositions.length,rBtnIdx,rcx,rcy,rrx,rry)
                    const act   = seatActMap[pos]
                    const isFolded = foldedSeats.has(pos)
                    const isCur  = curAct?.position === pos
                    const isHero = pos === viewingHand.heroPosition
                    const hCards = isHero ? (viewingHand.heroCards??[]) : (viewingHand.villainCards?.[pos]??[])
                    return (
                      <div key={pos} className="absolute flex flex-col items-center"
                        style={{left:x-20,top:y-26,width:40,opacity:isFolded?0.25:1,transition:'opacity 0.3s'}}>
                        {/* Pulse ring on current action */}
                        {isCur && (
                          <div className="absolute pointer-events-none" style={{left:0,top:0,width:40,height:40}}>
                            <div className="w-full h-full rounded-full animate-ping"
                              style={{border:`2px solid ${CLR.gold}`,opacity:0.5}}/>
                          </div>
                        )}
                        {isHero && <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] z-10" style={{color:CLR.gold}}>★</div>}
                        {pos==="BTN" && (
                          <div className="absolute -right-1 -top-0.5 w-4 h-4 rounded-full flex items-center justify-center z-10"
                            style={{background:CLR.white,border:`1px solid ${CLR.border}`,fontSize:6,fontWeight:900,color:CLR.ink}}>D</div>
                        )}
                        <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center"
                          style={{
                            background: isCur?"#FFF8E7":CLR.white,
                            border: isCur?`2px solid ${CLR.gold}`:isHero?`1.5px solid ${CLR.gold}`:`1.5px solid ${CLR.border}`,
                            boxShadow: isCur?`0 0 0 3px rgba(242,169,0,0.18)`:undefined,
                          }}>
                          <div className="flex gap-[2px]">
                            {[0,1].map(i => {
                              const c = hCards[i]
                              return (
                                <div key={i} className="rounded flex items-center justify-center font-bold"
                                  style={{width:11,height:15,background:c?CLR.white:"rgba(200,190,175,0.35)",fontSize:5,color:c?HAND_SUIT_CLR[c.slice(-1)]:undefined}}>
                                  {c?HAND_SUIT_SYM[c.slice(-1)]:""}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        {/* Action label */}
                        {act && !isFolded && (
                          <div className="rounded-full px-1 py-px text-[7px] font-semibold mt-0.5 whitespace-nowrap"
                            style={{
                              background:act.action==="bet"||act.action==="raise"?"#FFFBEB":act.action==="allin"?"#FFF5F5":CLR.white,
                              border:`1px solid ${act.action==="bet"||act.action==="raise"?"#FDE68A":act.action==="allin"?"#FCA5A5":CLR.border}`,
                              color:act.action==="bet"||act.action==="raise"?"#B45309":act.action==="allin"?CLR.red:CLR.gray2,
                            }}>
                            {ACT_JP[act.action]}{act.amount!=null?` ${act.amount}`:""}
                          </div>
                        )}
                        <span className="text-[7px] font-bold mt-0.5" style={{color:isHero?CLR.gold:CLR.gray2}}>{pos}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Replay controls */}
                <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-2">
                  <button type="button" onClick={() => { setReplayStep(0); setReplayPlaying(false) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                    style={{background:CLR.surface,color:CLR.gray2,fontSize:13}}>⟪</button>
                  <button type="button" onClick={() => setReplayStep(s => Math.max(0,s-1))}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                    style={{background:CLR.surface,color:CLR.gray2,fontSize:14}}>‹</button>
                  <button type="button" onClick={() => setReplayPlaying(p => !p)}
                    className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
                    style={{background:`linear-gradient(135deg,${CLR.gold},${CLR.goldDk})`,color:CLR.ink,fontSize:16,boxShadow:'0 3px 12px rgba(242,169,0,0.4)'}}>
                    {replayPlaying ? '⏸' : '▶'}
                  </button>
                  <button type="button" onClick={() => setReplayStep(s => Math.min(s+1,totalSteps))}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                    style={{background:CLR.surface,color:CLR.gray2,fontSize:14}}>›</button>
                  <button type="button" onClick={() => { setReplayStep(totalSteps); setReplayPlaying(false) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                    style={{background:CLR.surface,color:CLR.gray2,fontSize:13}}>⟫</button>
                  <span className="text-[11px] ml-1" style={{color:CLR.gray3}}>{replayStep}/{totalSteps}</span>
                </div>

                {/* Action text list — all shown, current highlighted */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                  {streets.map(st => {
                    const stActs = allActs.filter(a => a.street===st)
                    const stLabel = {preflop:"プリフロップ",flop:"フロップ",turn:"ターン",river:"リバー"}[st]
                    return (
                      <div key={st}>
                        <p className="text-[10px] font-bold mb-1.5" style={{color:CLR.gray3}}>{stLabel}</p>
                        <div className="space-y-1">
                          {stActs.map((a, i) => {
                            const globalIdx = allActs.indexOf(a)
                            const isCurrent = globalIdx === replayStep - 1
                            const isFuture  = globalIdx > replayStep - 1
                            const isHeroAct = a.position === viewingHand.heroPosition
                            return (
                              <div key={i} className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all"
                                style={{
                                  background: isCurrent ? '#FFF8E7' : CLR.white,
                                  border: isCurrent ? `1.5px solid ${CLR.gold}` : `1px solid ${CLR.surface}`,
                                  opacity: isCurrent ? 1 : isFuture ? 0.28 : 0.65,
                                }}>
                                <span className="text-[11px] font-bold shrink-0"
                                  style={{color:isHeroAct?CLR.goldDk:CLR.gray2}}>{a.position}</span>
                                <span className="text-[11px]" style={{color:
                                  a.action==="fold"?CLR.gray3:
                                  a.action==="bet"||a.action==="raise"?"#B45309":
                                  a.action==="allin"?CLR.red:CLR.ink}}>
                                  {ACT_JP[a.action]}{a.amount!=null?` ${a.amount} BB`:""}
                                </span>
                                {isCurrent && <span className="ml-auto text-[9px] font-bold rounded-full px-1.5 py-px"
                                  style={{background:CLR.gold,color:CLR.ink}}>NOW</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {/* RRPoker link */}
                  <div className="text-center pt-2 pb-2">
                    <a href="/home" className="text-[11px] font-medium" style={{color:CLR.gray3,textDecoration:'none'}}>
                      Powered by <span style={{color:CLR.goldDk,fontWeight:700}}>RRPOKER</span> ›
                    </a>
                  </div>
                </div>
              </div>
            </>
          )
        })(),
        document.body
      )}

      {typeof window !== "undefined" && itmOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[200]"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            onClick={() => setItmOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[201] mx-auto max-w-sm flex flex-col"
            style={{ maxHeight: "94vh", background: "#F2F2F7", borderRadius: "28px 28px 0 0", boxShadow: "0 -2px 32px rgba(0,0,0,0.18)" }}>

            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-9 h-[3px] rounded-full bg-gray-300" />
            </div>

            <div className="shrink-0 px-5 pt-2 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold" style={{ color: CLR.ink }}>インマネ確率計算機</h2>
                <button type="button" onClick={() => setItmOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                  style={{ background: "rgba(120,120,128,0.16)", color: CLR.ink }}>
                  <FiX size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-3">
              <div className="rounded-2xl px-4 py-3" style={{ background: "#FFF8E7", border: `1px solid ${CLR.gold}44` }}>
                <p className="text-[12px] leading-relaxed" style={{ color: CLR.goldDk }}>
                  あなたの現在のチップ数から、インマネ確率を推定します。あくまで目安であり、スキル差などは考慮していません。
                </p>
              </div>

              <div className="rounded-2xl px-4 py-4 space-y-3" style={{ background: CLR.white, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {([
                  { label: "残りプレイヤー数",   value: itmRemaining, setter: setItmRemaining, placeholder: "例: 20" },
                  { label: "インマネ人数",       value: itmSpots,     setter: setItmSpots,     placeholder: "例: 15" },
                  { label: "自分のチップ数",     value: itmMyChips,   setter: setItmMyChips,   placeholder: "例: 45000" },
                  { label: "アベレージスタック", value: itmAvgStack,  setter: setItmAvgStack,  placeholder: "例: 25000" },
                ] as { label:string; value:string; setter:(v:string)=>void; placeholder:string }[]).map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <p className="text-[11px] font-medium mb-1" style={{ color: CLR.gray2 }}>{label}</p>
                    <input type="number" value={value} onChange={e => setter(e.target.value)}
                      placeholder={placeholder}
                      className="w-full h-11 rounded-2xl px-3 text-[14px] outline-none transition-all"
                      style={{ background: "#F2F2F7", color: CLR.ink, border: "1.5px solid transparent" }}
                      onFocus={e => (e.target.style.borderColor = CLR.gold)}
                      onBlur={e => (e.target.style.borderColor = "transparent")} />
                  </div>
                ))}
              </div>

              {itmResult && (
                <div className="rounded-2xl px-4 py-4" style={{ background: CLR.white, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <p className="text-[11px] font-medium mb-2" style={{ color: CLR.gray2 }}>推定インマネ確率</p>
                  <p className="text-[52px] font-black leading-none mb-4" style={{ color: CLR.gold }}>
                    {itmResult.probability.toFixed(1)}<span className="text-[22px]">%</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { label: "チップ比率",   value: `${itmResult.chipRatio.toFixed(1)}%` },
                      { label: "アベレージ",   value: itmResult.avgStack.toLocaleString() },
                      { label: "アベレージ比", value: `×${itmResult.avgRatio.toFixed(2)}` },
                    ]).map(({ label, value }) => (
                      <div key={label} className="rounded-2xl px-2 py-3 text-center" style={{ background: "#F2F2F7" }}>
                        <p className="text-[10px] mb-0.5" style={{ color: CLR.gray2 }}>{label}</p>
                        <p className="text-[14px] font-bold" style={{ color: CLR.ink }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
