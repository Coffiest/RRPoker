"use client"

import { useEffect, useState } from "react"
import { App } from "@capacitor/app"
import { StatusBar, Style } from "@capacitor/status-bar"
import { Network } from "@capacitor/network"
import { auth } from "@/lib/firebase"
import { isNativeApp } from "@/lib/platform"
import { configureIAP } from "@/lib/iap"
import { registerPushNotifications } from "@/lib/pushNotifications"
import { hapticError } from "@/lib/haptics"

// No-ops entirely on web — wires up native chrome (iOS and Android both) and ties
// RevenueCat's subscriber identity to the existing Firebase UID.
export default function CapacitorBoot() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) return

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})

    // iPhone の「文字サイズ」設定に合わせて文字を大きくする(Dynamic Type)。
    // -apple-system-body は設定に応じた本文の大きさ(標準 17px)を返すので、その比で全体の文字を拡大する。
    // カードなど高さが決まった部品が崩れないよう、上限は 130% にとどめる。
    const applyTextSize = () => {
      const probe = document.createElement("span")
      probe.style.font = "-apple-system-body"
      document.body.appendChild(probe)
      const px = parseFloat(getComputedStyle(probe).fontSize)
      probe.remove()
      if (!px) return
      const pct = Math.round(Math.min(1.3, Math.max(1, px / 17)) * 100)
      document.documentElement.style.setProperty("-webkit-text-size-adjust", `${pct}%`)
    }
    applyTextSize()
    const appState = App.addListener("appStateChange", s => { if (s.isActive) applyTextSize() })

    const backListener = App.addListener("backButton", () => {
      if (window.history.length > 1) window.history.back()
      else App.exitApp()
    })

    const unsub = auth.onAuthStateChanged(user => {
      if (user) {
        configureIAP(user.uid).catch(() => {})
        registerPushNotifications(user.uid).catch(() => {})
      }
    })

    Network.getStatus().then(s => setOffline(!s.connected)).catch(() => {})
    const networkListener = Network.addListener("networkStatusChange", status => {
      if (!status.connected) hapticError()
      setOffline(!status.connected)
    })

    return () => {
      backListener.then(l => l.remove())
      appState.then(l => l.remove())
      networkListener.then(l => l.remove())
      unsub()
    }
  }, [])

  if (!offline) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#1C1C1E",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        textAlign: "center",
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 8,
        paddingTop: "calc(env(safe-area-inset-top) + 8px)",
      }}
    >
      インターネットに接続されていません
    </div>
  )
}
