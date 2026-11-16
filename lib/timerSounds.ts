'use client'

/**
 * 店舗ホーム・プレイヤーホームでタイマーの音を鳴らす(オーナー指定・2026-11-16)。
 *
 * 以前はタイマー画面の埋め込み(iframe)の中で鳴らしていた。埋め込みは押せない作りなので、iPhone では
 * 音の許可(画面を 1 度押すこと)が中に届かず、全画面でも縮小でも鳴らないことがあった。
 * いまは画面そのもの(ホーム)が 1 つの音の装置を持ち、表示しているタイマーの音をまとめて鳴らす。
 * 埋め込みのタイマーは鳴らさない(?embed=1 / ?mute=1 / view=1)ので、二重には鳴らない。
 *
 * 鳴らす音はタイマー画面(TimerClient)と同じ:
 *   - 残り 10 秒: tensec / 残り 3・2・1 秒: countdown
 *   - レベル(ブレイク)が変わった瞬間・スタート・一時停止: levelup
 *   - 画面を開いた直後の状態は「変わった」ではないので鳴らさない
 *
 * 電池: 毎秒起きない。残りが 11 秒を切るまでは眠り、その後だけ 1 秒ごとに起きる(残り秒数が変わる瞬間に合わせる)。
 * 画面が隠れている間は止める。鳴らし終えて 4 秒たったら音の装置を眠らせる(suspend)。
 * iPhone の消音スイッチ(マナーモード)でも鳴るよう、使える端末では navigator.audioSession を playback にする。
 */
import { useEffect, useRef } from 'react'
import { computeLiveLevelState, type TimerLevel } from '@/lib/timerCompute'
import { getServerNow } from '@/lib/serverClock'

export type SoundTimer = {
  id: string
  running: boolean
  currentLevelIndex: number
  levelStartedAtMs: number | null
  levelStartedRemaining: number | null
  timeRemaining: number
  levels: TimerLevel[]
}

type Name = 'levelup' | 'tensec' | 'countdown'
let ctx: AudioContext | null = null
const buffers: Partial<Record<Name, AudioBuffer>> = {}
let loading = false
let idle: ReturnType<typeof setTimeout> | null = null

function sleepSoon() {
  if (idle) clearTimeout(idle)
  idle = setTimeout(() => { if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {}) }, 4000)
}

/** 画面を押した瞬間に音の装置を起こす(iPhone は押した瞬間でないと音を許可しない) */
function unlock() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch { /* 対応していない端末 */ }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  if (!ctx) ctx = new AC()
  void ctx.resume().then(() => {
    const b = ctx!.createBuffer(1, 1, 22050)
    const s = ctx!.createBufferSource(); s.buffer = b; s.connect(ctx!.destination); s.start(0)
    sleepSoon()
  }).catch(() => {})
  if (!loading) {
    loading = true
    ;(['levelup', 'tensec', 'countdown'] as Name[]).forEach(async n => {
      try { buffers[n] = await ctx!.decodeAudioData(await (await fetch(`/${n}.mp3`)).arrayBuffer()) } catch { /* 次の操作でまた読む */ loading = false }
    })
  }
}

async function play(n: Name) {
  if (!ctx) return
  try {
    if (ctx.state !== 'running') await ctx.resume()
    const b = buffers[n]
    if (b) { const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0) }
  } catch { /* 許可が無いときは鳴らない */ }
  sleepSoon()
}

/** 表示しているタイマー(timers)の音を鳴らす。表示していない(たたんでいる)タイマーは渡さない */
export function useTimerSounds(timers: SoundTimer[]) {
  // 押した瞬間に音の装置を起こす。一度起きても、iPhone は着信などで止めることがあるので残しておく
  useEffect(() => {
    const on = () => unlock()
    document.addEventListener('pointerdown', on, true)
    document.addEventListener('touchend', on, true)
    document.addEventListener('keydown', on, true)
    return () => {
      document.removeEventListener('pointerdown', on, true)
      document.removeEventListener('touchend', on, true)
      document.removeEventListener('keydown', on, true)
    }
  }, [])

  const last = useRef<Record<string, { level: number; sec: number; running: boolean }>>({})
  const list = useRef(timers)
  list.current = timers
  // 中身が変わったときだけ見直す(並びや参照が変わっただけでは見直さない)
  const key = timers.map(t => `${t.id}:${t.running ? 1 : 0}:${t.currentLevelIndex}:${t.levelStartedAtMs ?? ''}:${t.levelStartedRemaining ?? ''}:${t.timeRemaining}:${t.levels.length}`).join('|')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const step = () => {
      timer = null
      if (document.hidden) return
      const now = getServerNow()
      let next = Infinity
      const seen = new Set<string>()
      for (const t of list.current) {
        seen.add(t.id)
        const st = computeLiveLevelState(
          t.currentLevelIndex, t.levelStartedAtMs,
          t.running ? (t.levelStartedRemaining ?? t.timeRemaining) : t.timeRemaining,
          t.levels, t.running, now,
        )
        const prev = last.current[t.id]
        if (prev) {
          if (prev.running !== t.running && st.remainingSec > 0) void play('levelup')
          else if (t.running && st.levelIndex > prev.level) void play('levelup')
          else if (t.running && st.remainingSec !== prev.sec) {
            if (st.remainingSec === 10) void play('tensec')
            else if (st.remainingSec >= 1 && st.remainingSec <= 3) void play('countdown')
          }
        }
        last.current[t.id] = { level: st.levelIndex, sec: st.remainingSec, running: t.running }
        if (!t.running || t.levelStartedAtMs === null) continue
        // 残り秒数が 1 つ減る瞬間までの時間
        const edge = 1000 - (((now - t.levelStartedAtMs) % 1000) + 1000) % 1000 + 15
        next = Math.min(next, st.remainingSec > 11 ? edge + (st.remainingSec - 11) * 1000 : edge)
      }
      for (const id of Object.keys(last.current)) if (!seen.has(id)) delete last.current[id]
      if (Number.isFinite(next)) timer = setTimeout(step, Math.max(50, next))
    }
    const onVis = () => { if (!document.hidden && timer === null) step() }
    document.addEventListener('visibilitychange', onVis)
    step()
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [key])
}
