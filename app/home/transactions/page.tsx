import { Suspense } from "react"
import TransactionsClient from "./TransactionsClient"

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <TransactionsClient />
    </Suspense>
  )
}
