'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import PcSidebar from '@/components/PcSidebar'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }
      const snap = await getDoc(doc(db, 'users', user.uid))
      const data = snap.data()
      if (data?.role === 'player' && !data?.profileCompleted) {
        router.replace('/onboarding/user/profile')
        return
      }
      setReady(true)
    })
    return () => unsub()
  }, [router])

  if (!ready) return null
  // 地を敷く。真っ白のままではガラスの面が透ける先を持てず、素材に見えない。
  // タイマー画面は自前で全面に背景を敷いているので、ここの影響を受けない。
  // PC では左にサイドバーを出す(表示は html.pc のときだけ。globals.css)。
  // タイマー画面は全画面で使うので出さない。店舗の画面かどうかはパスで決める。
  const isTimer = pathname.startsWith('/home/store/timer')
  if (isTimer) return <div className="a-app-bg">{children}</div>
  const variant = pathname.startsWith('/home/store') ? 'store' : 'player'
  return (
    <div className="a-app-bg pc-shell">
      <PcSidebar variant={variant} />
      {children}
    </div>
  )
}
