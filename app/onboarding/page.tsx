'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function OnboardingPage() {
  const router = useRouter()
  const [checkingRole, setCheckingRole] = useState(true)
  const [selecting, setSelecting] = useState<'player' | 'store' | null>(null)

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
      setCheckingRole(false)
    }
    resolveExistingRole()
  }, [router])

  const selectRole = async (role: 'player' | 'store') => {
    const user = auth.currentUser
    if (!user) return
    setSelecting(role)

    const userRef = doc(db, 'users', user.uid)
    await setDoc(userRef, { role }, { merge: true })

    const snap = await getDoc(userRef)
    const data = snap.data()
    const existingRole = data?.role === 'user' ? 'player' : data?.role
    const nextRole = existingRole ?? role

    if (nextRole === 'player') {
      router.replace('/onboarding/user/profile')
      return
    }
    router.replace('/onboarding/store')
  }

  if (checkingRole) return null

  return (
    <main
      style={{ background: '#FFFBF5' }}
      className="min-h-screen flex flex-col items-center justify-center px-5"
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .animate-slideUp-d1 {
          opacity: 0;
          animation: slideUp 0.4s ease-out 0.05s forwards;
        }
        .animate-slideUp-d2 {
          opacity: 0;
          animation: slideUp 0.4s ease-out 0.15s forwards;
        }
        .animate-slideUp-d3 {
          opacity: 0;
          animation: slideUp 0.4s ease-out 0.25s forwards;
        }
        .animate-slideUp-d4 {
          opacity: 0;
          animation: slideUp 0.4s ease-out 0.35s forwards;
        }
        .onboarding-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow:
            0 2px 8px rgba(242, 169, 0, 0.06),
            0 8px 24px rgba(0, 0, 0, 0.04);
        }
        .role-btn-primary {
          background: linear-gradient(135deg, #F2A900 0%, #D4910A 100%);
          box-shadow: 0 4px 16px rgba(242, 169, 0, 0.28), 0 1px 3px rgba(0,0,0,0.08);
          transition: transform 0.13s ease, box-shadow 0.13s ease, opacity 0.13s ease;
        }
        .role-btn-primary:hover {
          box-shadow: 0 6px 22px rgba(242, 169, 0, 0.38);
        }
        .role-btn-primary:active {
          transform: scale(0.977);
          opacity: 0.88;
        }
        .role-btn-secondary {
          background: #ffffff;
          border: 1.5px solid #e5e7eb;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          transition: transform 0.13s ease, border-color 0.13s ease, box-shadow 0.13s ease;
        }
        .role-btn-secondary:hover {
          border-color: #F2A900;
          box-shadow: 0 2px 10px rgba(242,169,0,0.12);
        }
        .role-btn-secondary:active {
          transform: scale(0.977);
        }
        .role-btn-loading {
          opacity: 0.65;
          pointer-events: none;
        }
        .icon-badge {
          background: linear-gradient(135deg, #F2A900 0%, #D4910A 100%);
          box-shadow: 0 4px 14px rgba(242, 169, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .divider-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(242,169,0,0.18), transparent);
        }
      `}</style>

      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center animate-slideUp-d1">
          {/* Icon badge — same style as rr-rate-card / gradient elements in /home */}
          <div
            className="icon-badge mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px]"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 className="text-[26px] font-semibold leading-tight text-gray-900 tracking-[-0.3px]">
            はじめまして！
          </h1>
          <p className="mt-2 text-[14px] text-gray-500 leading-relaxed">
            まずは、あなたのことを教えてください
          </p>
        </div>

        {/* Divider */}
        <div className="divider-line my-6 animate-slideUp-d2" />

        {/* Card */}
        <div className="onboarding-card rounded-3xl p-5 animate-slideUp-d2">

          <p className="mb-1 text-center text-[12px] font-semibold uppercase tracking-[0.55px] text-gray-400">
            あなたはどちらですか？
          </p>

          <div className="mt-4 space-y-3 animate-slideUp-d3">

            {/* Player button */}
            <button
              type="button"
              onClick={() => selectRole('player')}
              disabled={selecting !== null}
              className={`role-btn-primary flex h-[54px] w-full items-center justify-between rounded-2xl px-5 ${selecting === 'player' ? 'role-btn-loading' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[20px]">🃏</span>
                <span className="text-[16px] font-semibold text-gray-900">プレイヤー</span>
              </div>
              {selecting === 'player' ? (
                <svg className="h-5 w-5 animate-spin text-gray-900/60" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
                </svg>
              )}
            </button>

            {/* Store button */}
            <button
              type="button"
              onClick={() => selectRole('store')}
              disabled={selecting !== null}
              className={`role-btn-secondary flex h-[54px] w-full items-center justify-between rounded-2xl px-5 ${selecting === 'store' ? 'role-btn-loading' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[20px]">🏪</span>
                <span className="text-[16px] font-semibold text-gray-700">店舗</span>
              </div>
              {selecting === 'store' ? (
                <svg className="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

          </div>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-[12px] text-gray-400 animate-slideUp-d4">
          選択後の変更はできません
        </p>

      </div>
    </main>
  )
}