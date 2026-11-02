import { Suspense } from "react"
import TimerClient from "./TimerClient"

export default function Page() {
  return <Suspense fallback={null}><TimerClient /></Suspense>
}
