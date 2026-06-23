"use client"

import { useEffect } from "react"
import { App } from "@capacitor/app"
import { StatusBar, Style } from "@capacitor/status-bar"
import { auth } from "@/lib/firebase"
import { isNativeIOS } from "@/lib/platform"
import { configureIAP } from "@/lib/iap"

// No-ops entirely on web/Android — only wires up native iOS chrome and ties
// RevenueCat's subscriber identity to the existing Firebase UID.
export default function CapacitorBoot() {
  useEffect(() => {
    if (!isNativeIOS()) return

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})

    const backListener = App.addListener("backButton", () => {
      if (window.history.length > 1) window.history.back()
      else App.exitApp()
    })

    const unsub = auth.onAuthStateChanged(user => {
      if (user) configureIAP(user.uid).catch(() => {})
    })

    return () => {
      backListener.then(l => l.remove())
      unsub()
    }
  }, [])

  return null
}
