'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function OnboardingPage() {
  const router = useRouter()
  const [checkingRole, setCheckingRole] = useState(true)

  useEffect(() => {
    const resolveExistingRole = async () => {
      const user = auth.currentUser
      if (!user) {
        setCheckingRole(false)
        return
      }

      const userRef = doc(db, 'users', user.uid)
      const snap = await getDoc(userRef)
      const data = snap.data()
      const role = data?.role === 'user' ? 'player' : data?.role

      if (!role) {
        setCheckingRole(false)
        return
      }

      if (role === 'player') {
        // Check if playerId exists, if not send to profile page to set it
        if (!data?.playerId) {
          router.replace('/onboarding/user/profile')
          return
        }
        if (!data?.name || !data?.iconUrl) {
          router.replace('/onboarding/user/profile')
          return
        }
        router.replace('/home')
        return
      }

      if (role === 'store') {
        if (!data?.name || !data?.storeId || !data?.postalCode || !data?.addressLine || !data?.addressDetail) {
          router.replace('/onboarding/store')
          return
        }
        router.replace('/home/store')
        return
      }

      setCheckingRole(false)
    }

    resolveExistingRole()
  }, [router])

  const selectRole = async (role: 'player' | 'store') => {
    const user = auth.currentUser
    if (!user) return

    const userRef = doc(db, 'users', user.uid)
    const snap = await getDoc(userRef)
    const data = snap.data()
    const existingRole = data?.role === 'user' ? 'player' : data?.role
    const nextRole = existingRole ?? role

    if (!existingRole) {
      await setDoc(
        userRef,
        { role },
        { merge: true }
      )
    }

    if (nextRole === 'player') {
      router.replace('/onboarding/user/profile')
      return
    }

    router.replace('/onboarding/store')
  }

  if (checkingRole) {
    return null
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[28px] font-semibold leading-tight text-gray-900">
            はじめまして！
          </h1>
          <p className="mt-2 text-[14px] text-gray-500">まずは、あなたのことを教えてください</p>
          <p className="mt-1 text-[14px] text-gray-500">あなたはどちらですか？</p>
        </div>

        <div className="mt-7 rounded-[24px] border border-gray-200 p-4">
          <button
            type="button"
            onClick={() => selectRole('player')}
            className="mt-2 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
          >
            プレイヤー
          </button>
          <button
            type="button"
            onClick={() => selectRole('store')}
            className="mt-3 h-[52px] w-full rounded-[24px] border border-gray-200 text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
          >
            店舗
          </button>
        </div>
      </div>
    </main>
  )
}