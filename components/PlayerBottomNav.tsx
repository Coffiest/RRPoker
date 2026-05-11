'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { FiHome, FiUser, FiCreditCard } from 'react-icons/fi'
import { MdQrCode2 } from 'react-icons/md'
import PlayerQRModal from '@/app/components/PlayerQRModal'

type ActiveTab = 'home' | 'action' | 'mypage'

// Indicator left position: centered on each grid column (3-col, px-7 = 28px each side)
// col_i center from element left = 28 + (width - 56) * (2i+1) / 6
// ≈ width*(2i+1)/6 - ... simplified to accurate calc() expressions
const IND_LEFT: Record<ActiveTab, string> = {
  home:   'calc(100% / 6 - 3px)',
  action: 'calc(50% - 22px)',
  mypage: 'calc(5 * 100% / 6 - 41px)',
}

const GLASS: React.CSSProperties = {
  borderRadius: 9999,
  background: 'rgba(255,255,255,0.14)',
  backdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  WebkitBackdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.20)',
}

function getActiveTab(pathname: string): ActiveTab {
  if (pathname.startsWith('/home/mypage') || pathname.startsWith('/home/history')) return 'mypage'
  if (
    pathname.startsWith('/home/transactions') ||
    pathname.startsWith('/home/tickets') ||
    pathname.startsWith('/home/withdraw')
  ) return 'action'
  return 'home'
}

export default function PlayerBottomNav() {
  const router   = useRouter()
  const pathname = usePathname()
  const activeTab = getActiveTab(pathname)

  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null)
  const [userId,    setUserId]    = useState<string | null>(null)
  const [userName,  setUserName]  = useState('')
  const [userIcon,  setUserIcon]  = useState<string | undefined>(undefined)
  const [isQROpen,  setIsQROpen]  = useState(false)

  // Indicator state
  const [indLeft,      setIndLeft]      = useState(IND_LEFT[activeTab])
  const [indVisible,   setIndVisible]   = useState(activeTab !== 'action')
  const [transition,   setTransition]   = useState(false)

  // On mount: read previous tab from sessionStorage → animate from there to current
  useEffect(() => {
    const stored = sessionStorage.getItem('rrpoker.nav.player') as ActiveTab | null
    const prev = stored ?? activeTab

    setTransition(false)
    setIndLeft(IND_LEFT[prev])
    setIndVisible(prev !== 'action')

    // Double-RAF: ensure first paint committed before transition starts
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTransition(true)
      setIndLeft(IND_LEFT[activeTab])
      setIndVisible(activeTab !== 'action')
    }))

    sessionStorage.setItem('rrpoker.nav.player', activeTab)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auth + user data subscription
  useEffect(() => {
    let unsubSnap: (() => void) | null = null
    const unsubAuth = auth.onAuthStateChanged(user => {
      unsubSnap?.()
      if (!user) { setUserId(null); setCurrentStoreId(null); return }
      setUserId(user.uid)
      unsubSnap = onSnapshot(doc(db, 'users', user.uid), snap => {
        const d = snap.data()
        setCurrentStoreId(d?.currentStoreId ?? null)
        setUserName(d?.name ?? '')
        setUserIcon(d?.iconUrl)
      }, () => {})
    })
    return () => { unsubAuth(); unsubSnap?.() }
  }, [])

  const handleCenter = () => {
    if (currentStoreId) router.push('/home/transactions')
    else setIsQROpen(true)
  }

  const col = (tab: ActiveTab) => ({
    color: activeTab === tab ? '#F2A900' : '#3C3C43',
    fontWeight: activeTab === tab ? 700 : 400,
  })

  return (
    <>
      <nav className="fixed bottom-5 left-4 right-4 z-[80]">
        <div
          className="mx-auto max-w-sm relative grid grid-cols-3 items-center"
          style={{ ...GLASS, padding: '12px 28px' }}
        >
          {/* Sliding indicator */}
          <div style={{
            position: 'absolute',
            left: indLeft,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(242,169,0,0.14)',
            opacity: indVisible ? 1 : 0,
            transition: transition
              ? 'left 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease'
              : 'opacity 0.25s ease',
            pointerEvents: 'none',
          }} />

          {/* Home */}
          <button
            type="button"
            onClick={() => router.push('/home')}
            className="flex flex-col items-center gap-1"
            style={{ ...col('home'), background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <FiHome size={22} />
            <span style={{ fontSize: 10, fontWeight: col('home').fontWeight }}>ホーム</span>
          </button>

          {/* Center */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCenter}
              data-tutorial="nav-qr"
              className="flex items-center justify-center active:scale-95 transition-all"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#F2A900,#D4910A)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeTab === 'action'
                  ? '0 4px 20px rgba(242,169,0,0.70), 0 0 0 4px rgba(242,169,0,0.18)'
                  : '0 4px 16px rgba(242,169,0,0.45)',
                transition: 'box-shadow 0.35s ease',
              }}
            >
              {currentStoreId
                ? <FiCreditCard size={22} style={{ color: '#fff' }} />
                : <MdQrCode2    size={24} style={{ color: '#fff' }} />}
            </button>
          </div>

          {/* Mypage */}
          <button
            type="button"
            onClick={() => router.push('/home/mypage')}
            className="flex flex-col items-center gap-1"
            style={{ ...col('mypage'), background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <FiUser size={22} />
            <span style={{ fontSize: 10, fontWeight: col('mypage').fontWeight }}>マイページ</span>
          </button>
        </div>
      </nav>

      {isQROpen && userId && createPortal(
        <PlayerQRModal uid={userId} name={userName} iconUrl={userIcon} onClose={() => setIsQROpen(false)} />,
        document.body
      )}
    </>
  )
}
