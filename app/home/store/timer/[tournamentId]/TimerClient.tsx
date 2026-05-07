"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { FiTrash2, FiEdit3, FiMenu, FiX } from "react-icons/fi"
import { addDoc, serverTimestamp } from "firebase/firestore"
import { useParams } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, onSnapshot, collection, deleteDoc } from "firebase/firestore"
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
  const [tournamentLoaded, setTournamentLoaded] = useState(false)
  const autoAppliedRef = useRef(false)
  const selectedPresetRef = useRef("")
  useEffect(() => { selectedPresetRef.current = selectedPreset }, [selectedPreset])
  const currentLevelIndexRef = useRef(0)
  useEffect(() => { currentLevelIndexRef.current = currentLevelIndex }, [currentLevelIndex])
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

  // ── Auto-apply blind preset from tournament data ────────────────────────
  useEffect(() => {
    if (autoAppliedRef.current) return
    if (!storeId || !tournamentBlindPresetId || blindPresets.length === 0) return
    // Already loaded the correct preset's levels from Firestore
    if (selectedPreset === tournamentBlindPresetId && customBlindLevels && customBlindLevels.length > 0) {
      autoAppliedRef.current = true
      return
    }
    const preset = blindPresets.find((p: any) => p.id === tournamentBlindPresetId)
    if (!preset || !Array.isArray(preset.levels) || preset.levels.length === 0) return
    const lvs = preset.levels as Level[]
    const firstDur = typeof lvs[0]?.duration === "number" ? lvs[0].duration * 60 : 0
    setSelectedPreset(preset.id)
    setCustomBlindLevels(lvs)
    if (timeRemaining === 0) setTimeRemaining(firstDur)
    autoAppliedRef.current = true
    // Firestoreに書き込む: store/page.tsxの次へ/前へボタンが正しいレベル情報を参照できるようにする
    const update: Record<string, any> = { selectedPreset: preset.id, customBlindLevels: lvs }
    if (timeRemaining === 0) update.timeRemaining = firstDur
    void updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), update)
  }, [tournamentBlindPresetId, blindPresets, selectedPreset, customBlindLevels, timeRemaining, storeId])

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
  // Real-time listener: blindPresets の変更をタイマーに即座に反映
  useEffect(() => {
    if (!storeId) return
    const unsub = onSnapshot(collection(db, "stores", storeId, "blindPresets"), (snap) => {
      const presets = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setBlindPresets(presets)
      const current = selectedPresetRef.current
      if (!current) return
      const updated = presets.find((p: any) => p.id === current) as any
      if (!updated || !Array.isArray(updated.levels) || updated.levels.length === 0) return
      const newLevels = updated.levels as Level[]
      setCustomBlindLevels(newLevels)
      // tournament doc を更新: 現在レベルの時間も新しい設定値にリセット
      const levelIdx = currentLevelIndexRef.current
      const newDur = newLevels[levelIdx]?.duration
      const update: Record<string, any> = { customBlindLevels: newLevels }
      if (typeof newDur === "number" && newDur > 0) update.timeRemaining = newDur * 60
      void updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), update)
    })
    return () => unsub()
  }, [storeId])

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
      setTournamentLoaded(true)
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

  const levelsToUse = useMemo<Level[]>(() => {
    if (Array.isArray(customBlindLevels) && customBlindLevels.length > 0) return customBlindLevels
    const presetId = tournamentBlindPresetId || selectedPreset
    if (presetId && blindPresets.length > 0) {
      const preset = blindPresets.find((p: any) => p.id === presetId)
      if (preset && Array.isArray(preset.levels) && preset.levels.length > 0) return preset.levels as Level[]
    }
    return []
  }, [customBlindLevels, tournamentBlindPresetId, selectedPreset, blindPresets])

  async function skipLevel() {
    if (!storeId) return
    const nextIndex = currentLevelIndex + 1
    const next = levelsToUse[nextIndex]; if (!next) return
    const nextDur = typeof next.duration === "number" ? next.duration * 60 : 0
    await updateDoc(doc(db, "stores", storeId, "tournaments", tournamentId), {
      currentLevelIndex: nextIndex, startTime: serverTimestamp(), duration: nextDur, timerRunning: true,
    })
  }

  // ── Keep a ref so the interval always sees the latest levels ────────────
  const levelsToUseRef = useRef<Level[]>([])
  useEffect(() => { levelsToUseRef.current = levelsToUse }, [levelsToUse])

  // ── Countdown interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning || !storeId) return
    const ref = doc(db, "stores", storeId, "tournaments", tournamentId)
    const interval = setInterval(async () => {
      const levels = levelsToUseRef.current
      // Levels not loaded yet — skip tick to avoid false termination
      if (levels.length === 0) return

      const snap = await getDoc(ref); const d = snap.data(); if (!d) return

      // timeRemaining が Firestore に未設定（初回起動）の場合、現在レベルの duration で初期化
      if (typeof d.timeRemaining !== "number") {
        const levelIdx = typeof d.currentLevelIndex === "number" ? d.currentLevelIndex : 0
        const dur = levels[levelIdx]?.duration
        if (typeof dur === "number" && dur > 0) {
          await updateDoc(ref, { timeRemaining: dur * 60 - 1 })
        }
        return
      }

      const current = d.timeRemaining
      const levelIdx = typeof d.currentLevelIndex === "number" ? d.currentLevelIndex : 0
      if (current === 11) void playSound("tensec")
      if (current === 4 || current === 3 || current === 2) void playSound("countdown")
      if (current <= 1) {
        if (levelIdx < levels.length - 1) {
          const next = levelIdx + 1
          const dur = levels[next]?.duration
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
  }, [isRunning, storeId, tournamentId])

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
  const totalPrize = Object.values(prizePool).reduce((a, b) => a + (Number(b?.amount) || 0), 0)
  const isPresetSelected = levelsToUse.length > 0 && level !== null

  // ── Shared input style for modal ─────────────────────────────────────────
  const modalInput = "rounded-xl px-3 py-1.5 text-[13px] text-center text-gray-900 outline-none border border-gray-200 bg-white focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div onClick={unlockAudio} onTouchStart={unlockAudio}>
      <main className="min-h-screen overflow-hidden relative" style={{ background: "#fff" }}>
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
          @keyframes newsFlash {
            0%   { left:-100vw; opacity:0; }
            8%   { left:-100vw; opacity:0; }
            16%  { left:56px;   opacity:1; }
            62%  { left:56px;   opacity:1; }
            72%  { left:100vw;  opacity:0; }
            100% { left:100vw;  opacity:0; }
          }
          .news-ticker { position:absolute; animation:newsFlash 10s ease-in-out infinite; }
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

        {/* ══ Main Layout ══════════════════════════════════════════════════════════ */}
        <div className="flex h-screen">

          {/* ── Left Panel ──────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">

            {/* TOURNAMENT NAME */}
            <div className="flex-none text-center" style={{ padding: "18px 56px 12px" }}>
              <h1 className="text-[56px] font-black tracking-[0.18em] uppercase leading-none text-gray-900">
                {tournamentName || " "}
              </h1>
            </div>

            {/* LEVEL DIVIDER + BLIND COMMENT */}
            <div className="flex-none px-14">
              {isPresetSelected && level?.type === "level" && level?.comment && (
                <p className="text-center text-[22px] font-black tracking-[0.45em] uppercase text-[#F2A900] mb-2">
                  {level.comment}
                </p>
              )}
              <div className="flex items-center gap-5">
                <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, #E8E8E8)" }} />
                {level?.type === "level" && (
                  <span className="text-[22px] font-black tracking-[0.45em] uppercase text-[#F2A900] flex-shrink-0">
                    LEVEL&nbsp;{currentLevelIndex + 1}
                  </span>
                )}
                {level?.type === "break" && (
                  <span className="text-[22px] font-black tracking-[0.45em] uppercase text-gray-400 flex-shrink-0">
                    BREAK
                  </span>
                )}
                {!level && <span className="text-[22px] opacity-0 flex-shrink-0">LEVEL 0</span>}
                <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, #E8E8E8)" }} />
              </div>
            </div>

            {/* TIMER */}
            <div className="flex-none px-14 pt-2 relative">
              {/* PAUSE overlay */}
              {!isRunning && isPresetSelected && (
                <div
                  className="pause-badge absolute inset-0 z-10 flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
                >
                  <span className="text-[86px] font-black tracking-[0.18em] text-[#F2A900]">PAUSE</span>
                </div>
              )}
              {isPresetSelected ? (
                <div className="flex items-center justify-center timer-num">
                  <span className="text-[200px] font-thin leading-none text-[#F2A900]">
                    {minutes.toString().padStart(2, "0")}
                  </span>
                  <span className={`text-[140px] font-thin leading-none text-[#F2A900] mx-2 ${isRunning ? "colon-blink" : "opacity-20"}`}>
                    :
                  </span>
                  <span className="text-[200px] font-thin leading-none text-[#F2A900]">
                    {seconds.toString().padStart(2, "0")}
                  </span>
                </div>
              ) : tournamentLoaded ? (
                <div className="flex items-center justify-center" style={{ padding: "40px 0" }}>
                  <span className="text-[80px] font-thin tracking-[0.25em] text-gray-200">WELCOME</span>
                </div>
              ) : (
                <div className="flex items-center justify-center" style={{ padding: "40px 0" }}>
                  <span className="text-[40px] font-thin tracking-[0.25em] text-gray-200">Loading...</span>
                </div>
              )}
              {/* Progress bar */}
              {isPresetSelected && (
                <div className="w-full rounded-full overflow-hidden" style={{ height: "3px", background: "#F0F0F0", marginTop: "4px" }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${progress}%`, background: "linear-gradient(90deg,#D4910A,#F2A900)" }}
                  />
                </div>
              )}
            </div>

            {/* INFO BLOCK: BLIND / BB ANTE / NEXT / NEXT BREAK */}
            <div className="flex-1 flex flex-col justify-center px-12 py-2">
              {level?.type === "break" ? (
                <p className="text-[60px] font-light tracking-[0.5em] text-gray-200 text-center">— B R E A K —</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "max-content 1fr",
                    columnGap: "64px",
                    rowGap: "clamp(22px, 3.8vh, 52px)",
                    alignItems: "baseline",
                  }}
                >
                  {/* BLIND */}
                  <span className="text-[22px] font-black tracking-[0.15em] uppercase text-gray-600">
                    BLIND
                  </span>
                  <span className="text-[68px] font-light text-gray-800 timer-num leading-none whitespace-nowrap">
                    {level?.smallBlind?.toLocaleString() ?? "—"}&nbsp;/&nbsp;{level?.bigBlind?.toLocaleString() ?? "—"}
                  </span>

                  {/* BB ANTE */}
                  <span className="text-[22px] font-black tracking-[0.15em] uppercase text-gray-600">
                    BB ANTE
                  </span>
                  <span className="text-[68px] font-light text-gray-800 timer-num leading-none">
                    {level?.ante?.toLocaleString() ?? "—"}
                  </span>

                  {/* Separator */}
                  <div style={{ gridColumn: "1 / -1", height: "1px", background: "#E8E8E8" }} />

                  {/* NEXT */}
                  {isPresetSelected && nextLevel && currentLevelIndex < levelsToUse.length - 1 && (
                    <>
                      <span className="text-[22px] font-black tracking-[0.15em] uppercase text-gray-600">
                        NEXT
                      </span>
                      {nextLevel.type === "break"
                        ? <span className="text-[54px] font-light text-gray-500 leading-none">Break</span>
                        : <span className="text-[54px] font-light text-gray-600 timer-num leading-none">
                            {nextLevel.smallBlind?.toLocaleString()}&nbsp;/&nbsp;{nextLevel.bigBlind?.toLocaleString()}
                            <span className="text-[40px] text-gray-400 ml-3">({nextLevel.ante?.toLocaleString()})</span>
                          </span>
                      }
                    </>
                  )}

                  {/* NEXT BREAK */}
                  {isPresetSelected && nextLevel && (
                    <>
                      <span className="text-[22px] font-black tracking-[0.15em] uppercase text-gray-600">
                        NEXT BREAK
                      </span>
                      <span className="text-[54px] font-light text-[#F2A900] timer-num leading-none">
                        {nextBreakMin.toString().padStart(2, "0")}:{nextBreakSec.toString().padStart(2, "0")}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* SEPARATOR */}
            <div
              className="flex-none mx-14"
              style={{ height: "1px", background: "linear-gradient(to right, transparent, #E8E8E8, transparent)" }}
            />

            {/* STATS */}
            <div className="flex-none flex items-center justify-around px-14 py-4">
              {[
                { label: "PLAYERS", value: `${alivePlayers} / ${totalPlayers}` },
                { label: "AVERAGE", value: averageStack.toLocaleString() },
                { label: "ADD-ON",  value: String(addon) },
              ].map((stat, i, arr) => (
                <div key={stat.label} className="flex items-center">
                  <div className="text-center" style={{ padding: "0 32px" }}>
                    <p className="text-[13px] font-black tracking-[0.4em] uppercase text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-[44px] font-light text-gray-700 timer-num">{stat.value}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="h-10 w-px" style={{ background: "#EBEBEB" }} />
                  )}
                </div>
              ))}
            </div>

            {/* NEWS TICKER — payout comment only */}
            {comment && (
              <div
                className="flex-none relative overflow-hidden bg-white"
                style={{ height: "60px", borderTop: "1px solid #EBEBEB" }}
              >
                <div className="h-full flex items-center">
                  <span className="news-ticker whitespace-nowrap text-gray-800 font-bold text-[28px] tracking-[0.06em]">
                    {comment}
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* ── Right Panel: Prize Pool ──────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex flex-col bg-white"
            style={{ width: "380px", borderLeft: "1px solid #F0F0F0" }}
          >
            {/* Header */}
            <div style={{ padding: "36px 36px 24px", borderBottom: "1px solid #F5F5F5" }}>
              <p className="text-[11px] font-black tracking-[0.6em] uppercase text-gray-300 mb-3">Prize Pool</p>
              <div className="flex items-baseline gap-3">
                <span className="text-[15px] font-black tracking-[0.3em] uppercase text-gray-300">TOTAL</span>
                <span className="text-[52px] font-light text-[#F2A900] timer-num leading-none">
                  {totalPrize.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Places */}
            <div className="flex-1 flex flex-col justify-evenly pb-28" style={{ padding: "16px 36px 112px" }}>
              {Object.entries(prizePool).map(([place, data], idx, arr) => (
                <div
                  key={place}
                  className="flex items-center gap-3"
                  style={{
                    paddingTop: "6px",
                    paddingBottom: "6px",
                    borderBottom: idx !== arr.length - 1 ? "1px solid #F8F8F8" : "none",
                  }}
                >
                  <span
                    className="font-black text-gray-800 flex-shrink-0"
                    style={{ width: "52px", fontSize: "24px" }}
                  >
                    {place}<span style={{ fontSize: "15px" }}>th</span>
                  </span>
                  <div className="flex items-center gap-2 flex-1 justify-end overflow-hidden">
                    <input
                      type="number"
                      value={data?.amount ?? ""}
                      onChange={e => updatePrize(place, { ...data, amount: Number(e.target.value) })}
                      className="prize-input text-right font-light text-gray-800 bg-transparent outline-none min-w-0 w-full"
                      style={{ fontSize: "46px", border: "none" }}
                    />
                    {data?.text && (
                      <span
                        className="font-light text-gray-400 whitespace-nowrap flex-shrink-0"
                        style={{ fontSize: "46px" }}
                      >
                        +{data.text}
                      </span>
                    )}
                  </div>
                </div>
              ))}
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