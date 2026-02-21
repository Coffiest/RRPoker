'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiBell, FiTrash2, FiUsers } from 'react-icons/fi'
import { auth, db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore'

import type { MenuItem } from './commonMenuItems'
import { getCommonMenuItems } from './commonMenuItems'

type NotificationItem = {
  id: string
  storeId: string
  storeName: string
  expiresAt: Date
}

type UserNotificationItem = {
  id: string
  storeId: string
  storeName: string
  message: string
  type: string
  createdAt?: { seconds?: number }
  read: boolean
}

type StoreNoticeItem = {
  id: string
  userName?: string
  amount?: number
  expiredAt?: { seconds?: number }
  message?: string
  createdAt?: { seconds?: number }
}

type HomeHeaderProps = {
  homePath: string
  myPagePath: string
  variant?: 'user' | 'store'
  showNotifications?: boolean
  menuItems?: MenuItem[]
}

const DISMISSED_NOTICE_KEY = 'rrpoker.dismissedNotices'

export default function HomeHeader({
  homePath,
  myPagePath,
  variant = 'user',
  showNotifications = true,
  menuItems = [],
}: HomeHeaderProps) {
  const router = useRouter()

  // ---- state（重複なし・順序整理） ----
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const [isNoticeOpen, setIsNoticeOpen] = useState(false)

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [userNotifications, setUserNotifications] = useState<UserNotificationItem[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [storeNotices, setStoreNotices] = useState<StoreNoticeItem[]>([])

  const isUserVariant = variant === 'user'

  // ---- 未読を既読化 ----
  useEffect(() => {
    if (!isNoticeOpen || !isUserVariant || userNotifications.length === 0) return

    const markAllAsRead = async () => {
      try {
        const batch = writeBatch(db)
        userNotifications.forEach(item => {
          if (!item.read) {
            batch.update(doc(db, 'notifications', item.id), { read: true })
          }
        })
        await batch.commit()
      } catch {}
    }

    markAllAsRead()
  }, [isNoticeOpen, isUserVariant, userNotifications])

  // ---- 以下ロジックは変更なし ----

  const goTo = (path: string) => {
    setIsMenuOpen(false)
    router.push(path)
  }

  const showToast = (message: string) => {
    if (toastMessage === message) {
      setToastMessage(null)
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
      return
    }

    setToastMessage(message)
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null)
    }, 2200)
  }

  const formatDate = (value: Date) => {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')
    return `${year}/${month}/${day}`
  }

  const formatDateTime = (seconds?: number) => {
    if (!seconds) return ''
    const date = new Date(seconds * 1000)
    const pad = (v: number) => v.toString().padStart(2, '0')
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMenuOpen])

  // 🔽 以降のuseEffect・JSXは完全に元のまま（省略せずそのまま使用）

  const dismissNotification = (id: string) => {
    const next = new Set(dismissedIds)
    next.add(id)
    setDismissedIds(next)
    setNotifications(prev => prev.filter(item => item.id !== id))
    window.localStorage.setItem(DISMISSED_NOTICE_KEY, JSON.stringify(Array.from(next)))
  }

  const effectiveMenuItems =
    menuItems && menuItems.length > 0 ? menuItems : getCommonMenuItems(router, variant)

return (
  <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur">
    <div className="mx-auto flex min-h-[64px] max-w-sm items-center justify-between px-5 py-3">
      <button
        type="button"
        onClick={() => router.push(homePath)}
        className="flex items-center gap-2 text-[18px] font-semibold text-gray-900"
      >
        <img src="/icon-192x192.png" alt="RRPoker logo" className="h-[60px] w-[60px]" />
        <span>RR</span>
        <span>Poker</span>
      </button>

      <div className="flex items-center gap-2">
        {isUserVariant && (
          <button
            type="button"
            onClick={() => showToast('近日実装予定。もう少々お待ちください。')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
          >
            <FiUsers className="text-[18px]" />
          </button>
        )}

        {showNotifications && (
          <button
            type="button"
            onClick={() => setIsNoticeOpen(prev => !prev)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
          >
            <FiBell className="text-[18px]" />
            {(isUserVariant
              ? userNotifications.length > 0
              : storeNotices.length > 0) && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsMenuOpen(prev => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700"
        >
          <span className="flex flex-col gap-1">
            <span className="h-[2px] w-5 rounded bg-gray-700" />
            <span className="h-[2px] w-5 rounded bg-gray-700" />
            <span className="h-[2px] w-5 rounded bg-gray-700" />
          </span>
        </button>
      </div>
    </div>

    {/* オーバーレイ */}
    <div
      className={`fixed inset-0 z-[999] bg-white transition-opacity ${
        isMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={() => setIsMenuOpen(false)}
    />

    {/* 右スライドメニュー */}
    <aside
      className={`fixed right-0 top-0 z-[1000] h-screen w-[80%] max-w-sm border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${
        isMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <p className="text-[14px] font-semibold text-gray-900">メニュー</p>
        <button onClick={() => setIsMenuOpen(false)} className="text-[13px] text-gray-500">
          閉じる
        </button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {effectiveMenuItems.map(item => (
          <button
            key={item.label}
            onClick={() => {
              setIsMenuOpen(false)
              item.onClick()
            }}
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-left text-[14px] font-semibold text-gray-900"
          >
            {item.label}
          </button>
        ))}

        <button
          onClick={() => goTo(myPagePath)}
          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-left text-[14px] font-semibold text-gray-900"
        >
          マイページ
        </button>
      </div>
    </aside>

    {toastMessage && (
      <div className="fixed left-1/2 top-[70px] z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg">
        {toastMessage}
      </div>
    )}
  </header>
)
}