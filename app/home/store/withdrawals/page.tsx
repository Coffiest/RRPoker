import WithdrawalsClient from "./WithdrawalsClient"
import { Suspense } from "react"

export default function WithdrawalsPage({ params }: { params: { storeId: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}> 
      <WithdrawalsClient storeId={params.storeId} />
    </Suspense>
  )
}
