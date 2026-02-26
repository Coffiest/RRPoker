"use client"
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PlayerHomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/home")
  }, [router])

  return null
}
