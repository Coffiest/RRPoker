import { useCallback, useEffect, useRef, useState } from 'react'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://rrpoker.vercel.app'
const POLL_INTERVAL_MS = 3000

type PairingStatus = 'idle' | 'waiting' | 'confirmed' | 'expired' | 'error'

export function usePairing() {
  const [code, setCode] = useState<string | null>(null)
  const [status, setStatus] = useState<PairingStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPairing = useCallback(async () => {
    stopPolling()
    setError(null)
    setStatus('waiting')

    try {
      const res = await fetch(`${API_BASE_URL}/api/pairing/create`, { method: 'POST' })
      if (!res.ok) throw new Error('failed to create pairing code')
      const data = await res.json()
      setCode(data.code)

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE_URL}/api/pairing/status?code=${data.code}`)

          if (statusRes.status === 404 || statusRes.status === 410) {
            stopPolling()
            setStatus('expired')
            return
          }

          const statusData = await statusRes.json()
          if (statusData.status === 'confirmed' && statusData.customToken) {
            stopPolling()
            await signInWithCustomToken(auth, statusData.customToken)
            setStatus('confirmed')
          }
        } catch {
          // 一時的なネットワークエラーはポーリング継続
        }
      }, POLL_INTERVAL_MS)
    } catch {
      setStatus('error')
      setError('ペアリングコードの取得に失敗しました')
    }
  }, [stopPolling])

  useEffect(() => stopPolling, [stopPolling])

  return { code, status, error, startPairing, stopPolling }
}
