import { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore'
import { User } from 'firebase/auth'
import { db } from '@/lib/firebase'

export interface Tournament {
  id: string
  name: string
  timerRunning: boolean
  timeRemaining: number
  currentLevelIndex: number
  customBlindLevels: any[]
}

export function useTournamentList(user: User | null, storeId: string | null) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !storeId) {
      setTournaments([])
      setLoading(false)
      return
    }

    try {
      // store 配下の tournaments を監視
      // status フィルター：進行中（active）のみ選択可能にする
      const constraints: QueryConstraint[] = [where('status', '==', 'active')]

      const q = query(
        collection(db, 'stores', storeId, 'tournaments'),
        ...constraints
      )

      const unsub = onSnapshot(
        q,
        (snap) => {
          const data = snap.docs
            .map((doc) => ({
              id: doc.id,
              name: doc.data().name ?? '',
              timerRunning: doc.data().timerRunning ?? false,
              timeRemaining: doc.data().timeRemaining ?? 0,
              currentLevelIndex: doc.data().currentLevelIndex ?? 0,
              customBlindLevels: doc.data().customBlindLevels ?? [],
            }))
            .sort((a, b) => a.name.localeCompare(b.name))

          setTournaments(data)
          setLoading(false)
          setError(null)
        },
        (err) => {
          setError('トナメリストの取得に失敗しました')
          setLoading(false)
        }
      )

      return () => unsub()
    } catch (err: any) {
      setError('エラーが発生しました')
      setLoading(false)
    }
  }, [user, storeId])

  return { tournaments, loading, error }
}
