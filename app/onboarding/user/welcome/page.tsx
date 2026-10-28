'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function UserWelcomePage() {
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
    <main className="min-h-screen bg-[#EDECE6] px-6">
      <div className="mx-auto max-w-sm text-center">
        <div className="pt-[96px]">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] text-[color:var(--label)]">{name ? `はじめまして、${name}さん` : 'はじめまして'}</h1>
          <p className="mt-2 text-[17px] text-label2">準備が整いました</p>
          <button
            type="button"
            onClick={() => router.replace('/home')}
            className="mt-6 h-[52px] w-full rounded-[24px] bg-[#F9B318] text-[17px] font-semibold text-white shadow-sm transition-transform active:scale-[0.97]"
          >
            はじめる
          </button>
        </div>
      </div>
    </main>
  )
}
