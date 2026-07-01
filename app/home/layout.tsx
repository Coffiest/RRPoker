'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

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
  return <>{children}</>
}
