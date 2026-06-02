"use client"

import { useEffect, useRef, useState } from "react"
import {
  collection, onSnapshot, doc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore"
import { db, auth, storage } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import StoreBottomNav from "@/components/StoreBottomNav"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import {
  FiPlus, FiSettings, FiTrash2, FiX, FiCamera,
  FiCalendar, FiClock, FiAward, FiCopy, FiRepeat, FiSearch, FiZap, FiMoreHorizontal
} from "react-icons/fi"
import { createPortal } from "react-dom"

// ── Level types (shared with TimerClient) ──────────────────────────────────
type BlindLevel = { type: "level"; smallBlind: number | null; bigBlind: number | null; ante: number | null; duration: number | null; comment?: string | null}
type BreakLevel  = { type: "break"; duration: number | null; comment?: string | null}
type Level = BlindLevel | BreakLevel

const DAYS = ["日", "月", "火", "水", "木", "金", "土"] as const
type DayChar = typeof DAYS[number]

function getDOW(dateStr: string): number {
  if (!dateStr) return -1
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).getDay()
}

function getNextWeekdayDate(dow: number): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = (dow - today.getDay() + 7) % 7
  const next = new Date(today)
  next.setDate(today.getDate() + (diff === 0 ? 7 : diff))
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`
}

function todayStr(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
}

const emptyForm = {
  name: "", date: "", startTime: "", rcTime: "",
  entryFee: "", reentryFee: "", addonFee: "",
  entryStack: "", reentryStack: "", addonStack: "", flyerUrl: ""
}

const emptyBlindLevel: Level = { type: "level", smallBlind: null, bigBlind: null, ante: null, duration: null }

// ── AI ストラクチャー生成アルゴリズム ────────────────────────────────────────
const AI_CHIP_OPTIONS = [1, 5, 10, 25, 50, 100, 500, 1000, 5000]
const AI_CLEAN_BLINDS = [5,10,15,20,25,30,40,50,75,100,150,200,300,400,500,600,800,1000,1200,1500,2000,2500,3000,4000,5000,6000,8000,10000,12000,15000,20000,25000,30000,40000,50000]

function aiRoundBB(target: number, minChip: number): number {
  const valid = AI_CLEAN_BLINDS.filter(v => v % minChip === 0)
  if (!valid.length) return Math.round(target / minChip) * minChip
  return valid.reduce((p, c) => Math.abs(c - target) < Math.abs(p - target) ? c : p)
}
function aiSB(bb: number, minChip: number): number {
  return Math.max(minChip, Math.floor(bb / 2 / minChip) * minChip)
}
function aiSimulate(lt: number, available: number) {
  let clock = 0, play = 0, count = 0, lastBreak = 0
  const breaks: number[] = []
  while (clock + lt <= available) {
    clock += lt; play += lt; count++
    if (play >= 90 && count - lastBreak >= 4 && clock + 5 <= available) {
      breaks.push(count); clock += 5; play = 0; lastBreak = count
    }
  }
  return { n: count, breaks, time: clock }
}
function aiBestLT(available: number): number {
  let best = 15, bestScore = Infinity
  for (const lt of [8,10,15,20,25,30]) {
    const { n, time } = aiSimulate(lt, available)
    if (n < 2) continue
    const score = (available - time) * 10 + Math.abs(lt - 20)
    if (score < bestScore) { bestScore = score; best = lt }
  }
  return best
}
function aiGenerate(chips: number[], stack: number, rcHours: number): Level[] {
  if (!chips.length || stack <= 0 || rcHours <= 0) return []
  const sorted = [...chips].sort((a, b) => a - b)
  const min = sorted[0]
  const available = rcHours * 60 - 10
  if (available <= 0) return []
  const lt = aiBestLT(available)
  const { n, breaks } = aiSimulate(lt, available)
  if (!n) return []
  const targetBB = aiRoundBB(stack / 10, min)
  const startBB = aiRoundBB(min * 2, min)
  const mult = n > 0 ? Math.pow(Math.max(targetBB / startBB, 1.01), 1 / n) : 1
  const brkSet = new Set(breaks)
  const levels: Level[] = []
  let prevBB = 0
  for (let i = 0; i < n; i++) {
    let bb = aiRoundBB(startBB * Math.pow(mult, i), min)
    if (bb <= prevBB) bb = AI_CLEAN_BLINDS.find(v => v % min === 0 && v > prevBB) ?? prevBB + min * 2
    prevBB = bb
    levels.push({ type: "level", smallBlind: aiSB(bb, min), bigBlind: bb, ante: null, duration: lt })
    if (brkSet.has(i + 1)) levels.push({ type: "break", duration: 5 })
  }
  levels.push({ type: "break", duration: 10 })
  let postPrev = prevBB
  for (let i = 0; i < 10; i++) {
    let bb = i === 0 ? Math.max(targetBB, prevBB + min) : aiRoundBB(targetBB * Math.pow(mult, i), min)
    if (bb <= postPrev) bb = AI_CLEAN_BLINDS.find(v => v % min === 0 && v > postPrev) ?? postPrev + min * 2
    postPrev = bb
    levels.push({ type: "level", smallBlind: aiSB(bb, min), bigBlind: bb, ante: null, duration: lt })
  }
  return levels
}

function fmtChip(amount: number, unit?: string, before?: boolean): string {
  if (!unit) return amount.toLocaleString()
  return before ? `${unit}${amount.toLocaleString()}` : `${amount.toLocaleString()}${unit}`
}

export default function TournamentsPage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [chipUnit, setChipUnit] = useState("")
  const [chipUnitBefore, setChipUnitBefore] = useState(false)
  const [tournaments, setTournaments] = useState<any[]>([])
  const [entriesMap, setEntriesMap] = useState<any>({})
  const [blindPresets, setBlindPresets] = useState<any[]>([])

  // Tournament modal
  const [openModal, setOpenModal] = useState(false)
  const [editData, setEditData] = useState<any | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [blindPresetId, setBlindPresetId] = useState("")
  const [form, setForm] = useState(emptyForm)

  // Blind preset modal
  const [isBlindModalOpen, setIsBlindModalOpen] = useState(false)
  const [blindModalView, setBlindModalView] = useState<"list" | "edit">("list")
  const [editingBlindPresetId, setEditingBlindPresetId] = useState<string | null>(null)
  const [blindPresetName, setBlindPresetName] = useState("")
  const [blindLevels, setBlindLevels] = useState<Level[]>([{ ...emptyBlindLevel }])
  const [blindEditingCommentIdx, setBlindEditingCommentIdx] = useState<number | null>(null)
  const [blindDragIndex, setBlindDragIndex] = useState<number | null>(null)
  const [blindDropIndex, setBlindDropIndex] = useState<number | null>(null)
  const [blindContextMenuIdx, setBlindContextMenuIdx] = useState<number | null>(null)
  const [bulkDuration, setBulkDuration] = useState("")
  // ── Responsive scale constants (design bases) ─────────────────────────
  const BLIND_MODAL_W = 560
  const BLIND_MODAL_H = 720
  const TOURN_MODAL_W = 448
  const TOURN_MODAL_H = 700
  const AI_MODAL_W = 390
  const AI_MODAL_H = 580

  const [blindModalScale, setBlindModalScale] = useState(1)
  const [tournModalScale, setTournModalScale] = useState(1)
  const [aiModalScale, setAiModalScale] = useState(1)
  // Header buttons (+ Blind / + New) shrink to fit narrow viewports
  const [headerBtnScale, setHeaderBtnScale] = useState(1)
  // Day/history tab bar scales down so all 8 tabs are always visible without clipping
  const [tabBarScale, setTabBarScale] = useState(1)

  // Single resize listener that keeps all scales in sync
  useEffect(() => {
    function computeScales() {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const contentW = vw - 32  // subtract 2 × 16px horizontal padding

      setBlindModalScale(Math.min(1, vw / BLIND_MODAL_W, vh / BLIND_MODAL_H))
      setTournModalScale(Math.min(1, (vw - 32) / TOURN_MODAL_W, (vh - 40) / TOURN_MODAL_H))
      setAiModalScale(Math.min(1, vw / AI_MODAL_W, (vh * 0.92) / AI_MODAL_H))

      // Header: title occupies ~160px, leave the rest for the two buttons (~210px natural width)
      const TITLE_W = 160
      const GAP_W  = 16
      const BTN_NATURAL_W = 215  // "+ Blind" + gap + "+ New" at full size
      const btnAvailable = contentW - TITLE_W - GAP_W
      setHeaderBtnScale(Math.min(1, btnAvailable / BTN_NATURAL_W))

      // Tab bar: 8 tabs × 44px + 7 gaps × 10px = 422px natural width
      const TAB_NATURAL_W = 8 * 44 + 7 * 10
      setTabBarScale(Math.min(1, contentW / TAB_NATURAL_W))
    }
    computeScales()
    window.addEventListener("resize", computeScales)
    return () => window.removeEventListener("resize", computeScales)
  }, [])

  // AI struct generator
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [aiView, setAiView] = useState<"input" | "preview">("input")
  const [aiPresetName, setAiPresetName] = useState("")
  const [aiChips, setAiChips] = useState<number[]>([25, 100, 500])
  const [aiStack, setAiStack] = useState("")
  const [aiRcHours, setAiRcHours] = useState("")
  const [aiPreviewLevels, setAiPreviewLevels] = useState<Level[]>([])
  const [aiError, setAiError] = useState("")

  // UI state
  const [activeTab, setActiveTab] = useState<string>(() => DAYS[new Date().getDay()])
  const [startingId, setStartingId] = useState<string | null>(null)
  const [historySearch, setHistorySearch] = useState("")

  const generatingTemplates = useRef<Set<string>>(new Set())

  const bModalInput = "rounded-xl px-3 py-1.5 text-[13px] text-center text-gray-900 outline-none border border-gray-200 bg-white focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"

  // ── Auth ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      const sid = snap.data()?.storeId ?? null
      setStoreId(sid)
      if (sid) {
        const storeSnap = await getDoc(doc(db, "stores", sid))
        const sd = storeSnap.data()
        const label = sd?.chipUnitLabel
        setChipUnit(label === "単位なし" ? "" : (label ?? ""))
        setChipUnitBefore(sd?.chipUnitBefore !== false)
      }
    })
    return () => unsub()
  }, [])

  // ── Fetch blind presets ────────────────────────────────────────────────
  const refreshPresets = async (sid: string) => {
    const snap = await getDocs(collection(db, "stores", sid, "blindPresets"))
    setBlindPresets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => {
    if (!storeId) return
    refreshPresets(storeId)
  }, [storeId])

  // ── Fetch tournaments ──────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    const refCol = collection(db, "stores", storeId, "tournaments")
    const unsub = onSnapshot(refCol, async (snap) => {
      const normalize = (v: any) => {
        if (v?.toDate) return v.toDate()
        if (typeof v === "object" && v !== null && typeof v.seconds === "number") return new Date(v.seconds * 1000)
        return v
      }
      const list: any[] = []
      snap.forEach((d) => {
        const data = d.data()
        list.push({
          id: d.id,
          name: data.name ?? "",
          status: data.status ?? "",
          startTime: typeof data.startTime === "string" ? data.startTime : "",
          date: typeof data.date === "string" ? data.date : "",
          rcTime: typeof data.rcTime === "string" ? data.rcTime : "",
          entryFee: data.entryFee ?? 0,
          reentryFee: data.reentryFee ?? 0,
          addonFee: data.addonFee ?? 0,
          entryStack: data.entryStack ?? 0,
          reentryStack: data.reentryStack ?? 0,
          addonStack: data.addonStack ?? 0,
          flyerUrl: typeof data.flyerUrl === "string" ? data.flyerUrl : "",
          bustCount: data.bustCount ?? 0,
          repeatWeekly: data.repeatWeekly ?? false,
          blindPresetId: typeof data.blindPresetId === "string" ? data.blindPresetId : "",
          templateId: typeof data.templateId === "string" ? data.templateId : undefined,
          createdAt: normalize(data.createdAt)?.toLocaleDateString?.() ?? "",
          startedAt: normalize(data.startedAt)?.toLocaleDateString?.() ?? "",
          payouts: Array.isArray(data.payouts)
            ? data.payouts.map((p: any) => ({ playerId: p.playerId ?? "", rank: p.rank ?? 0, amount: p.amount ?? 0 }))
            : []
        })
      })
      setTournaments(list)
      const map: any = {}
      for (const t of list) {
        const entriesSnap = await getDocs(collection(db, "stores", storeId, "tournaments", t.id, "entries"))
        map[t.id] = entriesSnap.docs.map(d => {
          const data = d.data()
          return { id: d.id, name: typeof data.name === "string" ? data.name : "", entryCount: data.entryCount ?? 0, reentryCount: data.reentryCount ?? 0, addonCount: data.addonCount ?? 0 }
        })
      }
      setEntriesMap(map)
    })
    return () => unsub()
  }, [storeId])

  // ── Auto-generate next instance when repeat template finishes ──────────
  useEffect(() => {
    if (!storeId || tournaments.length === 0) return
    const repeatTemplates = tournaments.filter(t => t.repeatWeekly === true && t.status === "finished")
    for (const template of repeatTemplates) {
      if (generatingTemplates.current.has(template.id)) continue
      const alreadyScheduled = tournaments.some(
        t => t.templateId === template.id && (t.status === "scheduled" || t.status === "active")
      )
      if (!alreadyScheduled) {
        generatingTemplates.current.add(template.id)
        addDoc(collection(db, "stores", storeId, "tournaments"), {
          name: template.name, date: getNextWeekdayDate(getDOW(template.date)),
          startTime: template.startTime ?? "", rcTime: template.rcTime ?? "",
          entryFee: template.entryFee ?? 0, reentryFee: template.reentryFee ?? 0, addonFee: template.addonFee ?? 0,
          entryStack: template.entryStack ?? 0, reentryStack: template.reentryStack ?? 0, addonStack: template.addonStack ?? 0,
          flyerUrl: template.flyerUrl ?? "", repeatWeekly: false, blindPresetId: template.blindPresetId ?? "",
          templateId: template.id, bustCount: 0, status: "scheduled", createdAt: serverTimestamp(),
        })
      }
    }
  }, [storeId, tournaments])

  // ── Tournament modal handlers ──────────────────────────────────────────
  const handleChange = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const handleImageSelect = (file: File) => {
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }

  const uploadImageIfNeeded = async (): Promise<string> => {
    if (!imageFile || !storeId) return form.flyerUrl || ""
    const fileRef = ref(storage, `tournaments/${storeId}/${Date.now()}_${imageFile.name}`)
    await uploadBytes(fileRef, imageFile)
    return await getDownloadURL(fileRef)
  }

  const closeModal = () => {
    setOpenModal(false); setEditData(null); setImageFile(null); setImagePreview(null)
    setRepeatWeekly(false); setBlindPresetId(""); setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!storeId) return
    if (!form.name || !form.date) { alert("名称と日付は必須です"); return }
    if (Number(form.entryFee) === 0 && Number(form.reentryFee) === 0 && Number(form.addonFee) === 0) {
      alert("エントリー費、リエントリー費、アドオン費のいずれかは1以上必要です"); return
    }
    const flyerUrl = await uploadImageIfNeeded()
    const payload = {
      name: form.name, date: form.date, startTime: form.startTime, rcTime: form.rcTime,
      entryFee: Number(form.entryFee) || 0, reentryFee: Number(form.reentryFee) || 0, addonFee: Number(form.addonFee) || 0,
      entryStack: Number(form.entryStack) || 0, reentryStack: Number(form.reentryStack) || 0, addonStack: Number(form.addonStack) || 0,
      flyerUrl, repeatWeekly, blindPresetId,
      bustCount: editData?.bustCount ?? 0,
      status: editData ? (editData.status ?? "scheduled") : "scheduled",
      createdAt: editData?.createdAt ?? serverTimestamp(),
    }
    if (editData) {
      await updateDoc(doc(db, "stores", storeId, "tournaments", editData.id), payload)
    } else {
      await addDoc(collection(db, "stores", storeId, "tournaments"), payload)
    }
    closeModal()
  }

  const handleDelete = async (id: string) => {
    if (!storeId || !confirm("本当に削除しますか？")) return
    await deleteDoc(doc(db, "stores", storeId, "tournaments", id))
  }

  const handleEdit = (t: any) => {
    setEditData(t); setRepeatWeekly(t.repeatWeekly ?? false); setBlindPresetId(t.blindPresetId ?? "")
    setImagePreview(t.flyerUrl || null)
    setForm({ name: t.name ?? "", date: typeof t.date === "string" ? t.date : "", startTime: t.startTime ?? "", rcTime: t.rcTime ?? "",
      entryFee: String(t.entryFee ?? ""), reentryFee: String(t.reentryFee ?? ""), addonFee: String(t.addonFee ?? ""),
      entryStack: String(t.entryStack ?? ""), reentryStack: String(t.reentryStack ?? ""), addonStack: String(t.addonStack ?? ""), flyerUrl: t.flyerUrl ?? "" })
    setOpenModal(true)
  }

  const handleCopy = (t: any) => {
    setEditData(null); setRepeatWeekly(false); setBlindPresetId(t.blindPresetId ?? ""); setImagePreview(t.flyerUrl || null)
    setForm({ name: t.name ?? "", date: todayStr(), startTime: t.startTime ?? "", rcTime: t.rcTime ?? "",
      entryFee: String(t.entryFee ?? ""), reentryFee: String(t.reentryFee ?? ""), addonFee: String(t.addonFee ?? ""),
      entryStack: String(t.entryStack ?? ""), reentryStack: String(t.reentryStack ?? ""), addonStack: String(t.addonStack ?? ""), flyerUrl: t.flyerUrl ?? "" })
    setOpenModal(true)
  }

  const handleStartTournament = async (id: string) => {
    if (!storeId) return
    setStartingId(id)
    try { await updateDoc(doc(db, "stores", storeId, "tournaments", id), { status: "active", startedAt: serverTimestamp() }) }
    finally { setStartingId(null) }
  }

  // ── Blind preset modal handlers ────────────────────────────────────────
  function addBlindLevel() {
    const last = [...blindLevels].reverse().find(l => l.type === "level") as BlindLevel | undefined
    if (!last) { setBlindLevels([...blindLevels, { type: "level", smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 }]); return }
    const sb = Math.max(1, Math.round((last.smallBlind ?? 100) * 1.5))
    const bb = Math.max(1, Math.round((last.bigBlind ?? 200) * 1.5))
    setBlindLevels([...blindLevels, { type: "level", smallBlind: sb, bigBlind: bb, ante: bb, duration: last.duration ?? 20 }])
  }

  function addBlindBreak() { setBlindLevels([...blindLevels, { type: "break", duration: null }]) }
  function removeBlindLevel(idx: number) { setBlindLevels(ls => ls.filter((_, i) => i !== idx)) }
  function insertLevelBefore(idx: number) {
    const nl = [...blindLevels]; nl.splice(idx, 0, { ...emptyBlindLevel }); setBlindLevels(nl); setBlindContextMenuIdx(null)
  }
  function insertLevelAfter(idx: number) {
    const nl = [...blindLevels]; nl.splice(idx + 1, 0, { ...emptyBlindLevel }); setBlindLevels(nl); setBlindContextMenuIdx(null)
  }
  function toggleLevelBreak(idx: number) {
    setBlindLevels(ls => ls.map((lv, i) => {
      if (i !== idx) return lv
      if (lv.type === "level") return { type: "break" as const, duration: lv.duration }
      return { type: "level" as const, smallBlind: null, bigBlind: null, ante: null, duration: lv.duration }
    }))
    setBlindContextMenuIdx(null)
  }
  function handleBlindBbChange(idx: number, value: number | null) {
    const v = value !== null ? Math.round(Number(value)) : null
    setBlindLevels(ls => ls.map((lv, i) => i !== idx || lv.type !== "level" ? lv : { ...lv, bigBlind: v, ante: v }))
  }

  function openEditBlindPreset(preset: any) {
    setEditingBlindPresetId(preset.id)
    setBlindPresetName(preset.name)
    setBlindLevels(Array.isArray(preset.levels) && preset.levels.length > 0 ? preset.levels : [{ ...emptyBlindLevel }])
    setBlindEditingCommentIdx(null)
    setBlindModalView("edit")
  }

  function openNewBlindPreset() {
    setEditingBlindPresetId(null); setBlindPresetName(""); setBlindLevels([{ ...emptyBlindLevel }])
    setBlindEditingCommentIdx(null); setBlindModalView("edit")
  }

  function closeBlindModal() {
    setIsBlindModalOpen(false); setBlindModalView("list"); setEditingBlindPresetId(null)
    setBlindPresetName(""); setBlindLevels([{ ...emptyBlindLevel }]); setBlindEditingCommentIdx(null)
  }

  async function saveBlindPreset() {
    if (!blindPresetName) { alert("ブラインド名を入力してください"); return }
    if (!storeId) return
    if (editingBlindPresetId) {
      await updateDoc(doc(db, "stores", storeId, "blindPresets", editingBlindPresetId), { name: blindPresetName, levels: blindLevels })
    } else {
      await addDoc(collection(db, "stores", storeId, "blindPresets"), { name: blindPresetName, levels: blindLevels, createdAt: serverTimestamp() })
    }
    await refreshPresets(storeId)
    setBlindModalView("list"); setEditingBlindPresetId(null); setBlindPresetName("")
    setBlindLevels([{ ...emptyBlindLevel }]); setBlindEditingCommentIdx(null)
  }

  async function deleteBlindPreset(id: string) {
    if (!storeId || !confirm("このプリセットを削除しますか？")) return
    await deleteDoc(doc(db, "stores", storeId, "blindPresets", id))
    if (storeId) await refreshPresets(storeId)
  }

  // ── Derived values ─────────────────────────────────────────────────────
  const currentTournaments = tournaments.filter(t => t.status !== "finished")
  const tabDayIndex = DAYS.indexOf(activeTab as DayChar)
  const tabTemplates = tabDayIndex >= 0 ? tournaments.filter(t => t.repeatWeekly === true && t.status !== "finished" && getDOW(t.date) === tabDayIndex) : []
  const tabInstances = tabDayIndex >= 0 ? tournaments.filter(t => t.templateId && t.status !== "finished" && getDOW(t.date) === tabDayIndex) : []
  const tabHistory = activeTab === "履歴"
    ? tournaments.filter(t => t.status === "finished" && (!historySearch || t.name.toLowerCase().includes(historySearch.toLowerCase())))
    : []

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', paddingBottom: 112, background: '#F2F2F7', color: '#1C1C1E' }}>
      <style>{`
        @keyframes tUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tFade  { from{opacity:0} to{opacity:1} }
        @keyframes levelIn{ from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes cIn    { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lpulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .t-in  { animation: tUp   0.28s ease-out both; }
        .t-fade{ animation: tFade 0.22s ease-out both; }
        .blind-level-item     { animation: levelIn 0.18s ease-out; }
        .blind-comment-expand { animation: cIn     0.16s ease-out; }
        .live-dot { animation: lpulse 1.5s ease-in-out infinite; }
        .t-btn { transition: opacity 0.15s, transform 0.15s; cursor: pointer; }
        .t-btn:active { opacity: 0.7; transform: scale(0.97); }
        .no-spin::-webkit-inner-spin-button,
        .no-spin::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        .no-spin { -moz-appearance:textfield; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { opacity:0.4; }
        .itm-card { background:linear-gradient(135deg,#FFF8E5,#FFFBF0); border:1.5px solid rgba(242,169,0,0.4); }
        .non-itm-card { background:rgba(120,120,128,0.06); border-radius:12px; }
      `}</style>

      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />

      <div style={{ maxWidth: 576, margin: '0 auto', padding: '0 16px' }}>
        {/* ─ Page header ─ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 0 20px' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>Tournaments</h1>
            <p style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', margin: '4px 0 0' }}>トーナメント管理</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, transform: `scale(${headerBtnScale})`, transformOrigin: 'right center' }}>
            <button onClick={() => setIsBlindModalOpen(true)} className="t-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38, padding: '0 14px', borderRadius: 12, border: '1.5px solid rgba(242,169,0,0.5)', background: '#fff', color: '#D4910A', fontSize: 13, fontWeight: 700 }}>
              <FiPlus size={14}/> Blind
            </button>
            <button onClick={() => { setEditData(null); setOpenModal(true) }} className="t-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38, padding: '0 16px', borderRadius: 12, background: '#F2A900', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(242,169,0,0.28)' }}>
              <FiPlus size={14}/> New
            </button>
          </div>
        </div>

        {/* ─ Current / active tournaments ─ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {currentTournaments.map((t, index) => {
            const entries      = entriesMap[t.id] ?? []
            const totalEntry   = entries.reduce((s: number, e: any) => s + (e.entryCount ?? 0) + (e.reentryCount ?? 0), 0)
            const totalReentry = entries.reduce((s: number, e: any) => s + (e.reentryCount ?? 0), 0)
            const totalAddon   = entries.reduce((s: number, e: any) => s + (e.addonCount ?? 0), 0)
            const isActive     = t.status === "active"
            return (
              <div key={t.id} className="t-in" style={{
                animationDelay: `${index * 0.04}s`,
                background: isActive ? 'linear-gradient(135deg,#FFFBF0,#FFF8E5)' : '#fff',
                borderRadius: 20, padding: '16px 18px',
                border: isActive ? '1.5px solid rgba(242,169,0,0.4)' : '1px solid rgba(0,0,0,0.06)',
                boxShadow: isActive ? '0 4px 20px rgba(242,169,0,0.12)' : '0 1px 4px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)',
              }}>
                {isActive && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span className="live-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#F2A900' }}/>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D4910A', letterSpacing: '0.04em' }}>LIVE</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>{t.name}</h3>
                      {t.repeatWeekly && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#D4910A', background: 'rgba(242,169,0,0.1)', borderRadius: 99, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <FiRepeat size={9}/> 毎週
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(60,60,67,0.5)' }}>
                        <FiCalendar size={11} style={{ color: '#F2A900' }}/> {t.date}
                      </span>
                      {t.startTime && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(60,60,67,0.5)' }}>
                          <FiClock size={11} style={{ color: '#F2A900' }}/> {t.startTime}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', fontWeight: 500 }}>
                        E:{totalEntry} R:{totalReentry} A:{totalAddon}
                      </span>
                    </div>
                  </div>
                  {t.status === "scheduled" && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                      <button onClick={() => handleEdit(t)} className="t-btn"
                        style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(120,120,128,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(60,60,67,0.5)' }}>
                        <FiSettings size={15}/>
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="t-btn"
                        style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,59,48,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30' }}>
                        <FiTrash2 size={15}/>
                      </button>
                    </div>
                  )}
                </div>
                {t.status === "scheduled" && (
                  <button onClick={() => handleStartTournament(t.id)} disabled={!!startingId} className="t-btn"
                    style={{ width: '100%', height: 44, borderRadius: 12, background: '#F2A900', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(242,169,0,0.28)', opacity: startingId ? 0.7 : 1 }}>
                    {startingId === t.id ? "Starting…" : "スタートする"}
                  </button>
                )}
              </div>
            )
          })}

          {/* Tab bar — scale down so all 8 tabs fit without clipping on narrow screens */}
          <div className="mt-8 mb-1" style={{ overflow: "hidden" }}>
            <div
              style={{ display: 'flex', gap: 8, transform: `scale(${tabBarScale})`, transformOrigin: 'left center', width: tabBarScale < 1 ? `${100 / tabBarScale}%` : undefined }}
            >
              {([...DAYS, "履歴"] as string[]).map(tab => {
                const isAct = activeTab === tab
                const isToday = tab !== "履歴" && DAYS.indexOf(tab as DayChar) === new Date().getDay()
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)} className="t-btn"
                    style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700, transition: 'all 0.18s',
                      background: isAct ? '#F2A900' : '#fff',
                      color: isAct ? '#fff' : 'rgba(60,60,67,0.6)',
                      boxShadow: isAct ? '0 3px 10px rgba(242,169,0,0.35)' : '0 1px 4px rgba(0,0,0,0.07)',
                    }}>{tab}</div>
                    {isToday && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isAct ? '#F2A900' : 'rgba(60,60,67,0.25)' }}/>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ─ Tab content ─ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            {activeTab === "履歴" ? (
              <>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <FiSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(60,60,67,0.35)', pointerEvents: 'none' }}/>
                  <input placeholder="トーナメント名で検索..." value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                    style={{ width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', paddingLeft: 32, paddingRight: historySearch ? 32 : 12, fontSize: 14, color: '#1C1C1E', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {historySearch && (
                    <button onClick={() => setHistorySearch("")} className="t-btn"
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'rgba(60,60,67,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiX size={10} style={{ color: '#fff' }}/>
                    </button>
                  )}
                </div>
                {tabHistory.length === 0 ? (
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(60,60,67,0.4)', padding: '32px 0' }}>
                    {historySearch ? "該当する履歴がありません" : "履歴はまだありません"}
                  </p>
                ) : tabHistory.map((t, index) => {
                    const entries      = entriesMap[t.id] ?? []
                    const totalEntry   = entries.reduce((s: number, e: any) => s + (e.entryCount ?? 0) + (e.reentryCount ?? 0), 0)
                    const totalReentry = entries.reduce((s: number, e: any) => s + (e.reentryCount ?? 0), 0)
                    const totalAddon   = entries.reduce((s: number, e: any) => s + (e.addonCount ?? 0), 0)
                    return (
                      <div key={t.id} className="t-in" style={{ animationDelay: `${index * 0.04}s`, background: '#fff', borderRadius: 18, padding: '14px 16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.2px' }}>{t.name}</p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <FiClock size={10}/> {t.startedAt || t.createdAt}
                              </span>
                              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.4)' }}>E:{totalEntry} R:{totalReentry} A:{totalAddon}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => handleCopy(t)} className="t-btn"
                              style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(120,120,128,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(60,60,67,0.5)' }}>
                              <FiCopy size={13}/>
                            </button>
                            <button onClick={() => handleDelete(t.id)} className="t-btn"
                              style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,59,48,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30' }}>
                              <FiTrash2 size={13}/>
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(entriesMap[t.id] ?? []).filter((e: any) => (e.entryCount ?? 0) > 0 || (e.reentryCount ?? 0) > 0 || (e.addonCount ?? 0) > 0)
                            .map((e: any, i: number) => {
                              const payout = t.payouts?.find((p: any) => p.playerId === e.id)
                              const isITM  = !!payout
                              return (
                                <div key={i} className={isITM ? "itm-card" : "non-itm-card"} style={{ padding: '10px 12px', borderRadius: 12 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: isITM ? '#D4910A' : '#1C1C1E' }}>
                                      {isITM && typeof payout.rank === "number" && (
                                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#F2A900', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{payout.rank}</span>
                                      )}
                                      {typeof e.name === "string" ? e.name : typeof e.id === "string" ? e.id : ""}
                                    </div>
                                    {isITM && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.7)', borderRadius: 99, padding: '3px 10px' }}>
                                        <FiAward size={12} style={{ color: '#F2A900' }}/>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#D4910A' }}>{fmtChip(typeof payout.amount === "number" ? payout.amount : 0, chipUnit, chipUnitBefore)}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'rgba(60,60,67,0.5)' }}>
                                    <span>E:{e.entryCount ?? 0}</span>
                                    <span>R:{e.reentryCount ?? 0}</span>
                                    <span>A:{e.addonCount ?? 0}</span>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )
                  })}
              </>
            ) : (
              tabTemplates.length === 0 && tabInstances.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(60,60,67,0.4)', padding: '32px 0' }}>{activeTab}曜日のトーナメントはありません</p>
              ) : (
                <>
                  {tabTemplates.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FiRepeat size={11} style={{ color: '#F2A900' }}/> 定期テンプレート
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tabTemplates.map(t => (
                          <div key={t.id} style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{t.name}</p>
                              <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', margin: '3px 0 0' }}>次回: {t.date}{t.startTime ? ` ${t.startTime}` : ""}</p>
                            </div>
                            <button onClick={() => handleEdit(t)} className="t-btn"
                              style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(120,120,128,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(60,60,67,0.5)' }}>
                              <FiSettings size={14}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {tabInstances.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>今後の予定</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tabInstances.map(t => (
                          <div key={t.id} style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{t.name}</p>
                              <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', margin: '3px 0 0' }}>{t.date}{t.startTime ? ` ${t.startTime}` : ""}</p>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', background: 'rgba(120,120,128,0.1)', borderRadius: 99, padding: '4px 10px' }}>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Tournament modal ─────────────────────────────────────────────── */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex justify-center items-center modal-overlay animate-fadeIn">
          <div
            className="bg-white rounded-3xl p-6 relative text-gray-900 overflow-y-auto shadow-2xl animate-slideUp"
            style={{
              width: TOURN_MODAL_W,
              maxHeight: `min(${TOURN_MODAL_H}px, 90vh)`,
              transform: `scale(${tournModalScale})`,
              transformOrigin: "center center",
            }}
          >
            <button className="act-btn absolute right-5 top-5 h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center" onClick={closeModal}>
              <FiX size={18} />
            </button>
            <h3 className="text-[22px] font-bold mb-8 text-gray-900">{editData ? "トーナメント編集" : "トーナメント作成"}</h3>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">トーナメント名</label>
                <input placeholder="例: Daily Tournament" value={form.name} onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">開催日</label>
                <input type="date" value={form.date} onChange={(e) => handleChange("date", e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 focus:border-[#F2A900] focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">開始時刻</label>
                <input type="time" value={form.startTime} onChange={(e) => handleChange("startTime", e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 focus:border-[#F2A900] focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">RC時間</label>
                <input type="time" value={form.rcTime} onChange={(e) => handleChange("rcTime", e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 focus:border-[#F2A900] focus:outline-none transition-all" />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-[13px] font-semibold text-gray-700">毎週繰り返す</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">同じ曜日に毎週自動生成</p>
                </div>
                <button type="button" onClick={() => setRepeatWeekly(v => !v)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${repeatWeekly ? "bg-[#F2A900]" : "bg-gray-200"}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${repeatWeekly ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-[15px] font-bold text-gray-900 mb-4">費用・スタック設定</h4>
              <div className="space-y-3">
                {[["エントリー費","entryFee","エントリースタック","entryStack"],["リエントリー費","reentryFee","リエントリースタック","reentryStack"],["アドオン費","addonFee","アドオンスタック","addonStack"]].map(([l1,k1,l2,k2]) => (
                  <div key={k1} className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-gray-600 mb-1.5">{l1}</label>
                      <input type="number" value={(form as any)[k1]} onChange={(e) => handleChange(k1, e.target.value)} placeholder="0"
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right focus:border-[#F2A900] focus:outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-600 mb-1.5">{l2}</label>
                      <input type="number" value={(form as any)[k2]} onChange={(e) => handleChange(k2, e.target.value)} placeholder="0"
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right focus:border-[#F2A900] focus:outline-none transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {blindPresets.length > 0 && (
              <div className="mb-8">
                <h4 className="text-[15px] font-bold text-gray-900 mb-3">ブラインドプリセット</h4>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setBlindPresetId("")}
                    className={`px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all act-btn ${!blindPresetId ? "bg-[#F2A900] text-white shadow-sm" : "bg-gray-100 text-gray-600"}`}>
                    なし
                  </button>
                  {blindPresets.map(p => (
                    <button key={p.id} type="button" onClick={() => setBlindPresetId(p.id)}
                      className={`px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all act-btn ${blindPresetId === p.id ? "bg-[#F2A900] text-white shadow-sm" : "bg-gray-100 text-gray-600"}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h4 className="text-[15px] font-bold text-gray-900 mb-3">チラシ画像</h4>
              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden shadow-md">
                  <img src={imagePreview} alt="preview" className="w-full max-h-48 object-cover" />
                  <button onClick={() => { setImagePreview(null); setImageFile(null) }}
                    className="act-btn absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white">
                    <FiX size={15} />
                  </button>
                </div>
              ) : (
                <label className="act-btn flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl px-4 py-3 cursor-pointer hover:border-[#F2A900] transition-all">
                  <FiCamera size={22} className="text-gray-400 flex-shrink-0" />
                  <span className="text-[14px] text-gray-500">タップして画像を選択</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]) }} />
                </label>
              )}
            </div>

            <button onClick={handleSave} className="act-btn w-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white font-bold py-4 rounded-2xl shadow-lg">
              保存する
            </button>
          </div>
        </div>
      )}

      {/* ── Blind Preset modal ───────────────────────────────────────────── */}
      {isBlindModalOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-[9999] animate-fadeIn"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        >
          <div
            className="flex flex-col rounded-[32px] bg-white overflow-hidden animate-slideUp"
            style={{
              width: `${BLIND_MODAL_W}px`,
              maxHeight: `${BLIND_MODAL_H}px`,
              transform: `scale(${blindModalScale})`,
              transformOrigin: "center center",
              boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {blindModalView === "edit" && (
                  <button onClick={() => setBlindModalView("list")}
                    className="act-btn h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-[18px]">
                    ←
                  </button>
                )}
                <p className="text-[16px] font-bold text-gray-900">
                  {blindModalView === "list" ? "ブラインドプリセット" : editingBlindPresetId ? "プリセット編集" : "プリセット作成"}
                </p>
              </div>
              <button onClick={closeBlindModal} className="act-btn h-9 w-9 rounded-full bg-gray-500 hover:bg-gray-200 flex items-center justify-center">
                <FiX size={16} />
              </button>
            </div>

            {blindModalView === "list" ? (
              // ── List view ──
              <div className="flex-1 overflow-y-auto p-5 blind-modal-view">
                {blindPresets.length === 0 ? (
                  <p className="text-center text-[14px] text-gray-400 py-12">プリセットがまだありません</p>
                ) : (
                  <div className="space-y-2.5">
                    {blindPresets.map(preset => (
                      <div key={preset.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3.5 border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-gray-900 truncate">{preset.name}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">
                            {Array.isArray(preset.levels) ? `${preset.levels.filter((l: any) => l.type === "level").length} レベル / ${preset.levels.filter((l: any) => l.type === "break").length} ブレイク` : ""}
                          </p>
                        </div>
                        <button onClick={() => openEditBlindPreset(preset)}
                          className="act-btn h-9 px-3.5 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 flex-shrink-0">
                          編集
                        </button>
                        <button onClick={() => deleteBlindPreset(preset.id)}
                          className="act-btn h-9 w-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 flex-shrink-0">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // ── Edit view ──
              <div className="flex-1 overflow-y-auto flex flex-col blind-modal-view">
                <div className="px-6 pt-5 pb-3 flex-shrink-0">
                  <label className="block text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-2">プリセット名</label>
                  <input
                    value={blindPresetName}
                    onChange={e => setBlindPresetName(e.target.value)}
                    className="w-full rounded-2xl px-4 py-2.5 text-[14px] text-gray-900 outline-none border border-gray-200 focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"
                    placeholder="例: 通常トーナメント"
                    autoFocus
                  />
                </div>
                <div className="flex-1 overflow-y-auto px-6 pb-2">
                  {/* 一括時間変更 */}
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">時間を一括変更</span>
                    <input
                      type="number"
                      value={bulkDuration}
                      onChange={e => setBulkDuration(e.target.value)}
                      placeholder="分"
                      className="no-spin w-16 rounded-xl px-2 py-1.5 text-[13px] text-center text-gray-900 outline-none border border-gray-200 bg-white focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"
                    />
                    <span className="text-[11px] text-gray-400">分</span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = Math.round(Number(bulkDuration))
                        if (!bulkDuration || isNaN(d) || d <= 0) return
                        setBlindLevels(ls => ls.map(l => ({ ...l, duration: d })))
                        setBulkDuration("")
                      }}
                      className="ml-auto px-3 py-1.5 rounded-xl text-[12px] font-bold text-white transition-all"
                      style={{ background: "linear-gradient(135deg,#F2A900,#D4910A)" }}
                    >
                      一括変更
                    </button>
                  </div>
                  <label className="block text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-3">レベルリスト</label>
                  <div className="space-y-2">
                    {blindLevels.map((lv, idx) => (

                    <div key={idx} className="relative">
                      <div
                        className="blind-level-item rounded-2xl overflow-hidden border border-gray-100"
                        draggable
                        onDragStart={() => setBlindDragIndex(idx)}
                        onDragEnter={() => setBlindDropIndex(idx)}
                        onDragEnd={() => {
                          if (blindDragIndex === null || blindDropIndex === null || blindDragIndex === blindDropIndex) {
                            setBlindDragIndex(null); setBlindDropIndex(null); return
                          }
                          const nl = [...blindLevels]
                          const [m] = nl.splice(blindDragIndex, 1)
                          nl.splice(blindDropIndex, 0, m)
                          setBlindLevels(nl)
                          setBlindDragIndex(null)
                          setBlindDropIndex(null)
                        }}
                        style={{ opacity: blindDragIndex === idx ? 0.5 : 1, background: lv.type === "break" ? "#F0F7FF" : "#F9F9F9" }}
                      >
                        {/* Row 1: label + comment + controls */}
                        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="cursor-move text-gray-300 text-[16px] select-none">≡</span>
                            {lv.type === "level" ? (
                              <span className="text-[11px] font-bold text-[#F2A900] min-w-[40px]">Lv {idx + 1}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-blue-400 min-w-[40px]">Break</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setBlindEditingCommentIdx(blindEditingCommentIdx === idx ? null : idx)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${lv.comment ? "bg-[#F2A900]/15 text-[#F2A900] border border-[#F2A900]/30" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                            >
                              {lv.comment ? lv.comment : "＋"}
                            </button>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setBlindContextMenuIdx(blindContextMenuIdx === idx ? null : idx)}
                              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                            >
                              <FiMoreHorizontal size={15} className="text-gray-400" />
                            </button>
                            <button onClick={() => removeBlindLevel(idx)}
                              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors">
                              <FiTrash2 size={14} className="text-red-400 transition-colors" />
                            </button>
                          </div>
                        </div>
                        {/* Row 2 & 3: inputs (2行レイアウト) */}
                        {lv.type === "level" ? (
                          <div className="flex flex-col gap-1.5 px-3 pb-2.5">
                            {/* 行1: SB / BB */}
                            <div className="flex gap-1.5">
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-[10px] text-gray-400 font-semibold text-center">SB</span>
                                <input type="number" value={lv.smallBlind ?? ""} placeholder="100"
                                  onChange={e => {
                                    const raw = e.target.value
                                    if (raw === "" || raw === "-") { setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, smallBlind: null })); return }
                                    const v = Math.round(Number(raw))
                                    const bb = Math.round(v * 2)
                                    setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, smallBlind: v, bigBlind: bb, ante: bb }))
                                  }}
                                  className={`no-spin ${bModalInput} w-full`} />
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-[10px] text-gray-400 font-semibold text-center">BB</span>
                                <input type="number" value={lv.bigBlind ?? ""} placeholder="200"
                                  onChange={e => handleBlindBbChange(idx, e.target.value === "" ? null : Number(e.target.value))}
                                  className={`no-spin ${bModalInput} w-full`} />
                              </div>
                            </div>
                            {/* 行2: ANTE / 時間 */}
                            <div className="flex gap-1.5">
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-[10px] text-gray-400 font-semibold text-center">ANTE</span>
                                <input type="number" value={lv.ante ?? ""} placeholder="200"
                                  onChange={e => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, ante: e.target.value === "" ? null : Math.round(Number(e.target.value)) }))}
                                  className={`no-spin ${bModalInput} w-full`} />
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-[10px] text-gray-400 font-semibold text-center">時間(分)</span>
                                <input type="number" value={lv.duration ?? ""} placeholder="20"
                                  onChange={e => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, duration: Math.max(1, Math.round(Number(e.target.value))) }))}
                                  className={`no-spin ${bModalInput} w-full`} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 pb-2.5">
                            <div className="flex flex-col gap-0.5" style={{width: "120px"}}>
                              <span className="text-[10px] text-blue-400 font-semibold text-center">時間(分)</span>
                              <input type="number" value={lv.duration ?? ""} placeholder="10"
                                onChange={e => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, duration: Math.max(1, Math.round(Number(e.target.value))) }))}
                                className={`no-spin ${bModalInput} w-full`} />
                            </div>
                          </div>
                        )}
                        {(blindEditingCommentIdx === idx || lv.comment) && (
                          <div className="px-3 pb-2.5 flex items-center gap-2 blind-comment-expand">
                            <input
                              type="text"
                              placeholder="コメントを入力..."
                              value={lv.comment ?? ""}
                              onChange={e => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, comment: e.target.value || null }))}
                              className="flex-1 text-[12px] rounded-xl px-3 py-1.5 border border-gray-200 bg-white focus:border-[#F2A900] focus:outline-none transition-all"
                              autoFocus={blindEditingCommentIdx === idx}
                            />
                            <button type="button"
                              onClick={() => { setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, comment: null })); setBlindEditingCommentIdx(null) }}
                              className="h-7 w-7 flex-shrink-0 rounded-full bg-gray-200 hover:bg-red-50 flex items-center justify-center transition-colors">
                              <FiX size={11} className="text-gray-500" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* コンテキストメニュー */}
                      {blindContextMenuIdx === idx && (
                        <>
                          <div className="fixed inset-0 z-[199]" onClick={() => setBlindContextMenuIdx(null)} />
                          <div className="absolute right-9 top-1 z-[200] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[168px]">
                            <button
                              type="button"
                              onClick={() => insertLevelBefore(idx)}
                              className="w-full px-4 py-3 text-left text-[13px] text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                            >
                              この前にレベルを追加
                            </button>
                            <button
                              type="button"
                              onClick={() => insertLevelAfter(idx)}
                              className="w-full px-4 py-3 text-left text-[13px] text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                            >
                              この後にレベルを追加
                            </button>
                            <div className="border-t border-gray-100" />
                            <button
                              type="button"
                              onClick={() => toggleLevelBreak(idx)}
                              className="w-full px-4 py-3 text-left text-[13px] text-blue-500 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                            >
                              {lv.type === "level" ? "ブレイクに変更" : "レベルに変更"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    ))}
                  </div>
                </div>

                {/* Add level/break buttons */}
                <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
                  <div className="flex gap-2">
                    <button onClick={addBlindLevel}
                      className="act-btn flex-1 py-2.5 rounded-2xl text-[13px] font-semibold text-[#F2A900] hover:bg-[#F2A900]/5 transition-all"
                      style={{ border: "1.5px solid rgba(242,169,0,0.35)" }}>
                      ＋ レベル追加
                    </button>
                    <button onClick={addBlindBreak}
                      className="act-btn flex-1 py-2.5 rounded-2xl text-[13px] font-semibold text-blue-500 hover:bg-blue-50 transition-all"
                      style={{ border: "1.5px solid rgba(59,130,246,0.3)" }}>
                      ＋ ブレイク追加
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              {blindModalView === "list" ? (
                <div className="flex gap-2">
                  <button onClick={openNewBlindPreset}
                    className="act-btn flex-1 py-3 rounded-2xl text-[14px] font-bold text-white transition-all"
                    style={{ background: "linear-gradient(135deg,#F2A900,#D4910A)", boxShadow: "0 4px 14px rgba(242,169,0,0.28)" }}>
                    ＋ 新規作成
                  </button>
                  <button onClick={() => { setAiView("input"); setAiError(""); setIsAiOpen(true) }}
                    className="act-btn flex-1 py-3 rounded-2xl text-[14px] font-bold text-white transition-all flex items-center justify-center gap-1.5"
                    style={{ background: "linear-gradient(135deg,#1f1b16,#3b2f22)", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
                    <FiZap size={13} /> AI作成
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={saveBlindPreset}
                    className="act-btn flex-1 py-3 rounded-2xl text-[14px] font-bold text-white transition-all"
                    style={{ background: "linear-gradient(135deg,#F2A900,#D4910A)", boxShadow: "0 4px 14px rgba(242,169,0,0.28)" }}>
                    保存
                  </button>
                  <button onClick={() => setBlindModalView("list")}
                    className="act-btn flex-1 py-3 rounded-2xl text-[14px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                    キャンセル
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── AI ストラクチャーモーダル ────────────────────────────────────── */}
      {isAiOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50">
          <div
            className="rounded-t-[28px] bg-white overflow-hidden flex flex-col"
            style={{
              width: AI_MODAL_W,
              maxHeight: `min(${AI_MODAL_H}px, 90vh)`,
              transform: `scale(${aiModalScale})`,
              transformOrigin: "center bottom",
            }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FiZap size={16} className="text-[#F2A900]" />
                <p className="text-[16px] font-bold text-gray-900">
                  {aiView === "input" ? "AIストラクチャー生成" : "プレビュー"}
                </p>
              </div>
              <button onClick={() => setIsAiOpen(false)} className="text-gray-400"><FiX size={20} /></button>
            </div>

            {aiView === "input" ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* プリセット名 */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">プリセット名</label>
                  <input value={aiPresetName} onChange={e => setAiPresetName(e.target.value)} placeholder="例: 3時間RC構成"
                    className="mt-1.5 w-full h-11 rounded-2xl border border-gray-200 px-4 text-[14px] text-gray-900 outline-none focus:border-[#F2A900]" />
                </div>

                {/* 使用チップ */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">使用チップ</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {AI_CHIP_OPTIONS.map(chip => (
                      <button key={chip} type="button"
                        onClick={() => setAiChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])}
                        className={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all border ${aiChips.includes(chip) ? "bg-[#F2A900] border-[#F2A900] text-gray-900" : "bg-white border-gray-200 text-gray-500"}`}>
                        {chip.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* スタートスタック */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">スタートスタック（チップ合計）</label>
                  <input type="number" value={aiStack} onChange={e => setAiStack(e.target.value)} placeholder="例: 30000"
                    className="mt-1.5 w-full h-11 rounded-2xl border border-gray-200 px-4 text-[14px] text-gray-900 outline-none focus:border-[#F2A900]" />
                </div>

                {/* RC時間 */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">RC時間（スタートから何時間）</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="number" step="0.5" min="0.5" value={aiRcHours} onChange={e => setAiRcHours(e.target.value)} placeholder="例: 3"
                      className="w-28 h-11 rounded-2xl border border-gray-200 px-4 text-[14px] text-gray-900 outline-none focus:border-[#F2A900]" />
                    <span className="text-[13px] text-gray-500">時間</span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">RC直前10分間のブレイク終了=RC時刻になるよう自動調整されます</p>
                </div>

                {aiError && <p className="text-[12px] text-red-500">{aiError}</p>}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5">
                <p className="text-[12px] text-gray-500 mb-3">レベル数: {aiPreviewLevels.filter(l => l.type === "level").length} / ブレイク: {aiPreviewLevels.filter(l => l.type === "break").length}</p>
                <div className="space-y-1.5">
                  {aiPreviewLevels.map((lv, i) => (
                    <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] ${lv.type === "break" ? "bg-blue-50 text-blue-600 font-semibold" : "bg-gray-50 text-gray-700"}`}>
                      {lv.type === "break" ? (
                        <>
                          <span className="w-5 text-center">☕</span>
                          <span>{lv.duration === 10 ? "RC直前ブレイク" : "ブレイク"} {lv.duration}分</span>
                        </>
                      ) : (
                        <>
                          <span className="w-5 text-center font-bold text-gray-400">
                            {aiPreviewLevels.slice(0, i).filter(l => l.type === "level").length + 1}
                          </span>
                          <span className="flex-1">{lv.smallBlind}/{lv.bigBlind}</span>
                          <span className="text-gray-400">{lv.duration}min</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
              {aiView === "input" ? (
                <button onClick={() => {
                  setAiError("")
                  const stack = Number(aiStack)
                  const rc = Number(aiRcHours)
                  if (!aiChips.length) { setAiError("チップを1つ以上選択してください"); return }
                  if (!stack || stack <= 0) { setAiError("スタートスタックを入力してください"); return }
                  if (!rc || rc <= 0) { setAiError("RC時間を入力してください"); return }
                  const result = aiGenerate(aiChips, stack, rc)
                  if (!result.length) { setAiError("有効な構成を生成できませんでした。入力値を確認してください"); return }
                  setAiPreviewLevels(result)
                  setAiView("preview")
                }}
                  className="w-full h-12 rounded-2xl text-[15px] font-bold text-white transition-all flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#1f1b16,#3b2f22)" }}>
                  <FiZap size={15} /> プレビューを生成
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setAiView("input")}
                    className="flex-1 h-12 rounded-2xl text-[14px] font-semibold text-gray-600 bg-gray-100">
                    戻る
                  </button>
                  <button onClick={() => {
                    setBlindPresetName(aiPresetName || "AIプリセット")
                    setBlindLevels(aiPreviewLevels)
                    setEditingBlindPresetId(null)
                    setBlindModalView("edit")
                    setIsAiOpen(false)
                    setAiView("input")
                  }}
                    className="flex-1 h-12 rounded-2xl text-[15px] font-bold text-white transition-all"
                    style={{ background: "linear-gradient(135deg,#F2A900,#D4910A)", boxShadow: "0 4px 14px rgba(242,169,0,0.28)" }}>
                    適用する
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Footer nav ───────────────────────────────────────────────────── */}
      <StoreBottomNav />
    </main>
  )
}
