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
  const [tabBarScale, setTabBarScale] = useState(1)

  useEffect(() => {
    function computeScales() {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const contentW = vw - 32

      setBlindModalScale(Math.min(1, vw / BLIND_MODAL_W, vh / BLIND_MODAL_H))
      setTournModalScale(Math.min(1, (vw - 32) / TOURN_MODAL_W, (vh - 40) / TOURN_MODAL_H))
      setAiModalScale(Math.min(1, vw / AI_MODAL_W, (vh * 0.92) / AI_MODAL_H))

      const TAB_NATURAL_W = 8 * 44 + 7 * 8
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

  const [activeTab, setActiveTab] = useState<string>(() => DAYS[new Date().getDay()])
  const [startingId, setStartingId] = useState<string | null>(null)
  const [historySearch, setHistorySearch] = useState("")

  const generatingTemplates = useRef<Set<string>>(new Set())

  const bModalInput = "no-spin rounded-xl px-3 py-1.5 text-[13px] text-center outline-none border border-gray-200 bg-white focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"

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

  const refreshPresets = async (sid: string) => {
    const snap = await getDocs(collection(db, "stores", sid, "blindPresets"))
    setBlindPresets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => {
    if (!storeId) return
    refreshPresets(storeId)
  }, [storeId])

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

  const handleChange = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))
  const handleImageSelect = (file: File) => { setImageFile(file); setImagePreview(URL.createObjectURL(file)) }
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
    setEditingBlindPresetId(preset.id); setBlindPresetName(preset.name)
    setBlindLevels(Array.isArray(preset.levels) && preset.levels.length > 0 ? preset.levels : [{ ...emptyBlindLevel }])
    setBlindEditingCommentIdx(null); setBlindModalView("edit")
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
    <main style={{ minHeight: '100dvh', paddingBottom: 112, background: '#F2F2F7', color: 'var(--label)' }}>
      <style>{`
        :root {
          --label:  #1C1C1E;
          --label2: rgba(60,60,67,0.6);
          --label3: rgba(60,60,67,0.3);
          --sep:    rgba(60,60,67,0.12);
          --fill:   rgba(120,120,128,0.12);
          --gold:   #F2A900;
          --gold-dk:#D4910A;
        }
        @keyframes suUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lpulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes levelIn{ from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes cIn    { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .su0 { animation: suUp 0.28s ease-out both; }
        .su1 { animation: suUp 0.28s 0.06s ease-out both; }
        .su2 { animation: suUp 0.28s 0.12s ease-out both; }
        .ios-card { background:#fff; border-radius:20px; box-shadow:0 1px 4px rgba(0,0,0,0.05),0 4px 14px rgba(0,0,0,0.04); overflow:hidden; }
        .section-hd { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--label2); margin-bottom:10px; }
        .live-dot { animation: lpulse 1.5s ease-in-out infinite; }
        .itap { transition:opacity 0.15s,transform 0.15s; cursor:pointer; -webkit-tap-highlight-color:transparent; }
        .itap:active { opacity:0.65; transform:scale(0.97); }
        .divider { height:1px; background:var(--sep); }
        .no-spin::-webkit-inner-spin-button,
        .no-spin::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        .no-spin { -moz-appearance:textfield; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { opacity:0.4; }
        .blind-level-item { animation: levelIn 0.18s ease-out; }
        .blind-comment-expand { animation: cIn 0.16s ease-out; }
        .itm-row { background:linear-gradient(135deg,#FFF8E5,#FFFBF0); border:1.5px solid rgba(242,169,0,0.35); border-radius:14px; }
        .brk-row { background:rgba(0,122,255,0.05); border-radius:14px; }
        .lvl-row { background:#F9F9F9; border-radius:14px; }
        button { -webkit-tap-highlight-color:transparent; }
      `}</style>

      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* ─ Page header ─ */}
        <div className="su0" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 18px' }}>
          {/* Title — flex:1 + minWidth:0 ensures it never pushes buttons off screen */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <p className="section-hd" style={{ marginBottom: 2 }}>Store</p>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', margin: 0, color: 'var(--label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tournaments</h1>
          </div>
          {/* Buttons — flex-shrink:0 ensures they always fully appear */}
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            {/* + Blind: outlined pill */}
            <button onClick={() => setIsBlindModalOpen(true)} className="itap" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              height: 34, padding: '0 12px',
              borderRadius: 99, border: '1.5px solid var(--gold)',
              background: 'rgba(242,169,0,0.06)',
              color: 'var(--gold-dk)', fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              <FiPlus size={11} strokeWidth={2.5}/> Blind
            </button>
            {/* + New: filled gold pill */}
            <button onClick={() => { setEditData(null); setOpenModal(true) }} className="itap" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              height: 34, padding: '0 14px',
              borderRadius: 99, background: 'var(--gold)',
              border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(242,169,0,0.35)',
            }}>
              <FiPlus size={11} strokeWidth={2.5}/> New
            </button>
          </div>
        </div>

        {/* ─ Current / active tournaments ─ */}
        {currentTournaments.length > 0 && (
          <div className="su1" style={{ marginBottom: 20 }}>
            <p className="section-hd">開催中・予定</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentTournaments.map((t, index) => {
                const entries      = entriesMap[t.id] ?? []
                const totalEntry   = entries.reduce((s: number, e: any) => s + (e.entryCount ?? 0) + (e.reentryCount ?? 0), 0)
                const totalReentry = entries.reduce((s: number, e: any) => s + (e.reentryCount ?? 0), 0)
                const totalAddon   = entries.reduce((s: number, e: any) => s + (e.addonCount ?? 0), 0)
                const isActive     = t.status === "active"
                return (
                  <div key={t.id} className="ios-card" style={{
                    border: isActive ? '1.5px solid rgba(242,169,0,0.35)' : 'none',
                    background: isActive ? 'linear-gradient(135deg,#FFFBF0,#FFF9F0)' : '#fff',
                  }}>
                    <div style={{ padding: '14px 16px' }}>
                      {isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                          <span className="live-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)' }}/>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-dk)', letterSpacing: '0.05em' }}>LIVE</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                            <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--label)', letterSpacing: '-0.2px' }}>{t.name}</p>
                            {t.repeatWeekly && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold-dk)', background: 'rgba(242,169,0,0.1)', borderRadius: 99, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                <FiRepeat size={9}/> 毎週
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--label2)' }}>
                              <FiCalendar size={11} style={{ color: 'var(--gold)' }}/> {t.date}
                            </span>
                            {t.startTime && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--label2)' }}>
                                <FiClock size={11} style={{ color: 'var(--gold)' }}/> {t.startTime}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--label2)' }}>E:{totalEntry} R:{totalReentry} A:{totalAddon}</span>
                          </div>
                        </div>
                        {t.status === "scheduled" && (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => handleEdit(t)} className="itap"
                              style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)' }}>
                              <FiSettings size={14}/>
                            </button>
                            <button onClick={() => handleDelete(t.id)} className="itap"
                              style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,59,48,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30' }}>
                              <FiTrash2 size={14}/>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {t.status === "scheduled" && (
                      <>
                        <div className="divider"/>
                        <button onClick={() => handleStartTournament(t.id)} disabled={!!startingId} className="itap"
                          style={{ width: '100%', height: 44, background: 'none', border: 'none', color: 'var(--gold-dk)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: startingId ? 0.6 : 1 }}>
                          {startingId === t.id ? "Starting…" : "スタートする"}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─ Weekly schedule ─ */}
        <div className="su2">
          <p className="section-hd">週間スケジュール</p>
          {/* Tab bar */}
          <div style={{ marginBottom: 14, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', gap: 8,
              transform: `scale(${tabBarScale})`, transformOrigin: 'left center',
              width: tabBarScale < 1 ? `${100 / tabBarScale}%` : undefined,
            }}>
              {([...DAYS, "履歴"] as string[]).map(tab => {
                const isAct   = activeTab === tab
                const isToday = tab !== "履歴" && DAYS.indexOf(tab as DayChar) === new Date().getDay()
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)} className="itap"
                    style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700,
                      background: isAct ? 'var(--gold)' : '#fff',
                      color: isAct ? '#fff' : 'var(--label2)',
                      boxShadow: isAct ? '0 3px 10px rgba(242,169,0,0.35)' : '0 1px 4px rgba(0,0,0,0.07)',
                    }}>{tab}</div>
                    {isToday && (
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: isAct ? 'var(--gold)' : 'var(--label3)' }}/>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === "履歴" ? (
            <>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <FiSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--label2)', pointerEvents: 'none' }}/>
                <input placeholder="トーナメント名で検索…" value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                  style={{ width: '100%', height: 40, borderRadius: 12, border: '1.5px solid var(--sep)', background: '#fff', paddingLeft: 32, paddingRight: historySearch ? 32 : 12, fontSize: 14, color: 'var(--label)', outline: 'none', boxSizing: 'border-box' }}
                />
                {historySearch && (
                  <button onClick={() => setHistorySearch("")} className="itap"
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiX size={10} style={{ color: 'var(--label2)' }}/>
                  </button>
                )}
              </div>
              {tabHistory.length === 0 ? (
                <div className="ios-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--label2)' }}>
                    {historySearch ? "該当する履歴がありません" : "履歴はまだありません"}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tabHistory.map((t) => {
                    const entries      = entriesMap[t.id] ?? []
                    const totalEntry   = entries.reduce((s: number, e: any) => s + (e.entryCount ?? 0) + (e.reentryCount ?? 0), 0)
                    const totalReentry = entries.reduce((s: number, e: any) => s + (e.reentryCount ?? 0), 0)
                    const totalAddon   = entries.reduce((s: number, e: any) => s + (e.addonCount ?? 0), 0)
                    return (
                      <div key={t.id} className="ios-card">
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--label)' }}>{t.name}</p>
                              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: 'var(--label2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <FiClock size={10}/> {t.startedAt || t.createdAt}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--label2)' }}>E:{totalEntry} R:{totalReentry} A:{totalAddon}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => handleCopy(t)} className="itap"
                                style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)' }}>
                                <FiCopy size={13}/>
                              </button>
                              <button onClick={() => handleDelete(t.id)} className="itap"
                                style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,59,48,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30' }}>
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
                                  <div key={i} className={isITM ? "itm-row" : "lvl-row"} style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: isITM ? 'var(--gold-dk)' : 'var(--label)' }}>
                                        {isITM && typeof payout.rank === "number" && (
                                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--gold)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{payout.rank}</span>
                                        )}
                                        {typeof e.name === "string" ? e.name : typeof e.id === "string" ? e.id : ""}
                                      </div>
                                      {isITM && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <FiAward size={12} style={{ color: 'var(--gold)' }}/>
                                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-dk)' }}>{fmtChip(typeof payout.amount === "number" ? payout.amount : 0, chipUnit, chipUnitBefore)}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--label2)' }}>
                                      <span>E:{e.entryCount ?? 0}</span>
                                      <span>R:{e.reentryCount ?? 0}</span>
                                      <span>A:{e.addonCount ?? 0}</span>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            tabTemplates.length === 0 && tabInstances.length === 0 ? (
              <div className="ios-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--label2)' }}>{activeTab}曜日のトーナメントはありません</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {tabTemplates.length > 0 && (
                  <div>
                    <p className="section-hd" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FiRepeat size={10} style={{ color: 'var(--gold)' }}/> 定期テンプレート
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tabTemplates.map(t => (
                        <div key={t.id} className="ios-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--label)' }}>{t.name}</p>
                            <p style={{ fontSize: 11, color: 'var(--label2)', margin: '3px 0 0' }}>次回: {t.date}{t.startTime ? ` ${t.startTime}` : ""}</p>
                          </div>
                          <button onClick={() => handleEdit(t)} className="itap"
                            style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)', flexShrink: 0 }}>
                            <FiSettings size={13}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tabInstances.length > 0 && (
                  <div>
                    <p className="section-hd">今後の予定</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tabInstances.map(t => (
                        <div key={t.id} className="ios-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--label)' }}>{t.name}</p>
                            <p style={{ fontSize: 11, color: 'var(--label2)', margin: '3px 0 0' }}>{t.date}{t.startTime ? ` ${t.startTime}` : ""}</p>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)', background: 'var(--fill)', borderRadius: 99, padding: '4px 10px', flexShrink: 0 }}>{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Tournament create/edit modal ─────────────────────────────────────── */}
      {openModal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: TOURN_MODAL_W,
            maxHeight: '92dvh', background: '#F2F2F7',
            borderRadius: '28px 28px 0 0', display: 'flex', flexDirection: 'column',
            transform: `scale(${tournModalScale})`, transformOrigin: 'center bottom',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(60,60,67,0.2)' }}/>
            </div>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 14px', flexShrink: 0 }}>
              <p style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.4px', color: 'var(--label)' }}>
                {editData ? "編集" : "新規トーナメント"}
              </p>
              <button onClick={closeModal} className="itap" style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(120,120,128,0.18)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)' }}>
                <FiX size={14}/>
              </button>
            </div>
            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>

              {/* ── 基本情報 group ── */}
              <p className="section-hd" style={{ paddingLeft: 4, marginBottom: 8 }}>基本情報</p>
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: 50, borderBottom: '1px solid var(--sep)' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--label)', flexShrink: 0, width: 90 }}>名称</span>
                  <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="例: Daily Tournament"
                    style={{ flex: 1, height: 50, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--label)', textAlign: 'right' }}
                  />
                </div>
                {/* Date row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: 50, borderBottom: '1px solid var(--sep)' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--label)', flexShrink: 0, width: 90 }}>開催日</span>
                  <input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)}
                    style={{ flex: 1, height: 50, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--label)', textAlign: 'right' }}
                  />
                </div>
                {/* Start time row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: 50, borderBottom: '1px solid var(--sep)' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--label)', flexShrink: 0, width: 90 }}>開始時刻</span>
                  <input type="time" value={form.startTime} onChange={e => handleChange('startTime', e.target.value)}
                    style={{ flex: 1, height: 50, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--label)', textAlign: 'right' }}
                  />
                </div>
                {/* RC time row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: 50, borderBottom: '1px solid var(--sep)' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--label)', flexShrink: 0, width: 90 }}>RC時間</span>
                  <input type="time" value={form.rcTime} onChange={e => handleChange('rcTime', e.target.value)}
                    style={{ flex: 1, height: 50, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--label)', textAlign: 'right' }}
                  />
                </div>
                {/* Repeat toggle row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', minHeight: 52 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--label)' }}>毎週繰り返す</p>
                    <p style={{ fontSize: 11, color: 'var(--label2)', margin: '1px 0 0' }}>同じ曜日に毎週自動生成</p>
                  </div>
                  <button type="button" onClick={() => setRepeatWeekly(v => !v)} className="itap"
                    style={{ width: 50, height: 30, borderRadius: 15, background: repeatWeekly ? 'var(--gold)' : 'rgba(120,120,128,0.22)', border: 'none', position: 'relative', transition: 'background 0.22s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', width: 24, height: 24, borderRadius: '50%', background: '#fff', top: 3, left: repeatWeekly ? 23 : 3, transition: 'left 0.22s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}/>
                  </button>
                </div>
              </div>

              {/* ── 費用・スタック group ── */}
              <p className="section-hd" style={{ paddingLeft: 4, marginBottom: 8 }}>費用・スタック設定</p>
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {[
                  { label: 'エントリー', feeKey: 'entryFee', stackKey: 'entryStack' },
                  { label: 'リエントリー', feeKey: 'reentryFee', stackKey: 'reentryStack' },
                  { label: 'アドオン', feeKey: 'addonFee', stackKey: 'addonStack' },
                ].map((row, i) => (
                  <div key={row.feeKey} style={{ borderBottom: i < 2 ? '1px solid var(--sep)' : 'none' }}>
                    <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</span>
                    </div>
                    <div style={{ display: 'flex', padding: '4px 16px 10px', gap: 10 }}>
                      {[[row.feeKey, '費用', '0'], [row.stackKey, 'スタック', '0']].map(([key, placeholder, defVal]) => (
                        <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 10, color: 'var(--label2)', fontWeight: 600 }}>{placeholder}</span>
                          <div style={{ display: 'flex', alignItems: 'center', background: '#F9F9F9', borderRadius: 10, padding: '0 10px', height: 36 }}>
                            <input type="number" value={(form as any)[key]} onChange={e => handleChange(key, e.target.value)} placeholder={defVal}
                              className="no-spin"
                              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--label)', textAlign: 'right', width: '100%' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── ブラインドプリセット ── */}
              {blindPresets.length > 0 && (
                <>
                  <p className="section-hd" style={{ paddingLeft: 4, marginBottom: 8 }}>ブラインドプリセット</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {[{ id: '', name: 'なし' }, ...blindPresets].map(p => {
                      const sel = blindPresetId === p.id
                      return (
                        <button key={p.id} type="button" onClick={() => setBlindPresetId(p.id)} className="itap" style={{
                          padding: '7px 14px', borderRadius: 99,
                          border: sel ? 'none' : '1.5px solid var(--sep)',
                          background: sel ? 'var(--gold)' : '#fff',
                          color: sel ? '#fff' : 'var(--label)',
                          fontSize: 13, fontWeight: 600,
                          boxShadow: sel ? '0 3px 10px rgba(242,169,0,0.3)' : 'none',
                        }}>
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ── チラシ画像 ── */}
              <p className="section-hd" style={{ paddingLeft: 4, marginBottom: 8 }}>チラシ画像</p>
              <div style={{ marginBottom: 24 }}>
                {imagePreview ? (
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
                    <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}/>
                    <button onClick={() => { setImagePreview(null); setImageFile(null) }} className="itap"
                      style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <FiX size={13}/>
                    </button>
                  </div>
                ) : (
                  <label className="itap" style={{ display: 'flex', alignItems: 'center', gap: 12, border: '2px dashed var(--sep)', borderRadius: 16, padding: '14px 16px', cursor: 'pointer', background: 'rgba(255,255,255,0.6)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiCamera size={17} style={{ color: 'var(--label2)' }}/>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)', margin: 0 }}>画像を選択</p>
                      <p style={{ fontSize: 11, color: 'var(--label2)', margin: '2px 0 0' }}>JPG / PNG / HEIC 対応</p>
                    </div>
                    <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]) }}/>
                  </label>
                )}
              </div>

              {/* ── Save button ── */}
              <button onClick={handleSave} className="itap" style={{
                width: '100%', height: 52, borderRadius: 16,
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dk) 100%)',
                border: 'none', color: '#fff', fontSize: 16, fontWeight: 800,
                letterSpacing: '-0.2px',
                boxShadow: '0 4px 16px rgba(242,169,0,0.35)',
                marginBottom: 4,
              }}>
                {editData ? "変更を保存" : "作成する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Blind Preset modal ────────────────────────────────────────────────── */}
      {isBlindModalOpen && typeof window !== "undefined" && createPortal(
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div style={{
            width: '100%', maxWidth: BLIND_MODAL_W,
            maxHeight: `min(${BLIND_MODAL_H}px, 92dvh)`,
            display: 'flex', flexDirection: 'column',
            borderRadius: '28px 28px 0 0',
            background: blindModalView === "edit" ? '#F2F2F7' : '#fff',
            overflow: 'hidden',
            transform: `scale(${blindModalScale})`, transformOrigin: 'center bottom',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(60,60,67,0.2)' }}/>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {blindModalView === "edit" && (
                  <button onClick={() => setBlindModalView("list")} className="itap"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', borderRadius: 99, background: 'rgba(120,120,128,0.14)', border: 'none', color: 'var(--label)', fontSize: 13, fontWeight: 600 }}>
                    ← 一覧
                  </button>
                )}
                <p style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.4px', color: 'var(--label)' }}>
                  {blindModalView === "list" ? "Blind Presets" : editingBlindPresetId ? "プリセット編集" : "新規プリセット"}
                </p>
              </div>
              <button onClick={closeBlindModal} className="itap"
                style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(120,120,128,0.18)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)' }}>
                <FiX size={14}/>
              </button>
            </div>

            {blindModalView === "list" ? (
              /* ─ List view ─ */
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                {blindPresets.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 10 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiZap size={22} style={{ color: 'var(--label2)' }}/>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--label2)', margin: 0, fontWeight: 500 }}>プリセットがまだありません</p>
                    <p style={{ fontSize: 12, color: 'var(--label2)', margin: 0 }}>下のボタンから作成してください</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {blindPresets.map((preset, i) => {
                      const lvCount  = Array.isArray(preset.levels) ? preset.levels.filter((l: any) => l.type === "level").length : 0
                      const brkCount = Array.isArray(preset.levels) ? preset.levels.filter((l: any) => l.type === "break").length : 0
                      return (
                        <div key={preset.id} className="itap" onClick={() => openEditBlindPreset(preset)}
                          style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid var(--sep)', cursor: 'pointer' }}>
                          {/* Left accent circle */}
                          <div style={{ width: 42, height: 42, borderRadius: 13, background: `linear-gradient(135deg, var(--gold) 0%, var(--gold-dk) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{i + 1}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</p>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold-dk)', background: 'rgba(242,169,0,0.1)', borderRadius: 99, padding: '2px 7px' }}>Lv {lvCount}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#007AFF', background: 'rgba(0,122,255,0.08)', borderRadius: 99, padding: '2px 7px' }}>Break {brkCount}</span>
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); deleteBlindPreset(preset.id) }} className="itap"
                            style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,59,48,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30', flexShrink: 0 }}>
                            <FiTrash2 size={13}/>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ─ Edit view ─ */
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {/* Name field */}
                <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '0 14px', display: 'flex', alignItems: 'center', height: 50, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--label)', flexShrink: 0, width: 72 }}>名称</span>
                    <input value={blindPresetName} onChange={e => setBlindPresetName(e.target.value)}
                      style={{ flex: 1, height: 50, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--label)', textAlign: 'right' }}
                      placeholder="例: 通常トーナメント" autoFocus
                    />
                  </div>
                </div>
                {/* Bulk change */}
                <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label2)', flexShrink: 0 }}>一括時間変更</span>
                    <input type="number" value={bulkDuration} onChange={e => setBulkDuration(e.target.value)} placeholder="分"
                      className="no-spin"
                      style={{ width: 52, height: 32, borderRadius: 9, border: '1.5px solid var(--sep)', background: '#F9F9F9', padding: '0 8px', fontSize: 13, color: 'var(--label)', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--label2)' }}>分</span>
                    <button type="button" onClick={() => {
                      const d = Math.round(Number(bulkDuration))
                      if (!bulkDuration || isNaN(d) || d <= 0) return
                      setBlindLevels(ls => ls.map(l => ({ ...l, duration: d }))); setBulkDuration("")
                    }} className="itap"
                      style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                      変更
                    </button>
                  </div>
                </div>
                {/* Level list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>
                  <p className="section-hd" style={{ paddingLeft: 2 }}>レベルリスト</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {blindLevels.map((lv, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <div className="blind-level-item"
                          draggable onDragStart={() => setBlindDragIndex(idx)} onDragEnter={() => setBlindDropIndex(idx)}
                          onDragEnd={() => {
                            if (blindDragIndex === null || blindDropIndex === null || blindDragIndex === blindDropIndex) { setBlindDragIndex(null); setBlindDropIndex(null); return }
                            const nl = [...blindLevels]; const [m] = nl.splice(blindDragIndex, 1); nl.splice(blindDropIndex, 0, m)
                            setBlindLevels(nl); setBlindDragIndex(null); setBlindDropIndex(null)
                          }}
                          style={{
                            background: lv.type === "break" ? 'rgba(0,122,255,0.04)' : '#fff',
                            borderRadius: 14, overflow: 'hidden', opacity: blindDragIndex === idx ? 0.5 : 1,
                            border: lv.type === "break" ? '1.5px solid rgba(0,122,255,0.15)' : '1px solid var(--sep)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          }}
                        >
                          {/* Row header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px 5px' }}>
                            <span style={{ cursor: 'move', color: 'var(--label3)', fontSize: 14, userSelect: 'none', flexShrink: 0, lineHeight: 1 }}>⠿</span>
                            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 38, color: lv.type === "level" ? 'var(--gold-dk)' : '#007AFF' }}>
                              {lv.type === "level" ? `Lv ${blindLevels.slice(0, idx).filter(l => l.type === "level").length + 1}` : "Break"}
                            </span>
                            <button type="button" onClick={() => setBlindEditingCommentIdx(blindEditingCommentIdx === idx ? null : idx)} className="itap"
                              style={{ flex: 1, padding: '3px 8px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: lv.comment ? 'rgba(242,169,0,0.1)' : 'var(--fill)', color: lv.comment ? 'var(--gold-dk)' : 'var(--label2)', border: 'none', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lv.comment || "コメント追加"}
                            </button>
                            <button type="button" onClick={() => setBlindContextMenuIdx(blindContextMenuIdx === idx ? null : idx)} className="itap"
                              style={{ width: 26, height: 26, borderRadius: 7, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)', flexShrink: 0 }}>
                              <FiMoreHorizontal size={13}/>
                            </button>
                            <button onClick={() => removeBlindLevel(idx)} className="itap"
                              style={{ width: 26, height: 26, borderRadius: 7, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30', flexShrink: 0 }}>
                              <FiTrash2 size={12}/>
                            </button>
                          </div>
                          {/* Inputs */}
                          {lv.type === "level" ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, padding: '0 10px 10px' }}>
                              {([["SB", "smallBlind", (e: any) => {
                                  const raw = e.target.value
                                  if (raw === "" || raw === "-") { setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, smallBlind: null })); return }
                                  const v = Math.round(Number(raw))
                                  setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, smallBlind: v, bigBlind: Math.round(v*2), ante: Math.round(v*2) }))
                                }],
                                ["BB", "bigBlind", (e: any) => handleBlindBbChange(idx, e.target.value === "" ? null : Number(e.target.value))],
                                ["ANTE", "ante", (e: any) => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, ante: e.target.value === "" ? null : Math.round(Number(e.target.value)) }))],
                                ["MIN", "duration", (e: any) => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, duration: Math.max(1, Math.round(Number(e.target.value))) }))],
                              ] as [string, string, (e: any) => void][]).map(([lbl, key, handler]) => (
                                <div key={lbl} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--label2)', textAlign: 'center', letterSpacing: '0.04em' }}>{lbl}</span>
                                  <input type="number" value={(lv as any)[key] ?? ""} placeholder="—"
                                    onChange={handler} className="no-spin"
                                    style={{ width: '100%', height: 34, borderRadius: 9, border: '1.5px solid var(--sep)', background: '#F9F9F9', fontSize: 13, color: 'var(--label)', outline: 'none', textAlign: 'center', boxSizing: 'border-box', padding: 0 }}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: '0 10px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: '#007AFF', fontWeight: 600 }}>時間</span>
                              <input type="number" value={lv.duration ?? ""} placeholder="10"
                                onChange={e => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, duration: Math.max(1, Math.round(Number(e.target.value))) }))}
                                className="no-spin"
                                style={{ width: 70, height: 34, borderRadius: 9, border: '1.5px solid rgba(0,122,255,0.2)', background: 'rgba(0,122,255,0.04)', fontSize: 13, color: '#007AFF', outline: 'none', textAlign: 'center', boxSizing: 'border-box', padding: 0 }}
                              />
                              <span style={{ fontSize: 11, color: '#007AFF' }}>分</span>
                            </div>
                          )}
                          {/* Comment row */}
                          {(blindEditingCommentIdx === idx || lv.comment) && (
                            <div className="blind-comment-expand" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 10px' }}>
                              <input type="text" placeholder="コメントを入力…" value={lv.comment ?? ""}
                                onChange={e => setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, comment: e.target.value || null }))}
                                style={{ flex: 1, height: 30, borderRadius: 8, border: '1.5px solid var(--sep)', background: '#fff', padding: '0 10px', fontSize: 12, color: 'var(--label)', outline: 'none' }}
                                autoFocus={blindEditingCommentIdx === idx}
                              />
                              <button type="button" onClick={() => { setBlindLevels(ls => ls.map((l, i) => i !== idx ? l : { ...l, comment: null })); setBlindEditingCommentIdx(null) }} className="itap"
                                style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)', flexShrink: 0 }}>
                                <FiX size={9}/>
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Context menu */}
                        {blindContextMenuIdx === idx && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setBlindContextMenuIdx(null)}/>
                            <div style={{ position: 'absolute', right: 40, top: 4, zIndex: 200, background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid var(--sep)', overflow: 'hidden', minWidth: 170 }}>
                              {([["この前にレベルを追加", () => insertLevelBefore(idx)], ["この後にレベルを追加", () => insertLevelAfter(idx)]] as [string, () => void][]).map(([label, action]) => (
                                <button key={label} type="button" onClick={action} className="itap"
                                  style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 13, color: 'var(--label)', background: 'none', border: 'none', cursor: 'pointer', display: 'block' }}>
                                  {label}
                                </button>
                              ))}
                              <div style={{ height: 1, background: 'var(--sep)' }}/>
                              <button type="button" onClick={() => toggleLevelBreak(idx)} className="itap"
                                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer', display: 'block' }}>
                                {lv.type === "level" ? "ブレイクに変更" : "レベルに変更"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Add level/break */}
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--sep)', flexShrink: 0, display: 'flex', gap: 8 }}>
                  <button onClick={addBlindLevel} className="itap"
                    style={{ flex: 1, height: 40, borderRadius: 12, background: 'rgba(242,169,0,0.08)', border: '1.5px solid rgba(242,169,0,0.35)', color: 'var(--gold-dk)', fontSize: 13, fontWeight: 700 }}>
                    ＋ レベル
                  </button>
                  <button onClick={addBlindBreak} className="itap"
                    style={{ flex: 1, height: 40, borderRadius: 12, background: 'rgba(0,122,255,0.06)', border: '1.5px solid rgba(0,122,255,0.25)', color: '#007AFF', fontSize: 13, fontWeight: 700 }}>
                    ＋ ブレイク
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
              {blindModalView === "list" ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={openNewBlindPreset} className="itap" style={{
                    flex: 1, height: 50, borderRadius: 14,
                    background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dk) 100%)',
                    border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                    boxShadow: '0 4px 14px rgba(242,169,0,0.32)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <FiPlus size={16}/> 新規作成
                  </button>
                  <button onClick={() => { setAiView("input"); setAiError(""); setIsAiOpen(true) }} className="itap" style={{
                    flex: 1, height: 50, borderRadius: 14,
                    background: 'var(--label)',
                    border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  }}>
                    <FiZap size={14}/> AI生成
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveBlindPreset} className="itap" style={{
                    flex: 2, height: 50, borderRadius: 14,
                    background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dk) 100%)',
                    border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                    boxShadow: '0 4px 14px rgba(242,169,0,0.32)',
                  }}>
                    保存する
                  </button>
                  <button onClick={() => setBlindModalView("list")} className="itap" style={{
                    flex: 1, height: 50, borderRadius: 14,
                    background: 'rgba(120,120,128,0.14)', border: 'none',
                    color: 'var(--label)', fontSize: 14, fontWeight: 600,
                  }}>
                    戻る
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── AI modal ─────────────────────────────────────────────────────────── */}
      {isAiOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
          <div style={{
            width: AI_MODAL_W, maxHeight: `min(${AI_MODAL_H}px, 90vh)`,
            borderRadius: '20px 20px 0 0', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            transform: `scale(${aiModalScale})`, transformOrigin: 'center bottom',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--sep)' }}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--sep)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiZap size={14} style={{ color: 'var(--gold)' }}/>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--label)' }}>
                  {aiView === "input" ? "AIストラクチャー生成" : "プレビュー"}
                </p>
              </div>
              <button onClick={() => setIsAiOpen(false)} className="itap"
                style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)' }}>
                <FiX size={12}/>
              </button>
            </div>
            {aiView === "input" ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p className="section-hd">プリセット名</p>
                  <input value={aiPresetName} onChange={e => setAiPresetName(e.target.value)} placeholder="例: 3時間RC構成"
                    style={{ width: '100%', height: 40, borderRadius: 11, border: '1.5px solid var(--sep)', background: '#F9F9F9', padding: '0 12px', fontSize: 13, color: 'var(--label)', outline: 'none', boxSizing: 'border-box' }}/>
                </div>
                <div>
                  <p className="section-hd">使用チップ</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {AI_CHIP_OPTIONS.map(chip => (
                      <button key={chip} type="button" onClick={() => setAiChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])} className="itap"
                        style={{ height: 34, padding: '0 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, border: '1px solid var(--sep)', background: aiChips.includes(chip) ? 'var(--gold)' : '#fff', color: aiChips.includes(chip) ? '#fff' : 'var(--label)', boxShadow: aiChips.includes(chip) ? '0 2px 6px rgba(242,169,0,0.25)' : 'none' }}>
                        {chip.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="section-hd">スタートスタック（チップ合計）</p>
                  <input type="number" value={aiStack} onChange={e => setAiStack(e.target.value)} placeholder="例: 30000"
                    style={{ width: '100%', height: 40, borderRadius: 11, border: '1.5px solid var(--sep)', background: '#F9F9F9', padding: '0 12px', fontSize: 13, color: 'var(--label)', outline: 'none', boxSizing: 'border-box' }}/>
                </div>
                <div>
                  <p className="section-hd">RC時間（スタートから何時間）</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" step="0.5" min="0.5" value={aiRcHours} onChange={e => setAiRcHours(e.target.value)} placeholder="例: 3"
                      style={{ width: 90, height: 40, borderRadius: 11, border: '1.5px solid var(--sep)', background: '#F9F9F9', padding: '0 12px', fontSize: 13, color: 'var(--label)', outline: 'none', boxSizing: 'border-box' }}/>
                    <span style={{ fontSize: 12, color: 'var(--label2)' }}>時間</span>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--label2)', marginTop: 5 }}>RC直前10分ブレイク終了=RC時刻になるよう自動調整されます</p>
                </div>
                {aiError && <p style={{ fontSize: 11, color: 'var(--gold-dk)', fontWeight: 600, textAlign: 'center' }}>{aiError}</p>}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                <p style={{ fontSize: 11, color: 'var(--label2)', marginBottom: 10 }}>
                  レベル数: {aiPreviewLevels.filter(l => l.type === "level").length} / ブレイク: {aiPreviewLevels.filter(l => l.type === "break").length}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {aiPreviewLevels.map((lv, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10,
                      background: lv.type === "break" ? 'rgba(242,169,0,0.07)' : '#F9F9F9',
                      fontSize: 12, color: lv.type === "break" ? 'var(--gold-dk)' : 'var(--label)', fontWeight: lv.type === "break" ? 600 : 400,
                    }}>
                      {lv.type === "break" ? (
                        <><span>☕</span><span>{lv.duration === 10 ? "RC直前ブレイク" : "ブレイク"} {lv.duration}分</span></>
                      ) : (
                        <>
                          <span style={{ width: 20, textAlign: 'center', fontWeight: 700, color: 'var(--label2)', fontSize: 11 }}>
                            {aiPreviewLevels.slice(0, i).filter(l => l.type === "level").length + 1}
                          </span>
                          <span style={{ flex: 1 }}>{lv.smallBlind}/{lv.bigBlind}</span>
                          <span style={{ color: 'var(--label2)' }}>{lv.duration}min</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--sep)', flexShrink: 0 }}>
              {aiView === "input" ? (
                <button onClick={() => {
                  setAiError("")
                  const stack = Number(aiStack), rc = Number(aiRcHours)
                  if (!aiChips.length) { setAiError("チップを1つ以上選択してください"); return }
                  if (!stack || stack <= 0) { setAiError("スタートスタックを入力してください"); return }
                  if (!rc || rc <= 0) { setAiError("RC時間を入力してください"); return }
                  const result = aiGenerate(aiChips, stack, rc)
                  if (!result.length) { setAiError("有効な構成を生成できませんでした"); return }
                  setAiPreviewLevels(result); setAiView("preview")
                }} className="itap"
                  style={{ width: '100%', height: 44, borderRadius: 12, background: 'var(--label)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FiZap size={14}/> プレビューを生成
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAiView("input")} className="itap"
                    style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--fill)', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>
                    戻る
                  </button>
                  <button onClick={() => {
                    setBlindPresetName(aiPresetName || "AIプリセット")
                    setBlindLevels(aiPreviewLevels)
                    setEditingBlindPresetId(null)
                    setBlindModalView("edit")
                    setIsAiOpen(false)
                    setAiView("input")
                  }} className="itap"
                    style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--gold)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(242,169,0,0.28)' }}>
                    適用する
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <StoreBottomNav />
    </main>
  )
}
