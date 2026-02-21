'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function UserWelcomeStepPage() {
  const router = useRouter()
  const [name, setName] = useState('')

  useEffect(() => {
    const fetchName = async () => {
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, 'users', user.uid))
      const data = snap.data()
      setName(data?.name ?? '')
    }

    fetchName()
  }, [])

  return (
    <main className="min-h-screen bg-white px-5 page-slide-in">
      <div className="mx-auto max-w-sm text-center">
        <div className="pt-[96px]">
          <h1 className="text-[26px] font-semibold text-gray-900">ようこそ、{name}さん</h1>
          <button
            type="button"
            onClick={() => router.replace('/home')}
            className="mt-6 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
          >
            はじめる
          </button>
        </div>
      </div>
    </main>
  )
}
