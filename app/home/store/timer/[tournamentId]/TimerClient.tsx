"use client"

import { useEffect, useRef, useState } from "react"
import { FiTrash2, FiEdit3, FiMenu, FiX } from "react-icons/fi"
import { addDoc, serverTimestamp } from "firebase/firestore"
import { useParams } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, onSnapshot, collection, getDocs, deleteDoc } from "firebase/firestore"
import { createPortal } from "react-dom"

// ── Audio ──────────────────────────────────────────────────────────────────
const AudioContextClass =
  typeof window !== "undefined"
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : null

let audioCtx: AudioContext | null = null

function getAudio(): AudioContext | null {
  if (!AudioContextClass) return null
  if (!audioCtx) audioCtx = new AudioContextClass()
  return audioCtx
}

const audioBuffers: Record<string, AudioBuffer | null> = {
  levelup: null, tensec: null, countdown: null,
}

function loadAudioFiles() {
  const ctx = getAudio()
  if (!ctx) return
  ;["levelup", "tensec", "countdown"].forEach(async (name) => {
    try {
      const res = await fetch(`/${name}.mp3`)
      const arr = await res.arrayBuffer()
      audioBuffers[name] = await ctx!.decodeAudioData(arr)
    } catch { }
  })
}

async function playSound(name: string) {
  const ctx = getAudio()
  if (!ctx) return
  try {
    if (ctx.state === "suspended") await ctx.resume()
    const buffer = audioBuffers[name]
    if (!buffer) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
  } catch { }
}

// ── Types ──────────────────────────────────────────────────────────────────
type BlindLevel = { type: "level"; smallBlind: number | null; bigBlind: number | null; ante: number | null; duration: number | null; comment?: string | null}
type BreakLevel = { type: "break"; duration: number | null; comment?: string | null}
type Level = BlindLevel | BreakLevel

// ══════════════════════════════════════════════════════════════════════════
export default function TimerClient() {
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  function unlockAudio() {
    if (audioUnlocked) return
    const ctx = getAudio()
    if (!ctx) return
    ctx.resume().then(() => {
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf; src.connect(ctx.destination); src.start(0)
      setAudioUnlocked(true)
    })
  }

  useEffect(() => { loadAudioFiles() }, [])

  const params = useParams()
  const tournamentId = params.tournamentId as string

  const [storeId, setStoreId] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [levels, setLevels] = useState<Level[]>([{ type: "level", smallBlind: null, bigBlind: null, ante: null, duration: null }])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [duration, setDuration] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [tournamentName, setTournamentName] = useState("")
  const [entry, setEntry] = useState(0)
  const [reentry, setReentry] = useState(0)
  const [addon, setAddon] = useState(0)
  const [bust, setBust] = useState(0)
  const [entryStack, setEntryStack] = useState(0)
  const [reentryStack, setReentryStack] = useState(0)
  const [addonStack, setAddonStack] = useState(0)
  const [prizePool, setPrizePool] = useState<Record<string, { amount: number; text?: string }>>({
    "1": { amount: 0 }, "2": { amount: 0 }, "3": { amount: 0 },
    "4": { amount: 0 }, "5": { amount: 0 }, "6": { amount: 0 },
  })
  const [comment, setComment] = useState("")
  const [blindPresets, setBlindPresets] = useState<any[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>("")
  const [customBlindLevels, setCustomBlindLevels] = useState<Level[] | null>(null)
  const [tournamentBlindPresetId, setTournamentBlindPresetId] = useState<string>("")
  const autoAppliedRef = useRef(false)
  const [editingCommentIdx, setEditingCommentIdx] = useState<number | null>(null)

  // ── Start / pause sound ──────────────────────────────────────────────────
  const prevIsRunningRef = useRef(false)
  const timeRemainingRef = useRef(0)
  useEffect(() => { timeRemainingRef.current = timeRemaining }, [timeRemaining])

  useEffect(() => {
    const wasRunning = prevIsRunningRef.current
    if ((!wasRunning && isRunning || wasRunning && !isRunning) && timeRemainingRef.current > 0) {
      void playSound("levelup")
    }
    prevIsRunningRef.current = isRunning
  }, [isRunning])

  // ── Auto-apply blind preset from tournament data (UI only, no Firestore write) ──
  useEffect(() => {
    if (autoAppliedRef.current) return
    if (!tournamentBlindPresetId || selectedPreset || blindPresets.length === 0) return
    const preset = blindPresets.find((p: any) => p.id === tournamentBlindPresetId)
    if (!preset || !Array.isArray(preset.levels) || preset.levels.length === 0) return
    const lvs = preset.levels
    const firstDur = typeof lvs[0]?.duration === "number" ? lvs[0].duration * 60 : 0
    setSelectedPreset(preset.id)
    setCustomBlindLevels(lvs)
    setCurrentLevelIndex(0)
    setTimeRemaining(firstDur)
    autoAppliedRef.current = true
  }, [tournamentBlindPresetId, blindPresets, selectedPreset])

  // ── Level helpers ────────────────────────────────────────────────────────
  function generateNextLevel(prev: BlindLevel): BlindLevel {
    const sb = Math.max(1, Math.round((prev.smallBlind ?? 0) * 1.5))
    const bb = Math.max(1, Math.round((prev.bigBlind ?? 0) * 1.5))
    return { type: "level", smallBlind: sb, bigBlind: bb, ante: bb, duration: prev.duration }
  }
  function handleBbChange(idx: number, value: number | null) {
    const v = value !== null ? Math.max(1, Math.round(Number(value))) : null
    setLevels(ls => ls.map((lv, i) => i !== idx || lv.type !== "level" ? lv : { ...lv, bigBlind: v, ante: v }))
  }
  function addLevel() {
    const last = [...levels].reverse().find(l => l.type === "level") as BlindLevel | undefined
    if (!last) { setLevels([...levels, { type: "level", smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 }]); return }
    const base: BlindLevel = { type: "level", smallBlind: last.smallBlind ?? 100, bigBlind: last.bigBlind ?? 200, ante: last.bigBlind ?? 200, duration: last.duration ?? 20 }
    setLevels([...levels, generateNextLevel(base)])
  }
  function addBreak() { setLevels([...levels, { type: "break", duration: null }]) }
  function removeLevel(idx: number) { setLevels(ls => ls.filter((_, i) => i !== idx)) }
  function handleDragStart(idx: number) { setDragIndex(idx) }
  function handleDragEnter(idx: number) { setDropIndex(idx) }
  function handleDragEnd() {
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) { setDragIndex(null); setDropIndex(null); return }
    const nl = [...levels]; const [m] = nl.splice(dragIndex, 1); nl.splice(dropIndex, 0, m)
    setLevels(nl); setDragIndex(null); setDropIndex(null)
  }

  // ── Preset CRUD ──────────────────────────────────────────────────────────
  async function savePreset() {
    if (!presetName) { alert("ブラインド名を入力してください"); return }
    if (!storeId) { alert("店舗IDが取得できません"); return }
    if (editingPresetId) {
      await updateDoc(doc(db, "stores", storeId, "blindPresets", editingPresetId), { name: presetName, levels })
    } else {
      await addDoc(collection(db, "stores", storeId, "blindPresets"), { name: presetName, levels, createdAt: new Date() })
    }
    setEditingPresetId(null); setIsPresetModalOpen(false); setEditingCommentIdx(null)
  }

  async function applyPreset(preset: any) {
    if (!storeId) return
    const lvs = Array.isArray(preset.levels) ? preset.levels : []
    if (!lvs.length) return
    const firstDur = typeof lvs[0]?.duration === "number" ? lvs[0].duration * 60 : 0
    await updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), {
      selectedPreset: preset.id, customBlindLevels: lvs,
      currentLevelIndex: 0, startTime: serverTimestamp(), duration: firstDur, timerRunning: false,
    })
    setSelectedPreset(preset.id); setCustomBlindLevels(lvs); setCurrentLevelIndex(0)
  }

  // ── Firebase ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    getDocs(collection(db, "stores", storeId, "blindPresets")).then(snap =>
      setBlindPresets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [storeId, isPresetModalOpen])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      setStoreId(snap.data()?.storeId ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!storeId) return
    const unsub = onSnapshot(doc(db, "stores", storeId, "tournaments", tournamentId), (snap) => {
      const d = snap.data(); if (!d) return
      setComment(d.comment ?? "")
      if (typeof d.timerRunning === "boolean") setIsRunning(d.timerRunning)
      if (typeof d.timeRemaining === "number") setTimeRemaining(d.timeRemaining)
      else if (typeof d.duration === "number") setTimeRemaining(d.duration)
      setTournamentName(d.name ?? "")
      setEntry(d.totalEntry ?? 0); setReentry(d.totalReentry ?? 0); setAddon(d.totalAddon ?? 0); setBust(d.bustCount ?? 0)
      setEntryStack(d.entryStack ?? 0); setReentryStack(d.reentryStack ?? 0); setAddonStack(d.addonStack ?? 0)
      setPrizePool(Object.fromEntries(Object.entries(d.prizePool ?? {}).map(([k, v]: any) => [k, { amount: typeof v?.amount === "number" ? v.amount : 0, text: v?.text ?? "" }])))
      if (typeof d.currentLevelIndex === "number") setCurrentLevelIndex(d.currentLevelIndex)
      if (typeof d.selectedPreset === "string") setSelectedPreset(d.selectedPreset)
      if (Array.isArray(d.customBlindLevels)) setCustomBlindLevels(d.customBlindLevels)
      if (typeof d.blindPresetId === "string") setTournamentBlindPresetId(d.blindPresetId)
    })
    return () => unsub()
  }, [storeId, tournamentId])

  // ── Timer actions ────────────────────────────────────────────────────────
  const updatePrize = async (place: string, value: any) => {
    if (!storeId) return
    await updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), { [`prizePool.${place}`]: value })
  }
  async function pauseTimer() {
    if (!storeId || !startTime) return
    const remaining = Math.max(duration - Math.floor((Date.now() - startTime) / 1000), 0)
    await updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), { duration: remaining, timerRunning: false })
  }
  async function resumeTimer() {
    if (!storeId) return
    await updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), { startTime: serverTimestamp(), timerRunning: true })
  }

  const levelsToUse = Array.isArray(customBlindLevels) ? customBlindLevels : []

  async function skipLevel() {
    if (!storeId) return
    const nextIndex = currentLevelIndex + 1
    const next = levelsToUse[nextIndex]; if (!next) return
    const nextDur = typeof next.duration === "number" ? next.duration * 60 : 0
    await updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), {
      currentLevelIndex: nextIndex, startTime: serverTimestamp(), duration: nextDur, timerRunning: true,
    })
  }

  // ── Countdown interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning || !storeId) return
    const ref = doc(db, "stores", storeId, "tournaments", tournamentId)
    const interval = setInterval(async () => {
      const snap = await getDoc(ref); const d = snap.data(); if (!d) return
      const current = d.timeRemaining ?? 0
      if (current === 11) void playSound("tensec")
      if (current === 4 || current === 3 || current === 2) void playSound("countdown")
      if (current <= 1) {
        if (d.currentLevelIndex < levelsToUse.length - 1) {
          const next = d.currentLevelIndex + 1
          const dur = levelsToUse[next]?.duration
          await updateDoc(ref, { currentLevelIndex: next, timeRemaining: typeof dur === "number" ? dur * 60 : 0 })
          void playSound("levelup")
        } else {
          await updateDoc(ref, { timerRunning: false, timeRemaining: 0 })
        }
        return
      }
      await updateDoc(ref, { timeRemaining: current - 1 })
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, storeId, currentLevelIndex, levelsToUse])

  // ── Derived values ───────────────────────────────────────────────────────
  const totalPlayers = entry + reentry
  const alivePlayers = totalPlayers - bust
  const totalChips = entry * entryStack + reentry * reentryStack + addon * addonStack
  const averageStack = alivePlayers > 0 ? Math.floor(totalChips / alivePlayers) : 0
  const level = levelsToUse[currentLevelIndex] ?? null
  const nextLevel = currentLevelIndex < levelsToUse.length - 1 ? levelsToUse[currentLevelIndex + 1] : level
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const currentLevel = levelsToUse[currentLevelIndex]
  const totalLevelSeconds = typeof currentLevel?.duration === "number" ? currentLevel.duration * 60 : 1
  const progress = totalLevelSeconds > 0 ? (timeRemaining / totalLevelSeconds) * 100 : 0
  const nextBreakSeconds = (() => {
    let total = timeRemaining
    for (let i = currentLevelIndex + 1; i < levelsToUse.length; i++) {
      const lv = levelsToUse[i]
      if (lv.type === "break") break
      if (typeof lv.duration === "number") total += lv.duration * 60
    }
    return total
  })()
  const nextBreakMin = Math.floor(nextBreakSeconds / 60)
  const nextBreakSec = nextBreakSeconds % 60
  const totalPrize = Object.values(prizePool).reduce((a, b) => a + (b.amount ?? 0), 0)
  const isPresetSelected = levelsToUse.length > 0 && level !== null

  // ── Shared input style for modal ─────────────────────────────────────────
  const modalInput = "rounded-xl px-3 py-1.5 text-[13px] text-center text-gray-900 outline-none border border-gray-200 bg-white focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div onClick={unlockAudio} onTouchStart={unlockAudio}>
      <main className="min-h-screen overflow-hidden relative" style={{ background: "#F5F5F7" }}>
        <style>{`
          @keyframes colonBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }
          @keyframes pauseFadeIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
          @keyframes menuSlide { from{transform:translateX(-100%)} to{transform:translateX(0)} }
          .colon-blink { animation: colonBlink 1s step-start infinite; }
          .pause-badge { animation: pauseFadeIn 0.18s ease-out; }
          .side-menu {
            position:fixed; top:0; left:0; bottom:0; width:360px;
            background:#fff;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.04), 4px 0 32px rgba(0,0,0,0.08);
            transform:translateX(-100%);
            transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);
            z-index:100;
          }
          .side-menu.open { transform:translateX(0); }
          .overlay {
            position:fixed; inset:0;
            background:rgba(0,0,0,0.18);
            backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px);
            opacity:0; pointer-events:none;
            transition:opacity 0.28s ease; z-index:99;
          }
          .overlay.open { opacity:1; pointer-events:auto; }
          .timer-num { font-variant-numeric:tabular-nums; }
          .prize-input::-webkit-inner-spin-button,
          .prize-input::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
          .prize-input { -moz-appearance:textfield; }
          @keyframes levelSlideIn { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
          @keyframes commentExpand { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
          .level-item { animation: levelSlideIn 0.18s ease-out; }
          .comment-expand { animation: commentExpand 0.16s ease-out; }
        `}</style>

        {/* Overlay */}
        <div className={`overlay ${isMenuOpen ? "open" : ""}`} onClick={() => setIsMenuOpen(false)} />

        {/* ── Side Menu ─────────────────────────────────────────────────── */}
        <div className={`side-menu ${isMenuOpen ? "open" : ""}`}>
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <p className="text-[15px] font-semibold text-gray-900">ブラインド設定</p>
            <button onClick={() => setIsMenuOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <FiX className="text-[16px] text-gray-600" />
            </button>
          </div>

          <div className="p-5 space-y-2.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 72px)" }}>
            {blindPresets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-2">
                <button type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex-1 py-2.5 px-4 rounded-2xl text-[14px] font-semibold transition-all text-left"
                  style={selectedPreset === preset.id
                    ? { background: "#F2A900", color: "#fff", boxShadow: "0 4px 12px rgba(242,169,0,0.3)" }
                    : { background: "#F5F5F7", color: "#1D1D1F", border: "1px solid rgba(0,0,0,0.06)" }
                  }
                >
                  {preset.name}
                </button>
                <button type="button"
                  className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 transition-colors"
                  onClick={() => { setEditingPresetId(preset.id); setPresetName(preset.name); if (preset.levels) setLevels(preset.levels); setIsPresetModalOpen(true) }}
                >
                  <FiEdit3 className="text-[15px] text-gray-500" />
                </button>
                <button type="button"
                  className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-red-50 transition-colors"
                  onClick={async () => {
                    if (!window.confirm("このプリセットを削除しますか？") || !storeId) return
                    await deleteDoc(doc(db, "stores", storeId, "blindPresets", preset.id))
                    setBlindPresets(prev => prev.filter(p => p.id !== preset.id))
                  }}
                >
                  <FiTrash2 className="text-[15px] text-gray-400 hover:text-red-500 transition-colors" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setIsPresetModalOpen(true)}
              className="w-full py-3 rounded-2xl text-[14px] font-semibold mt-1 transition-all border-2 border-dashed border-[#F2A900]/40 text-[#F2A900] hover:bg-[#F2A900]/5"
            >
              ＋　プリセットを作成
            </button>
          </div>
        </div>

        {/* ── Hamburger ─────────────────────────────────────────────────── */}
        <div className="absolute top-5 left-5 z-10">
          <button onClick={() => setIsMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-200/80 hover:shadow-md transition-all"
          >
            <FiMenu className="text-[18px] text-gray-600" />
          </button>
        </div>

        {/* ── Main Layout ───────────────────────────────────────────────── */}
        <div className="flex h-screen overflow-hidden">

          {/* Left: Timer */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-[900px] space-y-4">

              {/* Tournament name */}
              <p className="text-center text-[20px] font-medium tracking-[0.3em] uppercase text-gray-400">
                {tournamentName || "\u00A0"}
              </p>

              {/* Level badge */}
              <div className="flex justify-center">
                {level?.type === "level" && (
                  <span className="inline-flex items-center px-5 py-1.5 rounded-full text-[13px] font-bold tracking-[0.15em] uppercase bg-[#F2A900]/10 text-[#F2A900]"
                    style={{ border: "1.5px solid rgba(242,169,0,0.3)" }}
                  >
                    LEVEL {currentLevelIndex + 1}
                  </span>
                )}
                {level?.type === "break" && (
                  <span className="inline-flex items-center px-5 py-1.5 rounded-full text-[13px] font-bold tracking-[0.15em] uppercase bg-gray-100 text-gray-500">
                    BREAK TIME
                  </span>
                )}
                {!level && <span className="h-8" />}
              </div>

              {/* Blinds */}
              <div className="text-center">
                {level?.type === "break" ? (
                  <p className="text-[40px] font-light tracking-widest text-gray-300">— B R E A K —</p>
                ) : (
                  <div className="flex items-baseline justify-center gap-3">
                    <span className="text-[30px] font-semibold tracking-[0.25em] uppercase text-gray-500">Blinds</span>
                    <span className="text-[44px] font-light text-gray-700 timer-num">{level?.smallBlind ?? "—"}</span>
                    <span className="text-[28px] font-thin text-gray-500">/</span>
                    <span className="text-[44px] font-light text-gray-700 timer-num">{level?.bigBlind ?? "—"}</span>
                    <span className="text-[25px] font-light text-gray-700 ml-1">(ante {level?.ante ?? "—"})</span>
                  </div>
                )}
              </div>

              {/* Level comment */}
              {isPresetSelected && level?.comment && (
                <div className="text-center">
                  <span
                    className="inline-block text-[32px] font-bold tracking-wide px-8 py-2 rounded-2xl text-[#F2A900]"
                    style={{ background: "rgba(242,169,0,0.1)", border: "1.5px solid rgba(242,169,0,0.2)" }}
                  >
                    {level.comment}
                  </span>
                </div>
              )}

              {/* Next level */}
              <div className="text-center min-h-[28px]">
                {isPresetSelected && nextLevel && (
                  <span className="inline-flex items-center gap-2 text-[30px] font-light text-gray-400">
                    <span className="text-[20px] tracking-[0.3em] uppercase text-gray-400">Next</span>
                    {nextLevel.type === "break"
                      ? "Break"
                      : <span className="timer-num">{nextLevel.smallBlind} / {nextLevel.bigBlind} <span className="text-[25px] text-gray-400">({nextLevel.ante})</span></span>
                    }
                  </span>
                )}
              </div>

              {/* ── Timer card ─────────────────────────────────────────── */}
              <div className="relative rounded-[40px] bg-white overflow-hidden"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)" }}
              >
                {/* Gold top accent line */}
                <div style={{ height: 3, background: "linear-gradient(90deg,#F2A900,#D4910A,#F2A900)", backgroundSize: "200% auto" }} />

                {/* PAUSE overlay */}
                {!isRunning && isPresetSelected && (
                  <div className="pause-badge absolute inset-0 flex items-center justify-center rounded-[40px] z-10"
                    style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                  >
                    <div className="px-14 py-5 rounded-[32px] border-2 border-[#F2A900]/30 bg-white/80"
                      style={{ boxShadow: "0 4px 24px rgba(242,169,0,0.12)" }}
                    >
                      <span className="text-[76px] font-bold tracking-[0.1em] text-[#F2A900]">PAUSE</span>
                    </div>
                  </div>
                )}

                {/* Digits */}
                <div className="py-6 px-8">
                  {isPresetSelected ? (
                    <div className="flex items-center justify-center timer-num">
                      <span className="text-[168px] font-thin leading-none text-[#F2A900]">
                        {minutes.toString().padStart(2, "0")}
                      </span>
                      <span className={`text-[120px] font-thin leading-none text-[#F2A900] mx-1 ${isRunning ? "colon-blink" : "opacity-20"}`}>
                        :
                      </span>
                      <span className="text-[168px] font-thin leading-none text-[#F2A900]">
                        {seconds.toString().padStart(2, "0")}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <span className="text-[80px] font-thin tracking-[0.25em] text-gray-200">WELCOME</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="px-8 pb-6">
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#F0F0F0" }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${progress}%`, background: "linear-gradient(90deg,#D4910A,#F2A900)", boxShadow: "0 0 8px rgba(242,169,0,0.4)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Next break + comment */}
              <div className="text-center space-y-2 pt-1">
                {isPresetSelected && nextLevel && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[20px] font-semibold tracking-[0.25em] uppercase text-gray-400">Next Break:</span>
                    <span className="text-[44px] font-light text-[#F2A900] timer-num">
                      {nextBreakMin.toString().padStart(2, "0")}:{nextBreakSec.toString().padStart(2, "0")}
                    </span>
                  </div>
                )}
                {comment && (
                  <p className="text-[25px] font-light text-[#F2A900] whitespace-pre-wrap">{comment}</p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-center gap-8 pt-2">
                {[
                  { label: "Players", value: `${alivePlayers} / ${totalPlayers}` },
                  { label: "Average", value: averageStack.toLocaleString() },
                  { label: "Add-on",  value: String(addon) },
                ].map((stat, i, arr) => (
                  <div key={stat.label} className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gray-400 mb-0.5">{stat.label}</p>
                      <p className="text-[22px] font-light text-gray-700 timer-num">{stat.value}</p>
                    </div>
                    {i < arr.length - 1 && <div className="h-8 w-px bg-gray-200" />}
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Right: Prize Pool */}
          <div className="w-[320px] flex-shrink-0 p-6 flex flex-col justify-center pb-28">
            <div className="rounded-[28px] bg-white p-5 h-full flex flex-col justify-center"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.04)" }}
            >
              <p className="text-[13px] font-bold tracking-[0.3em] uppercase text-gray-400 mb-5">Prize Pool</p>

              <div className="space-y-2 flex-1">
                {Object.entries(prizePool).map(([place, data], idx, arr) => (
                  <div key={place} className="flex items-center py-2" style={idx !== arr.length - 1 ? { borderBottom: "1px solid #F0F0F0" } : {}}>
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[14px] text-gray-400 w-[30px]">{place}th</span>
                      <input
                        type="number"
                        value={data?.amount ?? ""}
                        onChange={e => updatePrize(place, { ...data, amount: Number(e.target.value) })}
                        className="prize-input flex-1 text-right text-[14px] font-medium text-gray-700 bg-transparent outline-none"
                      />
                    </div>
                    {data?.text && <span className="text-[11px] text-gray-400 ml-1 whitespace-nowrap">+{data.text}</span>}
                  </div>
                ))}
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-400">Total PRIZE :</span>
                  <span className="text-[17px] font-semibold text-[#F2A900]">{totalPrize.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Preset Modal ──────────────────────────────────────────────────── */}
      {isPresetModalOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-[9999] px-4"
          style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        >
          <div className="w-full max-w-lg max-h-[84vh] flex flex-col rounded-[32px] bg-white overflow-hidden"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)" }}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-900 mb-4">ブラインドプリセット作成</h2>
              <label className="block text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-2">プリセット名</label>
              <input
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                className="w-full rounded-2xl px-4 py-2.5 text-[14px] text-gray-900 outline-none border border-gray-200 focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"
                placeholder="例: 通常トーナメント"
              />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <label className="block text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-3">レベルリスト</label>
              <div className="space-y-2">
                {levels.map((lv, idx) => (
                  <div key={idx}
                    className="level-item rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden"
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="cursor-move text-gray-300 text-[16px] select-none">≡</span>
                        {lv.type === "level" ? (
                          <>
                            <span className="text-[11px] font-bold text-gray-500 w-12">Lv {idx + 1}</span>
                            <input type="number" min={1} step={1} value={lv.smallBlind ?? ""} placeholder="SB"
                              onChange={e => {
                                const v = Math.max(1, Math.round(Number(e.target.value)))
                                const bb = Math.max(1, Math.round(v * 2))
                                setLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, smallBlind: v, bigBlind: bb, ante: bb }))
                              }}
                              className={`${modalInput} w-14`} />
                            <span className="text-gray-300 text-[13px]">/</span>
                            <input type="number" min={1} step={1} value={lv.bigBlind ?? ""} placeholder="BB"
                              onChange={e => handleBbChange(idx, Number(e.target.value))}
                              className={`${modalInput} w-14`} />
                            <span className="text-gray-300 text-[13px]">(</span>
                            <input type="number" min={1} step={1} value={lv.ante ?? ""} placeholder="ANTE"
                              onChange={e => setLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, ante: Math.max(1, Math.round(Number(e.target.value))) }))}
                              className={`${modalInput} w-14`} />
                            <span className="text-gray-300 text-[13px]">)</span>
                            <input type="number" min={1} step={1} value={lv.duration ?? ""} placeholder="分"
                              onChange={e => setLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, duration: Math.max(1, Math.round(Number(e.target.value))) }))}
                              className={`${modalInput} w-12`} />
                            <span className="text-[11px] text-gray-400">min</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] font-bold text-gray-500 w-12">Break</span>
                            <input type="number" min={1} step={1} value={lv.duration ?? ""} placeholder="分"
                              onChange={e => setLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, duration: Math.max(1, Math.round(Number(e.target.value))) }))}
                              className={`${modalInput} w-14`} />
                            <span className="text-[11px] text-gray-400">min</span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingCommentIdx(editingCommentIdx === idx ? null : idx)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${lv.comment ? "bg-[#F2A900]/15 text-[#F2A900] border border-[#F2A900]/30" : "bg-gray-200 text-gray-400 hover:bg-gray-300"}`}
                        >
                          {lv.comment ? lv.comment : "＋"}
                        </button>
                      </div>
                      <button onClick={() => removeLevel(idx)}
                        className="ml-1 h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                      >
                        <FiTrash2 size={14} className="text-gray-300 hover:text-red-400 transition-colors" />
                      </button>
                    </div>
                    {(editingCommentIdx === idx || lv.comment) && (
                      <div className="px-3 pb-2.5 flex items-center gap-2 comment-expand">
                        <input
                          type="text"
                          placeholder="コメントを入力..."
                          value={lv.comment ?? ""}
                          onChange={e => setLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, comment: e.target.value || null }))}
                          className="flex-1 text-[12px] rounded-xl px-3 py-1.5 border border-gray-200 bg-white focus:border-[#F2A900] focus:outline-none transition-all"
                          autoFocus={editingCommentIdx === idx}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, comment: null }))
                            setEditingCommentIdx(null)
                          }}
                          className="h-7 w-7 flex-shrink-0 rounded-full bg-gray-200 hover:bg-red-50 flex items-center justify-center transition-colors"
                        >
                          <FiX size={11} className="text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-gray-100 space-y-3">
              <div className="flex gap-2">
                <button onClick={addLevel}
                  className="flex-1 py-2.5 rounded-2xl text-[13px] font-semibold text-[#F2A900] transition-all hover:bg-[#F2A900]/5"
                  style={{ border: "1.5px solid rgba(242,169,0,0.35)" }}
                >
                  ＋ レベル追加
                </button>
                <button onClick={addBreak}
                  className="flex-1 py-2.5 rounded-2xl text-[13px] font-semibold text-blue-500 transition-all hover:bg-blue-50"
                  style={{ border: "1.5px solid rgba(59,130,246,0.3)" }}
                >
                  ＋ ブレイク追加
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={savePreset}
                  className="flex-1 py-3 rounded-2xl text-[14px] font-bold text-white transition-all"
                  style={{ background: "linear-gradient(135deg,#F2A900,#D4910A)", boxShadow: "0 4px 14px rgba(242,169,0,0.28)" }}
                >
                  保存
                </button>
                <button onClick={() => setIsPresetModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-[14px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Glass Logo (unchanged) ─────────────────────────────────────── */}
      <div
        className="
          fixed bottom-8 right-8
          flex items-center gap-4
          px-5 py-3
          rounded-2xl
          bg-white/40 backdrop-blur-xl
          border border-white/50
          shadow-[0_8px_30px_rgba(0,0,0,0.15)]
          z-[200]
        "
      >
        <div
          className="
            h-12 w-12
            rounded-xl
            overflow-hidden
            bg-white
            flex items-center justify-center
            shadow-[0_0_20px_rgba(242,169,0,0.5)]
          "
        >
          <img src="/logo.png" alt="RRPoker" className="h-9 w-9 object-contain" />
        </div>
        <span
          className="
            text-[22px]
            font-bold
            tracking-widest
            text-gray-900
          "
        >
          RRPOKER
        </span>
      </div>

    </div>
  )
}
