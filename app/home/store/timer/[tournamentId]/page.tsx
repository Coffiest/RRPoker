"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"

export default function TournamentTimerPage() {
  const { tournamentId } = useParams() as { tournamentId: string }
  const [level, setLevel] = useState(1)
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(900) // 15分固定
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data?.type) return
      if (event.data.type === "START") setRunning(true)
      if (event.data.type === "STOP") setRunning(false)
      if (event.data.type === "NEXT") setLevel((prev) => prev + 1)
      if (event.data.type === "PREV") setLevel((prev) => Math.max(1, prev - 1))
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setLevel((l) => l + 1)
          return 900
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60

  return (
    <div style={{ background: "black", color: "white", height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <h1>Level {level}</h1>
      <h2 style={{ fontSize: 80 }}>
        {minutes}:{remainSeconds.toString().padStart(2, "0")}
      </h2>
    </div>
  )
}
