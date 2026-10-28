"use client"
import { AwardIcon, CalendarIcon, CameraIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CoffeeIcon, CopyIcon, PencilIcon, PlayIcon, PlusIcon, RepeatIcon, SearchIcon, Trash2Icon, TrophyIcon, XIcon, ZapIcon } from 'lucide-react'

import { useEffect, useRef, useState } from "react"
import {
  collection, onSnapshot, doc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore"
import { db, auth, storage } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import StoreBottomNav from "@/components/StoreBottomNav"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import AppleSheet from "@/components/AppleSheet"
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog"

import BlindLevelEditor, { type Level, fmtMinutes, validateLevels, withBreak, withNextLevel } from "@/components/BlindLevelEditor"

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
  const [bulkDuration, setBulkDuration] = useState("")
  // 保存中・入力エラー・削除の確認
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [blindError, setBlindError] = useState("")
  const [blindSaving, setBlindSaving] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmRequest | null>(null)
  /** ブラインド編集を開いた時点の中身。閉じるときに変更があるか比べる。 */
  const blindSnapshot = useRef("")

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


  // ── フォーム ───────────────────────────────────────────────────────────
  const handleChange = (key: string, value: string) => { setFormError(""); setForm(prev => ({ ...prev, [key]: value })) }
  const handleImageSelect = (file: File) => { setImageFile(file); setImagePreview(URL.createObjectURL(file)) }
  const uploadImageIfNeeded = async (): Promise<string> => {
    if (!imageFile || !storeId) return imagePreview ? (form.flyerUrl || "") : ""
    const fileRef = ref(storage, `tournaments/${storeId}/${Date.now()}_${imageFile.name}`)
    await uploadBytes(fileRef, imageFile)
    return await getDownloadURL(fileRef)
  }
  const openCreate = () => {
    setEditData(null); setRepeatWeekly(false); setBlindPresetId(""); setImageFile(null); setImagePreview(null)
    setForm({ ...emptyForm, date: todayStr() }); setFormError(""); setOpenModal(true)
  }
  const closeModal = () => {
    setOpenModal(false); setEditData(null); setImageFile(null); setImagePreview(null)
    setRepeatWeekly(false); setBlindPresetId(""); setForm(emptyForm); setFormError("")
  }
  const handleSave = async () => {
    if (!storeId || saving) return
    // 入力の誤りは送信前に、その場で示す(アラートで止めない)。
    if (!form.name.trim()) { setFormError("名称を入力してください"); return }
    if (!form.date) { setFormError("開催日を選んでください"); return }
    if (Number(form.entryFee) === 0 && Number(form.reentryFee) === 0 && Number(form.addonFee) === 0) {
      setFormError("エントリー・リエントリー・アドオンのどれか1つは、参加費を1以上にしてください"); return
    }
    setSaving(true)
    try {
      const flyerUrl = await uploadImageIfNeeded()
      const payload = {
        name: form.name.trim(), date: form.date, startTime: form.startTime, rcTime: form.rcTime,
        entryFee: Number(form.entryFee) || 0, reentryFee: Number(form.reentryFee) || 0, addonFee: Number(form.addonFee) || 0,
        entryStack: Number(form.entryStack) || 0, reentryStack: Number(form.reentryStack) || 0, addonStack: Number(form.addonStack) || 0,
        flyerUrl, repeatWeekly, blindPresetId,
        bustCount: editData?.bustCount ?? 0,
        status: editData ? (editData.status ?? "scheduled") : "scheduled",
        createdAt: editData?.createdAt ?? serverTimestamp(),
      }
      if (editData) await updateDoc(doc(db, "stores", storeId, "tournaments", editData.id), payload)
      else await addDoc(collection(db, "stores", storeId, "tournaments"), payload)
      setSaving(false)
      closeModal()
    } catch {
      setFormError("保存できませんでした。通信状態を確かめて、もう一度お試しください")
      setSaving(false)
    }
  }
  const askDeleteTournament = (t: any) => setConfirmState({
    title: "トーナメントを削除",
    message: `「${t.name || "名称なし"}」を削除します。参加記録も見られなくなります。元に戻せません。`,
    action: "削除", destructive: true,
    run: async () => { if (storeId) await deleteDoc(doc(db, "stores", storeId, "tournaments", t.id)) },
  })
  const handleEdit = (t: any) => {
    setEditData(t); setRepeatWeekly(t.repeatWeekly ?? false); setBlindPresetId(t.blindPresetId ?? "")
    setImageFile(null); setImagePreview(t.flyerUrl || null); setFormError("")
    setForm({ name: t.name ?? "", date: typeof t.date === "string" ? t.date : "", startTime: t.startTime ?? "", rcTime: t.rcTime ?? "",
      entryFee: String(t.entryFee ?? ""), reentryFee: String(t.reentryFee ?? ""), addonFee: String(t.addonFee ?? ""),
      entryStack: String(t.entryStack ?? ""), reentryStack: String(t.reentryStack ?? ""), addonStack: String(t.addonStack ?? ""), flyerUrl: t.flyerUrl ?? "" })
    setOpenModal(true)
  }
  const handleCopy = (t: any) => {
    setEditData(null); setRepeatWeekly(false); setBlindPresetId(t.blindPresetId ?? ""); setImageFile(null); setImagePreview(t.flyerUrl || null); setFormError("")
    setForm({ name: t.name ?? "", date: todayStr(), startTime: t.startTime ?? "", rcTime: t.rcTime ?? "",
      entryFee: String(t.entryFee ?? ""), reentryFee: String(t.reentryFee ?? ""), addonFee: String(t.addonFee ?? ""),
      entryStack: String(t.entryStack ?? ""), reentryStack: String(t.reentryStack ?? ""), addonStack: String(t.addonStack ?? ""), flyerUrl: t.flyerUrl ?? "" })
    setOpenModal(true)
  }
  const askStartTournament = (t: any) => setConfirmState({
    title: "トーナメントを開始",
    message: `「${t.name || "名称なし"}」を開催中にします。店舗ホームにタイマーが表示されます。`,
    action: "開始する",
    run: async () => {
      if (!storeId) return
      setStartingId(t.id)
      try { await updateDoc(doc(db, "stores", storeId, "tournaments", t.id), { status: "active", startedAt: serverTimestamp() }) }
      finally { setStartingId(null) }
    },
  })

  // ── ブラインド ─────────────────────────────────────────────────────────
  const setLevels = (fn: (ls: Level[]) => Level[]) => { setBlindError(""); setBlindLevels(fn) }
  function addBlindLevel() { setLevels(withNextLevel) }
  function addBlindBreak() { setLevels(withBreak) }
  const snapshotOf = (name: string, levels: Level[]) => JSON.stringify({ name, levels })
  function openEditBlindPreset(preset: any) {
    const levels = Array.isArray(preset.levels) && preset.levels.length > 0 ? preset.levels : [{ ...emptyBlindLevel }]
    setEditingBlindPresetId(preset.id); setBlindPresetName(preset.name); setBlindLevels(levels)
    blindSnapshot.current = snapshotOf(preset.name, levels); setBlindError(""); setBlindModalView("edit")
  }
  function openNewBlindPreset() {
    const levels: Level[] = [{ type: "level", smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 }]
    setEditingBlindPresetId(null); setBlindPresetName(""); setBlindLevels(levels)
    blindSnapshot.current = snapshotOf("", levels); setBlindError(""); setBlindModalView("edit")
  }
  const blindDirty = blindModalView === "edit" && snapshotOf(blindPresetName, blindLevels) !== blindSnapshot.current
  function resetBlindEditor() {
    setBlindModalView("list"); setEditingBlindPresetId(null); setBlindPresetName("")
    setBlindLevels([{ ...emptyBlindLevel }]); setBlindError("")
  }
  /** 変更を捨ててよいか確かめてから進む。変更が無ければそのまま進む。 */
  function guardDiscard(next: () => void) {
    if (!blindDirty) { next(); return }
    setConfirmState({ title: "変更を破棄しますか？", message: "保存していない変更は失われます。", action: "破棄", destructive: true, run: next })
  }
  function closeBlindModal() { guardDiscard(() => { setIsBlindModalOpen(false); resetBlindEditor() }) }
  function backToBlindList() { guardDiscard(resetBlindEditor) }
  async function saveBlindPreset() {
    if (!storeId || blindSaving) return
    if (!blindPresetName.trim()) { setBlindError("プリセット名を入力してください"); return }
    const invalid = validateLevels(blindLevels)
    if (invalid) { setBlindError(invalid); return }
    setBlindSaving(true)
    try {
      const data = { name: blindPresetName.trim(), levels: blindLevels }
      if (editingBlindPresetId) await updateDoc(doc(db, "stores", storeId, "blindPresets", editingBlindPresetId), data)
      else await addDoc(collection(db, "stores", storeId, "blindPresets"), { ...data, createdAt: serverTimestamp() })
      await refreshPresets(storeId)
      resetBlindEditor()
    } catch {
      setBlindError("保存できませんでした。もう一度お試しください")
    } finally {
      setBlindSaving(false)
    }
  }
  const askDeletePreset = (preset: any) => setConfirmState({
    title: "プリセットを削除",
    message: `「${preset.name}」を削除します。このプリセットを使うトーナメントは「ブラインドなし」になります。`,
    action: "削除", destructive: true,
    run: async () => { if (storeId) { await deleteDoc(doc(db, "stores", storeId, "blindPresets", preset.id)); await refreshPresets(storeId) } },
  })
  const runAi = () => {
    setAiError("")
    const stack = Number(aiStack), rc = Number(aiRcHours)
    if (!aiChips.length) { setAiError("使うチップを1つ以上選んでください"); return }
    if (!stack || stack <= 0) { setAiError("スタートスタックを入力してください"); return }
    if (!rc || rc <= 0) { setAiError("レジスト締切までの時間を入力してください"); return }
    const result = aiGenerate(aiChips, stack, rc)
    if (!result.length) { setAiError("この条件では構成を作れませんでした。時間かスタックを変えてください"); return }
    setAiPreviewLevels(result); setAiView("preview")
  }

  // ── 表示用の値 ─────────────────────────────────────────────────────────
  // 開催中を先頭に、残りは開催日・開始時刻の早い順に並べる。
  const currentTournaments = tournaments
    .filter(t => t.status !== "finished")
    .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1)
      || `${a.date || "9999"} ${a.startTime}`.localeCompare(`${b.date || "9999"} ${b.startTime}`))
  const tabDayIndex = DAYS.indexOf(activeTab as DayChar)
  const tabTemplates = tabDayIndex >= 0 ? tournaments.filter(t => t.repeatWeekly === true && t.status !== "finished" && getDOW(t.date) === tabDayIndex) : []
  const tabInstances = tabDayIndex >= 0 ? tournaments.filter(t => t.templateId && t.status !== "finished" && getDOW(t.date) === tabDayIndex) : []
  const tabHistory = activeTab === "履歴"
    ? tournaments.filter(t => t.status === "finished" && (!historySearch || t.name.toLowerCase().includes(historySearch.toLowerCase())))
    : []
  const presetName = (id: string) => blindPresets.find(p => p.id === id)?.name
  const countsOf = (id: string) => {
    const entries = entriesMap[id] ?? []
    return {
      entry: entries.reduce((s: number, e: any) => s + (e.entryCount ?? 0) + (e.reentryCount ?? 0), 0),
      reentry: entries.reduce((s: number, e: any) => s + (e.reentryCount ?? 0), 0),
      addon: entries.reduce((s: number, e: any) => s + (e.addonCount ?? 0), 0),
    }
  }
  const unit = (n: number) => fmtChip(n, chipUnit, chipUnitBefore)
  const totalMinutes = blindLevels.reduce((s, l) => s + (l.duration ?? 0), 0)

  // ── 描画 ───────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100dvh', paddingBottom: 128, background: 'var(--t-bg)', color: 'var(--label)' }}>
      <style>{`
        :root {
          --t-bg: #F2F2F7;
          --sep: rgba(60,60,67,0.12);
          --fill: rgba(120,120,128,0.12);
          --gold: #F2A900;
          --gold-dk: #B57F00;
          --blue: #0A6CD6;
        }
        .tp-press { transition: transform 100ms ease-out, background-color 100ms ease-out, opacity 100ms ease-out; -webkit-tap-highlight-color: transparent; cursor: pointer; }
        .tp-press:active { transform: scale(0.97); }
        .tp-row:active { background: rgba(60,60,67,0.06); }
        .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spin { -moz-appearance: textfield; }
        .tp-input:focus { box-shadow: inset 0 0 0 2px var(--gold); background: #fff; }
        .tp-live { animation: tpLive 2s ease-in-out infinite; }
        @keyframes tpLive { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
        @media (prefers-reduced-motion: reduce) { .tp-live { animation: none } .tp-press:active { transform: none } }
      `}</style>

      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>

        {/* 大見出し + 主な操作 */}
        <header style={{ padding: '16px 0 24px' }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>トーナメント</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={openCreate} className="tp-press" style={{ ...btn.primary, flex: 1, minWidth: 0, padding: '0 16px' }}>
              <PlusIcon size={20} strokeWidth={2.5} /> トーナメントを作成
            </button>
            <button type="button" onClick={() => { resetBlindEditor(); setIsBlindModalOpen(true) }} className="tp-press" style={{ ...btn.secondary, padding: '0 16px' }}>
              <ZapIcon size={20} /> ブラインド
            </button>
          </div>
        </header>

        {/* 開催中・予定 */}
        <GroupLabel>開催中・予定</GroupLabel>
        {currentTournaments.length === 0 ? (
          <EmptyCard
            icon={<TrophyIcon size={32} />}
            title="予定のトーナメントはありません"
            body="「トーナメントを作成」から追加できます。"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
            {currentTournaments.map(t => {
              const c = countsOf(t.id)
              const isActive = t.status === "active"
              return (
                <article key={t.id} style={{ ...card, boxShadow: isActive ? 'inset 0 0 0 2px rgba(242,169,0,0.6)' : card.boxShadow }}>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <StatusBadge status={t.status} />
                      {t.repeatWeekly && <Chip icon={<RepeatIcon size={12} />}>毎週</Chip>}
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', margin: 0, overflowWrap: 'anywhere' }}>{t.name || "名称なし"}</h2>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 15, color: 'var(--label2)' }}>
                      <span style={metaItem}><CalendarIcon size={16} /> {t.date || "日付未定"}</span>
                      {t.startTime && <span style={metaItem}><ClockIcon size={16} /> {t.startTime} 開始</span>}
                      {t.rcTime && <span style={metaItem}>締切 {t.rcTime}</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
                      <Stat label="エントリー" value={c.entry} />
                      <Stat label="リエントリー" value={c.reentry} />
                      <Stat label="アドオン" value={c.addon} />
                    </div>
                    {t.blindPresetId && presetName(t.blindPresetId) && (
                      <p style={{ fontSize: 13, color: 'var(--label2)', margin: '16px 0 0' }}>ブラインド: {presetName(t.blindPresetId)}</p>
                    )}
                  </div>
                  {t.status === "scheduled" && (
                    <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
                      <button type="button" onClick={() => askStartTournament(t)} disabled={!!startingId} className="tp-press" style={{ ...btn.primary, flex: 1, opacity: startingId ? 0.5 : 1 }}>
                        <PlayIcon size={20} fill="currentColor" /> {startingId === t.id ? "開始しています…" : "開始する"}
                      </button>
                      <button type="button" onClick={() => handleEdit(t)} className="tp-press" style={btn.icon} aria-label="編集">
                        <PencilIcon size={20} />
                      </button>
                      <button type="button" onClick={() => askDeleteTournament(t)} className="tp-press" style={{ ...btn.icon, color: '#D70015' }} aria-label="削除">
                        <Trash2Icon size={20} />
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {/* 週間スケジュール */}
        <GroupLabel>週間スケジュール</GroupLabel>
        <div role="tablist" aria-label="曜日" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 4, padding: 4, background: 'rgba(118,118,128,0.12)', borderRadius: 16, marginBottom: 16 }}>
          {([...DAYS, "履歴"] as string[]).map(tab => {
            const isAct = activeTab === tab
            const isToday = tab !== "履歴" && DAYS.indexOf(tab as DayChar) === new Date().getDay()
            return (
              <button key={tab} type="button" role="tab" aria-selected={isAct} onClick={() => setActiveTab(tab)} className="tp-press"
                style={{
                  minHeight: 44, borderRadius: 12, border: 'none', position: 'relative',
                  background: isAct ? '#fff' : 'transparent',
                  boxShadow: isAct ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  color: 'var(--label)', fontSize: tab === "履歴" ? 13 : 15, fontWeight: isAct ? 700 : 500,
                }}>
                {tab}
                {isToday && <span aria-label="今日" style={{ position: 'absolute', bottom: 4, left: '50%', width: 4, height: 4, marginLeft: -2, borderRadius: 2, background: 'var(--gold)' }} />}
              </button>
            )
          })}
        </div>

        {activeTab === "履歴" ? (
          <>
            <SearchField value={historySearch} onChange={setHistorySearch} placeholder="トーナメント名で検索" />
            {tabHistory.length === 0 ? (
              <EmptyCard icon={<SearchIcon size={32} />} title={historySearch ? "見つかりませんでした" : "終了したトーナメントはまだありません"} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {tabHistory.map(t => {
                  const c = countsOf(t.id)
                  const players = (entriesMap[t.id] ?? []).filter((e: any) => (e.entryCount ?? 0) > 0 || (e.reentryCount ?? 0) > 0 || (e.addonCount ?? 0) > 0)
                  return (
                    <article key={t.id} style={card}>
                      <div style={{ padding: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, overflowWrap: 'anywhere' }}>{t.name || "名称なし"}</h2>
                          <p style={{ fontSize: 13, color: 'var(--label2)', margin: '4px 0 0' }}>
                            {t.startedAt || t.createdAt} ・ エントリー {c.entry} / リエントリー {c.reentry} / アドオン {c.addon}
                          </p>
                        </div>
                        <button type="button" onClick={() => handleCopy(t)} className="tp-press" style={btn.icon} aria-label="この内容で新しく作成">
                          <CopyIcon size={20} />
                        </button>
                        <button type="button" onClick={() => askDeleteTournament(t)} className="tp-press" style={{ ...btn.icon, color: '#D70015' }} aria-label="削除">
                          <Trash2Icon size={20} />
                        </button>
                      </div>
                      {players.length > 0 && (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--sep)' }}>
                          {players.map((e: any, i: number) => {
                            const payout = t.payouts?.find((p: any) => p.playerId === e.id)
                            return (
                              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '8px 16px', borderTop: i ? '1px solid var(--sep)' : 'none' }}>
                                {payout && typeof payout.rank === "number"
                                  ? <span style={rankBadge}>{payout.rank}</span>
                                  : <span style={{ width: 24, flexShrink: 0 }} />}
                                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: payout ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {typeof e.name === "string" && e.name ? e.name : e.id}
                                </span>
                                <span style={{ fontSize: 13, color: 'var(--label2)', fontVariantNumeric: 'tabular-nums' }}>
                                  E{e.entryCount ?? 0} R{e.reentryCount ?? 0} A{e.addonCount ?? 0}
                                </span>
                                {payout && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 700, color: 'var(--gold-dk)' }}>
                                    <AwardIcon size={16} /> {unit(typeof payout.amount === "number" ? payout.amount : 0)}
                                  </span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </>
        ) : tabTemplates.length === 0 && tabInstances.length === 0 ? (
          <EmptyCard icon={<CalendarIcon size={32} />} title={`${activeTab}曜日のトーナメントはありません`} body="作成時に「毎週繰り返す」をオンにすると、ここに並びます。" />
        ) : (
          <>
            {tabTemplates.length > 0 && (
              <>
                <GroupLabel small>毎週の設定</GroupLabel>
                <div style={{ ...list, marginBottom: 24 }}>
                  {tabTemplates.map((t, i) => (
                    <button key={t.id} type="button" onClick={() => handleEdit(t)} className="tp-row" style={{ ...listRow, borderTop: i ? '1px solid var(--sep)' : 'none' }}>
                      <RepeatIcon size={20} style={{ color: 'var(--gold-dk)', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{t.name}</span>
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>次回 {t.date}{t.startTime ? ` ${t.startTime}` : ""}</span>
                      </span>
                      <ChevronRightIcon size={20} style={{ color: 'var(--label3)' }} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {tabInstances.length > 0 && (
              <>
                <GroupLabel small>今後の予定</GroupLabel>
                <div style={list}>
                  {tabInstances.map((t, i) => (
                    <div key={t.id} style={{ ...listRow, cursor: 'default', borderTop: i ? '1px solid var(--sep)' : 'none' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{t.name}</span>
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>{t.date}{t.startTime ? ` ${t.startTime}` : ""}</span>
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── トーナメントの作成・編集 ── */}
      <AppleSheet
        open={openModal}
        onClose={closeModal}
        maxWidth={560}
        maxHeightVh={92}
        zIndex={200}
        title={<SheetTitle title={editData ? "トーナメントを編集" : "新しいトーナメント"} onClose={closeModal} />}
        footer={
          <>
            {formError && <InlineError>{formError}</InlineError>}
            <button type="button" onClick={handleSave} disabled={saving} className="tp-press" style={{ ...btn.primary, width: '100%', opacity: saving ? 0.6 : 1 }}>
              {saving ? "保存しています…" : editData ? "変更を保存" : "作成する"}
            </button>
          </>
        }
      >
        <GroupLabel small>基本情報</GroupLabel>
        <div style={{ ...list, marginBottom: 24 }}>
          <FormRow label="名称">
            <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="例: デイリートーナメント" style={rowInput} enterKeyHint="next" />
          </FormRow>
          <FormRow label="開催日">
            <input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} style={rowInput} />
          </FormRow>
          <FormRow label="開始時刻">
            <input type="time" value={form.startTime} onChange={e => handleChange('startTime', e.target.value)} style={rowInput} />
          </FormRow>
          <FormRow label="レジスト締切" hint="リエントリーを受け付ける最後の時刻">
            <input type="time" value={form.rcTime} onChange={e => handleChange('rcTime', e.target.value)} style={rowInput} />
          </FormRow>
          <FormRow label="毎週繰り返す" hint={repeatWeekly && form.date ? `毎週${DAYS[getDOW(form.date)]}曜日に自動で作成` : "終了後、同じ曜日に次回を自動で作成"} last>
            <button type="button" role="switch" aria-checked={repeatWeekly} aria-label="毎週繰り返す" onClick={() => setRepeatWeekly(v => !v)} className="a-switch" />
          </FormRow>
        </div>

        <GroupLabel small>参加費とスタック</GroupLabel>
        <div style={{ ...list, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '8px 16px 0', fontSize: 13, color: 'var(--label2)', fontWeight: 600 }}>
            <span />
            <span style={{ textAlign: 'center' }}>参加費{chipUnit ? `(${chipUnit})` : ""}</span>
            <span style={{ textAlign: 'center' }}>スタック</span>
          </div>
          {[
            { label: 'エントリー', feeKey: 'entryFee', stackKey: 'entryStack' },
            { label: 'リエントリー', feeKey: 'reentryFee', stackKey: 'reentryStack' },
            { label: 'アドオン', feeKey: 'addonFee', stackKey: 'addonStack' },
          ].map((row, i) => (
            <div key={row.feeKey} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 16px', borderTop: i ? '1px solid var(--sep)' : 'none' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{row.label}</span>
              {[row.feeKey, row.stackKey].map(key => (
                <input key={key} type="number" inputMode="numeric" min={0} value={(form as any)[key]} onChange={e => handleChange(key, e.target.value)} placeholder="0"
                  aria-label={`${row.label} ${key.endsWith('Fee') ? '参加費' : 'スタック'}`}
                  className="no-spin tp-input" style={numInput} />
              ))}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--label2)', margin: '0 8px 24px' }}>使わない項目は 0 のままにします。</p>

        <GroupLabel small>ブラインド</GroupLabel>
        <div style={{ ...list, marginBottom: 24 }}>
          {[{ id: '', name: 'ブラインドなし', levels: [] as any[] }, ...blindPresets].map((p, i) => {
            const sel = blindPresetId === p.id
            const lv = Array.isArray(p.levels) ? p.levels.filter((l: any) => l.type === "level").length : 0
            return (
              <button key={p.id || 'none'} type="button" role="radio" aria-checked={sel} onClick={() => setBlindPresetId(p.id)} className="tp-row" style={{ ...listRow, borderTop: i ? '1px solid var(--sep)' : 'none' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 17 }}>{p.name}</span>
                  {p.id && <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>{lv} レベル</span>}
                </span>
                {sel && <CheckMark />}
              </button>
            )
          })}
          <button type="button" onClick={() => { setIsBlindModalOpen(true); openNewBlindPreset() }} className="tp-row" style={{ ...listRow, borderTop: '1px solid var(--sep)', color: 'var(--gold-dk)', fontWeight: 600 }}>
            <PlusIcon size={20} /> 新しいブラインドを作る
          </button>
        </div>

        <GroupLabel small>チラシ画像</GroupLabel>
        <div style={{ marginBottom: 24 }}>
          {imagePreview ? (
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 選んだ画像のプレビュー */}
              <img src={imagePreview} alt="チラシのプレビュー" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
              <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); handleChange('flyerUrl', '') }} className="tp-press" aria-label="画像を外す"
                style={{ position: 'absolute', top: 8, right: 8, ...btn.icon, background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                <XIcon size={20} />
              </button>
            </div>
          ) : (
            <label className="tp-press" style={{ ...list, display: 'flex', alignItems: 'center', gap: 16, padding: 16, minHeight: 56 }}>
              <CameraIcon size={24} style={{ color: 'var(--label2)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 17 }}>画像を選ぶ</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>プレイヤーの予定に表示されます(任意)</span>
              </span>
              <ChevronRightIcon size={20} style={{ color: 'var(--label3)' }} />
              <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]) }} />
            </label>
          )}
        </div>
      </AppleSheet>

      {/* ── ブラインド(一覧・編集) ── */}
      <AppleSheet
        open={isBlindModalOpen}
        onClose={closeBlindModal}
        maxWidth={640}
        maxHeightVh={94}
        zIndex={300}
        title={
          blindModalView === "list"
            ? <SheetTitle title="ブラインド" onClose={closeBlindModal} />
            : <SheetTitle
                title={editingBlindPresetId ? "ブラインドを編集" : "新しいブラインド"}
                onBack={backToBlindList}
                onClose={closeBlindModal}
                sub={`${blindLevels.filter(l => l.type === "level").length} レベル ・ 合計 ${fmtMinutes(totalMinutes)}`}
              />
        }
        footer={
          blindModalView === "list" ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={openNewBlindPreset} className="tp-press" style={{ ...btn.primary, flex: 1 }}>
                <PlusIcon size={20} strokeWidth={2.5} /> 新しく作る
              </button>
              <button type="button" onClick={() => { setAiView("input"); setAiError(""); setIsAiOpen(true) }} className="tp-press" style={{ ...btn.secondary, flex: 1 }}>
                <ZapIcon size={20} /> 自動で作る
              </button>
            </div>
          ) : (
            <>
              {blindError && <InlineError>{blindError}</InlineError>}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" onClick={addBlindLevel} className="tp-press" style={{ ...btn.secondary, flex: 1 }}>
                  <PlusIcon size={20} /> レベル
                </button>
                <button type="button" onClick={addBlindBreak} className="tp-press" style={{ ...btn.secondary, flex: 1 }}>
                  <CoffeeIcon size={20} /> 休憩
                </button>
              </div>
              <button type="button" onClick={saveBlindPreset} disabled={blindSaving} className="tp-press" style={{ ...btn.primary, width: '100%', opacity: blindSaving ? 0.6 : 1 }}>
                {blindSaving ? "保存しています…" : "保存する"}
              </button>
            </>
          )
        }
      >
        {blindModalView === "list" ? (
          blindPresets.length === 0 ? (
            <EmptyCard icon={<ZapIcon size={32} />} title="ブラインドがまだありません" body="「新しく作る」で1から作るか、「自動で作る」でスタックと時間から作れます。" flat />
          ) : (
            <div style={{ ...list, marginBottom: 16 }}>
              {blindPresets.map((preset, i) => {
                const lvs: Level[] = Array.isArray(preset.levels) ? preset.levels : []
                const lvCount = lvs.filter(l => l.type === "level").length
                const brkCount = lvs.filter(l => l.type === "break").length
                const mins = lvs.reduce((s, l) => s + (l.duration ?? 0), 0)
                return (
                  <div key={preset.id} style={{ display: 'flex', alignItems: 'center', borderTop: i ? '1px solid var(--sep)' : 'none' }}>
                    <button type="button" onClick={() => openEditBlindPreset(preset)} className="tp-row" style={{ ...listRow, flex: 1 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</span>
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>
                          {lvCount} レベル ・ 休憩 {brkCount} 回 ・ {fmtMinutes(mins)}
                        </span>
                      </span>
                      <ChevronRightIcon size={20} style={{ color: 'var(--label3)' }} />
                    </button>
                    <button type="button" onClick={() => askDeletePreset(preset)} className="tp-press" aria-label={`${preset.name}を削除`} style={{ ...btn.icon, background: 'transparent', color: '#D70015', marginRight: 8 }}>
                      <Trash2Icon size={20} />
                    </button>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <>
            <div style={{ ...list, marginBottom: 16 }}>
              <FormRow label="名前" last>
                <input value={blindPresetName} onChange={e => { setBlindError(""); setBlindPresetName(e.target.value) }} placeholder="例: 通常トーナメント" style={rowInput} />
              </FormRow>
            </div>

            <div style={{ ...list, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 16px' }}>
              <span style={{ fontSize: 15, flex: 1 }}>時間を一括変更</span>
              <input type="number" inputMode="numeric" value={bulkDuration} onChange={e => setBulkDuration(e.target.value)} placeholder="20" aria-label="分"
                className="no-spin tp-input" style={{ ...numInput, width: 64 }} />
              <span style={{ fontSize: 15, color: 'var(--label2)' }}>分</span>
              <button type="button" onClick={() => {
                const d = Math.round(Number(bulkDuration))
                if (!bulkDuration || isNaN(d) || d <= 0) return
                setLevels(ls => ls.map(l => l.type === "level" ? { ...l, duration: d } : l)); setBulkDuration("")
              }} disabled={!bulkDuration} className="tp-press" style={{ ...btn.small, opacity: bulkDuration ? 1 : 0.4 }}>
                適用
              </button>
            </div>

            <BlindLevelEditor levels={blindLevels} onChange={ls => { setBlindError(""); setBlindLevels(ls) }} />
          </>
        )}
      </AppleSheet>

      {/* ── 自動で作る ── */}
      <AppleSheet
        open={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        maxWidth={560}
        zIndex={400}
        title={aiView === "input"
          ? <SheetTitle title="ブラインドを自動で作る" sub="スタックと締切までの時間から、レベルと休憩を決めます" onClose={() => setIsAiOpen(false)} />
          : <SheetTitle title="この構成で作りますか？" sub={`${aiPreviewLevels.filter(l => l.type === "level").length} レベル ・ 休憩 ${aiPreviewLevels.filter(l => l.type === "break").length} 回`} onBack={() => setAiView("input")} onClose={() => setIsAiOpen(false)} />}
        footer={aiView === "input" ? (
          <>
            {aiError && <InlineError>{aiError}</InlineError>}
            <button type="button" onClick={runAi} className="tp-press" style={{ ...btn.primary, width: '100%' }}>
              <ZapIcon size={20} /> 構成を作る
            </button>
          </>
        ) : (
          <button type="button" onClick={() => {
            const name = aiPresetName.trim() || "自動作成のブラインド"
            setBlindPresetName(name); setBlindLevels(aiPreviewLevels); setEditingBlindPresetId(null)
            blindSnapshot.current = ""   // 未保存として扱う
            setBlindError(""); setBlindModalView("edit"); setIsAiOpen(false); setAiView("input")
          }} className="tp-press" style={{ ...btn.primary, width: '100%' }}>
            この構成で編集に進む
          </button>
        )}
      >
        {aiView === "input" ? (
          <>
            <div style={{ ...list, marginBottom: 24 }}>
              <FormRow label="名前">
                <input value={aiPresetName} onChange={e => setAiPresetName(e.target.value)} placeholder="例: 3時間締切" style={rowInput} />
              </FormRow>
              <FormRow label="スタートスタック">
                <input type="number" inputMode="numeric" value={aiStack} onChange={e => { setAiError(""); setAiStack(e.target.value) }} placeholder="30000" className="no-spin" style={rowInput} />
              </FormRow>
              <FormRow label="締切まで" hint="開始からレジスト締切までの時間" last>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  <input type="number" inputMode="decimal" step="0.5" min="0.5" value={aiRcHours} onChange={e => { setAiError(""); setAiRcHours(e.target.value) }} placeholder="3" className="no-spin" style={{ ...rowInput, width: 64 }} />
                  <span style={{ fontSize: 17, color: 'var(--label2)' }}>時間</span>
                </span>
              </FormRow>
            </div>
            <GroupLabel small>使うチップ</GroupLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {AI_CHIP_OPTIONS.map(chip => {
                const on = aiChips.includes(chip)
                return (
                  <button key={chip} type="button" role="checkbox" aria-checked={on} onClick={() => { setAiError(""); setAiChips(prev => on ? prev.filter(c => c !== chip) : [...prev, chip]) }} className="tp-press"
                    style={{ minWidth: 64, minHeight: 44, padding: '0 16px', borderRadius: 999, fontSize: 15, fontWeight: 600, border: 'none',
                      background: on ? 'var(--label)' : 'var(--fill)', color: on ? '#fff' : 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>
                    {chip.toLocaleString()}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 13, color: 'var(--label2)', margin: '0 8px 24px' }}>最後の休憩(10分)が終わる時刻が締切になるよう調整します。</p>
          </>
        ) : (
          <ol style={{ ...list, listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
            {aiPreviewLevels.map((lv, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 44, padding: '8px 16px', borderTop: i ? '1px solid var(--sep)' : 'none', fontVariantNumeric: 'tabular-nums',
                color: lv.type === "break" ? 'var(--blue)' : 'var(--label)', background: lv.type === "break" ? 'rgba(10,108,214,0.06)' : 'transparent' }}>
                {lv.type === "break" ? (
                  <><CoffeeIcon size={20} /><span style={{ flex: 1, fontWeight: 600 }}>{lv.duration === 10 ? "締切前の休憩" : "休憩"}</span><span>{lv.duration}分</span></>
                ) : (
                  <>
                    <span style={{ width: 24, textAlign: 'center', fontWeight: 700, color: 'var(--gold-dk)' }}>{aiPreviewLevels.slice(0, i + 1).filter(l => l.type === "level").length}</span>
                    <span style={{ flex: 1, fontSize: 17 }}>{lv.smallBlind?.toLocaleString()} / {lv.bigBlind?.toLocaleString()}</span>
                    <span style={{ color: 'var(--label2)' }}>{lv.duration}分</span>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </AppleSheet>

      <ConfirmDialog request={confirmState} onClose={() => setConfirmState(null)} />

      <StoreBottomNav />
    </main>
  )
}

// ── 見た目の部品 ───────────────────────────────────────────────────────────


const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
}
const list: React.CSSProperties = { background: '#fff', borderRadius: 16, overflow: 'hidden' }
const listRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 56,
  padding: '8px 16px', background: 'transparent', border: 'none', textAlign: 'left',
  color: 'var(--label)', fontFamily: 'inherit', fontSize: 17, cursor: 'pointer',
  transition: 'background-color 100ms ease-out',
}
const metaItem: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4 }
const rowInput: React.CSSProperties = {
  flex: 1, minWidth: 0, width: '100%', height: 44, background: 'none', border: 'none', outline: 'none',
  fontSize: 17, color: 'var(--label)', textAlign: 'right', fontFamily: 'inherit',
}
const numInput: React.CSSProperties = {
  height: 44, borderRadius: 12, border: 'none', background: 'rgba(118,118,128,0.12)',
  fontSize: 17, fontWeight: 600, color: 'var(--label)', outline: 'none', textAlign: 'center',
  boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit', width: '100%',
}
const rankBadge: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 12, background: 'var(--gold)', color: '#fff',
  fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const btnBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  minHeight: 48, padding: '0 24px', borderRadius: 999, border: 'none',
  fontSize: 17, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const btn = {
  // 金の面の上の文字は白(CLAUDE.md・オーナー確定)。
  primary: { ...btnBase, background: 'var(--gold)', color: '#fff' } as React.CSSProperties,
  secondary: { ...btnBase, background: '#fff', color: 'var(--label)', boxShadow: 'inset 0 0 0 1px var(--sep)' } as React.CSSProperties,
  small: { ...btnBase, minHeight: 44, padding: '0 16px', fontSize: 15, background: 'var(--label)', color: '#fff' } as React.CSSProperties,
  icon: { ...btnBase, width: 48, minHeight: 48, padding: 0, background: 'var(--fill)', color: 'var(--label)', flexShrink: 0 } as React.CSSProperties,
}

function GroupLabel({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <h2 style={{ fontSize: small ? 13 : 20, fontWeight: small ? 600 : 700, color: small ? 'var(--label2)' : 'var(--label)', letterSpacing: small ? 0 : '-0.01em', margin: small ? '0 8px 8px' : '0 0 16px' }}>
      {children}
    </h2>
  )
}

function SheetTitle({ title, sub, onClose, onBack }: { title: string; sub?: string; onClose: () => void; onBack?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {onBack && (
        <button type="button" onClick={onBack} className="tp-press" aria-label="戻る" style={{ ...btn.icon, width: 44, minHeight: 44, marginLeft: -8 }}>
          <ChevronLeftIcon size={24} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', margin: 0, lineHeight: 1.27 }}>{title}</p>
        {sub && <p style={{ fontSize: 13, color: 'var(--label2)', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      <button type="button" onClick={onClose} className="tp-press" aria-label="閉じる" style={{ ...btn.icon, width: 44, minHeight: 44, marginRight: -8 }}>
        <XIcon size={20} />
      </button>
    </div>
  )
}

function FormRow({ label, hint, children, last }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 56, padding: '4px 16px', borderBottom: last ? 'none' : '1px solid var(--sep)' }}>
      <span style={{ flexShrink: 0, maxWidth: '55%' }}>
        <span style={{ display: 'block', fontSize: 17, color: 'var(--label)' }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>{hint}</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>{children}</span>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string, string]> = {
    active: ['開催中', 'rgba(242,169,0,0.16)', '#8A5F00'],
    scheduled: ['予定', 'rgba(118,118,128,0.12)', 'var(--label2)'],
    finished: ['終了', 'rgba(118,118,128,0.12)', 'var(--label2)'],
  }
  const [label, bg, fg] = map[status] ?? [status, 'rgba(118,118,128,0.12)', 'var(--label2)']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 8, background: bg, color: fg, flexShrink: 0 }}>
      {status === 'active' && <span className="tp-live" style={{ width: 8, height: 8, borderRadius: 4, background: '#F2A900' }} />}
      {label}
    </span>
  )
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 8, background: 'rgba(118,118,128,0.12)', color: 'var(--label2)' }}>
      {icon}{children}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'rgba(118,118,128,0.08)', borderRadius: 12, padding: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.27 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--label2)' }}>{label}</div>
    </div>
  )
}

function EmptyCard({ icon, title, body, flat }: { icon: React.ReactNode; title: string; body?: string; flat?: boolean }) {
  return (
    <div style={{ ...(flat ? {} : card), padding: '32px 24px', textAlign: 'center', marginBottom: 32 }}>
      <div style={{ color: 'var(--label3)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{title}</p>
      {body && <p style={{ fontSize: 15, color: 'var(--label2)', margin: '8px 0 0' }}>{body}</p>}
    </div>
  )
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <SearchIcon size={20} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--label2)', pointerEvents: 'none' }} />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        style={{ width: '100%', height: 44, borderRadius: 12, border: 'none', background: 'rgba(118,118,128,0.12)', padding: '0 48px 0 40px', fontSize: 17, color: 'var(--label)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="検索語を消す" className="tp-press"
          style={{ position: 'absolute', right: 0, top: 0, width: 44, height: 44, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)' }}>
          <XIcon size={20} />
        </button>
      )}
    </div>
  )
}

function InlineError({ children }: { children: React.ReactNode }) {
  return <p role="alert" style={{ fontSize: 15, color: '#D70015', margin: '0 8px 8px', fontWeight: 500 }}>{children}</p>
}

function CheckMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--gold-dk)', flexShrink: 0 }}>
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
