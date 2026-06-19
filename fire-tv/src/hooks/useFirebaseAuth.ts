import { useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  AuthError,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ログイン状態の監視
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // ログイン
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (e: any) {
      const errorMessage = getAuthErrorMessage(e)
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  // ログアウト
  const logout = async (): Promise<void> => {
    setLoading(true)
    try {
      await signOut(auth)
      setError(null)
    } catch (e: any) {
      setError('ログアウトに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    loading,
    error,
    login,
    logout,
    isLoggedIn: user !== null,
  }
}

// Firebase Auth エラーメッセージ翻訳
function getAuthErrorMessage(error: AuthError): string {
  const code = error.code
  const messages: Record<string, string> = {
    'auth/invalid-email': 'メールアドレスが無効です',
    'auth/user-disabled': 'このアカウントは無効化されています',
    'auth/user-not-found': 'ユーザーが見つかりません',
    'auth/wrong-password': 'パスワードが間違っています',
    'auth/too-many-requests': 'ログイン試行回数が多すぎます。後でお試しください。',
    'auth/network-request-failed': 'ネットワークエラー。接続を確認してください。',
  }
  return messages[code] || 'ログインに失敗しました'
}
