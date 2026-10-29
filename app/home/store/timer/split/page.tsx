"use client"

// タイマーの分割表示(2 / 3 / 4 分割)。
// 店のモニターが 1 台でも、別々のトーナメントのタイマーを同時に映せるようにする。
// 各区画は単独のタイマー画面(/home/store/timer/[id])をそのまま埋め込む。
// タイマーは表示するだけ。ここでは止めたり動かしたりしない(操作は店舗ホームのボタンだけ)。
//
// 使い方: /home/store/timer/split?ids=<id1>,<id2>[,<id3>[,<id4>]]
// 閉じ方: 画面をタップすると上に操作バーが出る(5 秒で消える)。キーボードなら Esc。

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { XIcon } from "lucide-react"

function layoutFor(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 }
  if (n === 2) return { cols: 2, rows: 1 }
  if (n === 3) return { cols: 3, rows: 1 }
  return { cols: 2, rows: 2 }
}

function SplitTimers() {
  const router = useRouter()
  const params = useSearchParams()
  const ids = (params.get("ids") ?? "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 4)
  const [ctrl, setCtrl] = useState(true)
  const [touch, setTouch] = useState(0)

  const close = () => {
    if (window.opener) window.close()
    else if (window.history.length > 1) router.back()
    else router.replace("/home/store")
  }

  useEffect(() => {
    if (!ctrl) return
    const t = window.setTimeout(() => setCtrl(false), 5000)
    return () => window.clearTimeout(t)
  }, [ctrl, touch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { cols, rows } = layoutFor(ids.length)

  return (
    <main style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 2, width: "100%", height: "100%" }}>
        {ids.map(id => (
          <iframe key={id} src={`/home/store/timer/${id}`} title={`timer-${id}`} allow="autoplay"
            style={{ width: "100%", height: "100%", border: "none", display: "block", pointerEvents: "none", background: "#fff" }} />
        ))}
      </div>

      {/* 埋め込みは押せない(誤操作防止)ので、全体を覆う透明なボタンで操作バーを出す */}
      <button type="button" aria-label="操作を表示" onClick={() => { setCtrl(true); setTouch(n => n + 1) }}
        style={{ position: "absolute", inset: 0, background: "transparent", border: "none", cursor: "default" }} />

      {ctrl && (
        <div onPointerDown={() => setTouch(n => n + 1)}
          style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 16px)", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 16, padding: "8px 8px 8px 24px", borderRadius: 999, background: "rgba(28,28,30,0.82)", backdropFilter: "blur(20px)", color: "#fff" }}>
          <span className="tech-label" style={{ fontSize: 13, letterSpacing: "0.14em" }}>SPLIT VIEW · {ids.length}</span>
          <button type="button" onClick={close} className="gl-press"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 16px", borderRadius: 999, border: "none", background: "#fff", color: "#1C1C1E", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <XIcon size={18} /> 閉じる
          </button>
        </div>
      )}
    </main>
  )
}

export default function Page() {
  return <Suspense fallback={null}><SplitTimers /></Suspense>
}
