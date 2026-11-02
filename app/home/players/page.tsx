import { Suspense } from "react"
import PlayersClient from "./PlayersClient"

export default function PlayersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <PlayersClient />
    </Suspense>
  )
}
