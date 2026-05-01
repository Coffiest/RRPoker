"use client"

import { useMemo, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { db } from "@/lib/firebase"
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore"
import { FiX, FiShare2, FiTrash2, FiClock, FiChevronRight, FiAlertTriangle } from "react-icons/fi"

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
type HandRec  = { id:string; title:string; heroPosition:string; heroCards:string[]; note:string; createdAt?:{seconds?:number} }
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
  const [htAnte,    setHtAnte]    = useState(false)
  const [htActType, setHtActType] = useState("")
  const [htActAmt,  setHtActAmt]  = useState("")
  const [htPick,    setHtPick]    = useState<string|null>(null)
  const [htTitle,   setHtTitle]   = useState("")
  const [htNote,    setHtNote]    = useState("")
  const [htSaving,  setHtSaving]  = useState(false)
  const [htSavedId, setHtSavedId] = useState<string|null>(null)
  const [htStacks,  setHtStacks]  = useState<Record<string,number>>({})

  // history state
  const [history,      setHistory]      = useState<HandRec[]>([])
  const [histLoading,  setHistLoading]  = useState(false)
  const [histError,    setHistError]    = useState<string|null>(null)
  const [delConfirmId, setDelConfirmId] = useState<string|null>(null)

  const positions = useMemo(() => htGetPositions(htCount), [htCount])

  useEffect(() => {
    const init: Record<string,number> = {}
    positions.forEach(p => { init[p] = 100 })
    setHtStacks(init)
  }, [positions])

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

  const reset = () => {
    const dp = htGetPositions(6); const iq = computeOrder("preflop", dp, new Set())
    setHtCount(6); setHtStreet("preflop"); setHtBoard([null,null,null,null,null])
    setHtCards({}); setHtActions([]); setHtQueue(iq); setHtSeat(iq[0]??null)
    setHtHero(null); setHtAnte(false); setHtActType(""); setHtActAmt(""); setHtPick(null)
    setHtTitle(""); setHtNote(""); setHtSaving(false); setHtSavedId(null); setHtStacks({})
  }

  const goStreet = (s: "preflop"|"flop"|"turn"|"river") => { setHtStreet(s); buildQueue(s, htActions, positions) }

  const confirm = () => {
    const seat = htSeat; if (!seat||!htActType) return
    const sActs  = htActions.filter(a => a.street===htStreet)
    const maxBet = sActs.reduce((m,a) => (a.amount!=null?Math.max(m,a.amount):m), 0)
    const stack  = htStacks[seat]??100
    let amount: number|null = null
    if (htActType==="call")               amount = Math.max(0, maxBet)
    else if (htActType==="bet"||htActType==="raise") { const v=Number(htActAmt); if (isNaN(v)||v<=0) return; amount=v }
    else if (htActType==="allin")         amount = stack

    if (amount!=null) setHtStacks(prev => ({...prev,[seat]:Math.max(0,(prev[seat]??0)-amount!)}))
    const newAct: HAction = { street:htStreet, position:seat, action:htActType }
    if (amount!=null) newAct.amount = amount
    const newActions = [...htActions.filter(a => !(a.street===htStreet&&a.position===seat)), newAct]
    setHtActions(newActions)

    let nq: string[]
    if (htActType==="fold") {
      const ncf = new Set(currFolded); ncf.add(seat)
      nq = htQueue.slice(1).filter(p => !new Set([...permFolded,...ncf]).has(p))
    } else if (htActType==="bet"||htActType==="raise") {
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
        actions:allActs, note:htNote.trim(),
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
      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-[88px] right-4 z-[70] flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5"
          style={{ background:"rgba(29,29,31,0.72)", backdropFilter:"blur(12px)" }}>
          <FiAlertTriangle size={9} style={{ color:CLR.gold, flexShrink:0 }} />
          <span className="text-[10px] font-medium" style={{ color:"rgba(255,255,255,0.65)" }}>開発中・バグが多い</span>
        </div>
        <button type="button"
          onClick={() => { reset(); setView("record"); setIsOpen(true) }}
          className="flex items-center gap-2 rounded-full active:scale-95 transition-all"
          style={{ background:CLR.ink, padding:"12px 20px", boxShadow:"0 4px 20px rgba(0,0,0,0.25)" }}>
          <span className="font-black rounded text-[8px] px-1 py-px tracking-widest leading-snug"
            style={{ border:`1px solid ${CLR.gold}`, color:CLR.gold }}>β版</span>
          <span className="text-[13px] font-semibold text-white">ハンド記録</span>
        </button>
      </div>

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
                  <span className="font-black text-[8px] rounded px-1 py-px tracking-widest"
                    style={{ border:`1px solid ${CLR.gold}`, color:CLR.gold }}>β</span>
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

                {/* Controls */}
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

                  {/* Ante */}
                  <button type="button" onClick={() => setHtAnte(v=>!v)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold transition-all active:scale-95"
                    style={{ background:htAnte?CLR.gold:CLR.white, color:htAnte?CLR.ink:CLR.gray2, border:`1px solid ${htAnte?CLR.gold:CLR.border}` }}>
                    アンティ
                  </button>

                  {/* Street tabs */}
                  <div className="ml-auto flex rounded-2xl overflow-hidden" style={{ border:`1px solid ${CLR.border}`, background:CLR.white }}>
                    {(["preflop","flop","turn","river"] as const).map(s => {
                      const lbl={preflop:"PF",flop:"F",turn:"T",river:"R"}
                      const ok=s==="preflop"||s==="flop"||(s==="turn"&&htBoard.slice(0,3).every(c=>c))||(s==="river"&&!!htBoard[3])
                      return (
                        <button key={s} type="button" onClick={() => ok&&s!==htStreet&&goStreet(s)}
                          className="w-8 h-8 text-[10px] font-bold transition-all"
                          style={{ background:htStreet===s?CLR.ink:"transparent", color:htStreet===s?"#fff":ok?CLR.gray2:CLR.border }}>
                          {lbl[s]}
                        </button>
                      )
                    })}
                  </div>
                </div>

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
                        onClick={() => { if(!isFolded){setHtSeat(isSel?null:pos);setHtActType("");setHtActAmt("")} }}
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
                {htQueue.length===0 && htActions.some(a=>a.street===htStreet) && (
                  <p className="px-4 mb-2.5 text-[11px] font-semibold" style={{color:CLR.goldDk}}>
                    アクション完了 — 次のストリートへ進めます
                  </p>
                )}

                {/* Action panel */}
                {htSeat!==null && !permFolded.has(htSeat) && !currFolded.has(htSeat) && (
                  <div className="mx-4 mb-3 rounded-3xl p-4" style={{background:CLR.white,border:`1px solid ${CLR.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold" style={{color:CLR.ink}}>{htSeat}</span>
                        <button type="button" onClick={() => setHtHero(htSeat===htHero?null:htSeat)}
                          className="text-[10px] font-semibold h-6 px-2.5 rounded-full active:scale-95 transition-all"
                          style={{ background:htSeat===htHero?"#FFF8E7":CLR.surface, color:htSeat===htHero?CLR.goldDk:CLR.gray2, border:`1px solid ${htSeat===htHero?CLR.gold:CLR.border}` }}>
                          {htSeat===htHero?"★ Hero":"Hero"}
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
                        const isSel=htActType===act
                        const isFold=act==="fold"
                        return (
                          <button key={act} type="button" onClick={() => setHtActType(isSel?"":act)}
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

                    {(htActType==="bet"||htActType==="raise") && (
                      <input type="number" value={htActAmt} onChange={e=>setHtActAmt(e.target.value)}
                        placeholder="金額（BB）" autoFocus
                        className="w-full h-10 rounded-2xl px-3 text-[14px] mb-2 outline-none transition-all"
                        style={{background:CLR.surface,border:`1.5px solid ${CLR.border}`,color:CLR.ink}}
                        onFocus={e=>(e.target.style.borderColor=CLR.gold)}
                        onBlur={e=>(e.target.style.borderColor=CLR.border)} />
                    )}

                    {htActType && (
                      <button type="button" onClick={confirm}
                        className="w-full h-10 rounded-2xl text-[13px] font-bold active:scale-95 transition-all"
                        style={{background:CLR.ink,color:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
                        確定
                      </button>
                    )}
                  </div>
                )}

                {/* Title */}
                <div className="mx-4 mb-2.5">
                  <input value={htTitle} onChange={e=>setHtTitle(e.target.value)}
                    placeholder="タイトル（任意）"
                    className="w-full h-10 rounded-2xl px-3 text-[13px] outline-none transition-all"
                    style={{background:CLR.white,border:`1px solid ${CLR.border}`,color:CLR.ink}}
                    onFocus={e=>(e.target.style.borderColor=CLR.gold)}
                    onBlur={e=>(e.target.style.borderColor=CLR.border)} />
                </div>

                {/* Street nav */}
                <div className="mx-4 mb-3 flex gap-2">
                  {htStreet!=="preflop" && (
                    <button type="button"
                      onClick={() => goStreet({flop:"preflop",turn:"flop",river:"turn"}[htStreet] as any)}
                      className="h-11 px-4 rounded-2xl text-[13px] font-semibold active:scale-95 transition-all"
                      style={{background:CLR.surface,color:CLR.ink,border:`1px solid ${CLR.border}`}}>←</button>
                  )}
                  {htStreet==="preflop" && (
                    <button type="button" onClick={() => {goStreet("flop");setHtPick("b|0")}}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-bold active:scale-95 transition-all"
                      style={{background:CLR.gold,color:CLR.ink}}>フロップへ →</button>
                  )}
                  {htStreet==="flop" && (
                    <button type="button" onClick={() => {goStreet("turn");if(!htBoard[3])setHtPick("b|3")}}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-bold active:scale-95 transition-all"
                      style={{background:CLR.gold,color:CLR.ink}}>ターンへ →</button>
                  )}
                  {htStreet==="turn" && (
                    <button type="button" onClick={() => {goStreet("river");if(!htBoard[4])setHtPick("b|4")}}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-bold active:scale-95 transition-all"
                      style={{background:CLR.gold,color:CLR.ink}}>リバーへ →</button>
                  )}
                  {htStreet==="river" && !htSavedId && (
                    <button type="button" onClick={save} disabled={htSaving}
                      className="flex-1 h-11 rounded-2xl text-[13px] font-bold text-white active:scale-95 disabled:opacity-50"
                      style={{background:CLR.ink}}>
                      {htSaving?"保存中...":"完了・保存"}
                    </button>
                  )}
                </div>

                {/* Note + save */}
                <div className="mx-4 mb-6">
                  <textarea value={htNote} onChange={e=>setHtNote(e.target.value)}
                    placeholder="メモ（任意）" rows={2}
                    className="w-full rounded-2xl px-4 py-3 text-[13px] outline-none resize-none mb-2 transition-all"
                    style={{background:CLR.white,border:`1px solid ${CLR.border}`,color:CLR.ink}}
                    onFocus={e=>(e.target.style.borderColor=CLR.gold)}
                    onBlur={e=>(e.target.style.borderColor=CLR.border)} />

                  {htSavedId ? (
                    <div className="space-y-2">
                      <div className="rounded-2xl p-3 text-center" style={{background:"#F0FDF4",border:"1px solid #BBF7D0"}}>
                        <p className="text-[13px] font-bold" style={{color:"#15803D"}}> 保存しました！</p>
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
                  ) : htStreet!=="river" && (
                    <button type="button" disabled={htSaving} onClick={save}
                      className="w-full h-11 rounded-2xl text-[13px] font-bold text-white disabled:opacity-50 active:scale-95"
                      style={{background:CLR.ink}}>
                      {htSaving?"保存中...":"保存する"}
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
                    {history.map(h => (
                      <div key={h.id} className="rounded-3xl p-4" style={{background:CLR.white,border:`1px solid ${CLR.border}`,boxShadow:"0 1px 6px rgba(0,0,0,0.04)"}}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-[14px] font-bold truncate flex-1" style={{color:CLR.ink}}>{h.title||"ハンドレビュー"}</p>
                          {h.createdAt?.seconds && (
                            <span className="text-[10px] shrink-0 flex items-center gap-0.5" style={{color:CLR.gray3}}>
                              <FiClock size={9}/> {fmtDate(h.createdAt.seconds)}
                            </span>
                          )}
                        </div>
                        <span className="inline-block text-[10px] font-bold rounded-full px-2 py-0.5 mb-2"
                          style={{background:"#FFF8E7",color:CLR.goldDk}}>
                          {h.heroPosition}
                        </span>
                        {(h.heroCards??[]).length>0 && (
                          <div className="flex gap-1 mb-3">
                            {(h.heroCards??[]).map((c,i) => <MiniCard key={i} card={c}/>)}
                          </div>
                        )}
                        {h.note && <p className="text-[11px] mb-2 line-clamp-2" style={{color:CLR.gray2}}>{h.note}</p>}
                        <div className="flex items-center gap-1.5 pt-1" style={{borderTop:`1px solid ${CLR.surface}`}}>
                          <button type="button" onClick={() => share(h.id,h.title)}
                            className="flex items-center gap-1 h-8 px-3 rounded-full text-[11px] font-bold active:scale-95"
                            style={{background:CLR.gold,color:CLR.ink}}>
                            <FiShare2 size={10}/> シェア
                          </button>
                          <a href={`/hand/${h.id}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-0.5 h-8 px-3 rounded-full text-[11px] font-semibold"
                            style={{background:CLR.surface,color:CLR.gray2,border:`1px solid ${CLR.border}`}}>
                            詳細 <FiChevronRight size={10}/>
                          </a>
                          <button type="button" onClick={() => setDelConfirmId(h.id)}
                            className="ml-auto w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                            style={{background:CLR.surface,color:CLR.gray3,border:`1px solid ${CLR.border}`}}>
                            <FiTrash2 size={12}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
    </>
  )
}
