'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import TechBackdrop from '@/components/TechBackdrop'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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
  // 店舗側ホームと同じ下地(方眼 + 金のにじみ)を、/home 以下の全画面に1か所で敷く。
  // 各画面は背景を塗らず透かす。タイマー画面は自前で全面に背景を敷くので、その上に重なる。
  return (
    <>
      <TechBackdrop base="#EDECE6" />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100dvh' }}>{children}</div>
    </>
  )
}
