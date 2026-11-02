import { Suspense } from "react"
import WithdrawConfirmClient from "./WithdrawConfirmClient"

export default function WithdrawConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen " />}>
      <WithdrawConfirmClient />
    </Suspense>
  )
}
