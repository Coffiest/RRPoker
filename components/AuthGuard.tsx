'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { watchAuthState } from '@/lib/auth'
import { auth, db } from '@/lib/firebase'
import { isPublicPath } from '@/lib/publicPaths'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let unsubBan: (() => void) | null = null
    const unsub = watchAuthState((user) => {
      unsubBan?.(); unsubBan = null
      // どの画面が Firebase のログインを求めないかは lib/publicPaths.ts に置く。
      // 管理画面のように Firebase Auth を使わない入口があるため、ここに直接
      // 一覧を書くと、その存在を知らないまま締め出してしまう。
      if (!user && !isPublicPath(pathname)) {
        const target = pathname + window.location.search
        router.replace(`/login?redirect=${encodeURIComponent(target)}`)
        return
      }
      // 利用停止(BAN)。Firebase 側でもアカウントを無効にしているが、すでに
      // ログインしている端末は最大1時間ほど使えてしまうので、その場で締め出す。
      if (user) {
        unsubBan = onSnapshot(doc(db, 'users', user.uid), snap => {
          if (snap.data()?.banned === true) {
            void signOut(auth).finally(() => router.replace('/login?banned=1'))
          }
        }, () => {})
      }
    })
    return () => { unsub(); unsubBan?.() }
  }, [pathname, router])

  return <>{children}</>
}
