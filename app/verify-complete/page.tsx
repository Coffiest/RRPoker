"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { applyActionCode } from "firebase/auth"
import { auth } from "@/lib/firebase"

export default function VerifyCompletePage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oobCode = params.get("oobCode")

    if (!oobCode) return

    applyActionCode(auth, oobCode)
      .then(() => {
        router.replace("/login?verified=1")
      })
      .catch(() => {
        router.replace("/login?verified=0")
      })
  }, [])

  return (
    <div className="flex items-center justify-center h-screen">
      <p>認証中...</p>
    </div>
  )
}