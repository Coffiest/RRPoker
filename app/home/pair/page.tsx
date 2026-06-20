'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import HomeHeader from '@/components/HomeHeader'
import PlayerBottomNav from '@/components/PlayerBottomNav'
import { getCommonMenuItems } from '@/components/commonMenuItems'

const COLORS = {
  gold: '#F2A900',
  dark: '#1C1C1E',
  light: '#FAFAFA',
  lightGray: '#F2F2F7',
  border: '#E5E5EA',
  red: '#d32f2f',
}

function PairPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromQuery = searchParams.get('code')
  const [code, setCode] = useState(codeFromQuery ? codeFromQuery.replace(/[^0-9]/g, '').slice(0, 6) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const autoSubmittedRef = useRef(false)

  const handleConfirm = async (codeOverride?: string) => {
    const trimmed = (codeOverride ?? code).trim()
    if (!/^\d{6}$/.test(trimmed)) {
      setError('6桁の数字を入力してください')
      return
    }

    const user = auth.currentUser
    if (!user) { router.replace('/'); return }

    setLoading(true)
    setError('')
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/pairing/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '接続に失敗しました')
        return
      }
      setSuccess(true)
    } catch {
      setError('接続に失敗しました。もう一度お試しください')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setAuthReady(true))
    return unsub
  }, [])

  // QRコード経由（?code=）でアクセスした場合はログイン確認後に自動送信
  useEffect(() => {
    if (!authReady || !codeFromQuery || autoSubmittedRef.current) return
    const trimmed = codeFromQuery.replace(/[^0-9]/g, '').slice(0, 6)
    if (!/^\d{6}$/.test(trimmed)) return
    if (!auth.currentUser) return
    autoSubmittedRef.current = true
    handleConfirm(trimmed)
  }, [authReady, codeFromQuery])

  return (
    <div style={{ minHeight: '100vh', background: COLORS.light, display: 'flex', flexDirection: 'column' }}>
      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        menuItems={getCommonMenuItems(router, 'user')}
      />
      <div style={{ flex: 1, padding: '24px 20px 100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, marginTop: 20 }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textAlign: 'center' }}>
            TVと連携
          </p>
          <p style={{ fontSize: 15, color: COLORS.dark, marginBottom: 24, lineHeight: 1.6 }}>
            Fire TV / Fire Stick 端末の画面に表示されているQRコードを読み込むと自動で連携されます。{'\n'}
            手動で連携する場合は、画面に表示されている6桁のコードを入力してください。
          </p>

          {success ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.dark, marginBottom: 8 }}>
                連携が完了しました
              </p>
              <p style={{ fontSize: 14, color: COLORS.dark }}>
                TV画面が自動的にログインします
              </p>
            </div>
          ) : (
            <>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                style={{
                  width: '100%',
                  fontSize: 32,
                  letterSpacing: 8,
                  textAlign: 'center',
                  fontWeight: 700,
                  padding: '16px 12px',
                  borderRadius: 12,
                  border: `2px solid ${COLORS.border}`,
                  color: COLORS.dark,
                  marginBottom: 20,
                  boxSizing: 'border-box',
                }}
              />

              {error && (
                <p style={{ fontSize: 14, color: COLORS.red, marginBottom: 16, textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button
                onClick={() => handleConfirm()}
                disabled={loading || code.length !== 6}
                style={{
                  width: '100%',
                  background: COLORS.gold,
                  border: 'none',
                  borderRadius: 12,
                  padding: '16px 0',
                  fontSize: 16,
                  fontWeight: 700,
                  color: COLORS.dark,
                  opacity: loading || code.length !== 6 ? 0.6 : 1,
                  cursor: loading || code.length !== 6 ? 'default' : 'pointer',
                }}
              >
                {loading ? '接続中...' : '連携する'}
              </button>
            </>
          )}
        </div>
      </div>
      <PlayerBottomNav />
    </div>
  )
}

export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PairPageInner />
    </Suspense>
  )
}
