'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { watchAuthState } from '@/lib/auth'
import { isPublicPath } from '@/lib/publicPaths'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const unsub = watchAuthState((user) => {
      // どの画面が Firebase のログインを求めないかは lib/publicPaths.ts に置く。
      // 管理画面のように Firebase Auth を使わない入口があるため、ここに直接
      // 一覧を書くと、その存在を知らないまま締め出してしまう。
      if (!user && !isPublicPath(pathname)) {
        const target = pathname + window.location.search
        router.replace(`/login?redirect=${encodeURIComponent(target)}`)
      }
    })
    return () => unsub()
  }, [pathname, router])

  return <>{children}</>
}
