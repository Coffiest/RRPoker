'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { watchAuthState } from '@/lib/auth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const unsub = watchAuthState((user) => {
      // 公開ページのリスト
      const publicPaths = [
        '/login',
        '/register',
        '/store-register',
        '/forgot-password',
        '/verify-code',
        '/password-reset-verify',
        '/verify-email',
        '/'
      ]
      
      if (!user && !publicPaths.includes(pathname)) {
        router.replace('/login')
      }
    })
    return () => unsub()
  }, [pathname, router])

  return <>{children}</>
}
