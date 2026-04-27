'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, getDocs, getDoc, doc, setDoc } from 'firebase/firestore'

// Generate playerId from user's name
const generatePlayerIdFromName = (name: string, index: number = 0): string => {
  const baseName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15)
  
  if (!baseName) {
    // Fallback to random if name has no valid characters
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = ''
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `@user${id}`
  }
  
  return index > 0 ? `@${baseName}${index}` : `@${baseName}`
}

export default function MigrationPage() {
  const router = useRouter()
  const [status, setStatus] = useState('認証確認中...')
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    const runMigration = async () => {
      try {
        setStatus('ユーザーデータを取得中...')
        const usersRef = collection(db, 'users')
        const snapshot = await getDocs(usersRef)
        const usersWithoutId = snapshot.docs.filter(d => !d.data().playerId)
        if (usersWithoutId.length === 0) {
          setStatus('すべてのユーザーがプレイヤーIDを持っています')
          setTimeout(() => router.push('/home'), 2000)
          return
        }
        setProgress({ current: 0, total: usersWithoutId.length })
        setStatus(`${usersWithoutId.length}人のユーザーにIDを付与中...`)
        const usedIds = new Set<string>()
        snapshot.docs.forEach(d => { const pid = d.data().playerId; if (pid) usedIds.add(pid) })
        for (let i = 0; i < usersWithoutId.length; i++) {
          const userDoc = usersWithoutId[i]
          const userData = userDoc.data()
          const userName = userData.name || 'user'
          let playerId = generatePlayerIdFromName(userName)
          let counter = 1
          while (usedIds.has(playerId)) { playerId = generatePlayerIdFromName(userName, counter); counter++ }
          usedIds.add(playerId)
          await setDoc(doc(db, 'users', userDoc.id), { playerId }, { merge: true })
          setProgress({ current: i + 1, total: usersWithoutId.length })
        }
        setStatus('マイグレーション完了！')
        setTimeout(() => router.push('/home'), 2000)
      } catch (error) {
        console.error('Migration error:', error)
        setStatus(`エラー: ${error}`)
      }
    }

    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) { router.replace('/home'); return }
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (userSnap.data()?.role !== 'store') { router.replace('/home'); return }
      runMigration()
    })
    return () => unsub()
  }, [router])

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-5">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F2A900] mx-auto"></div>
        <h1 className="mt-6 text-[18px] font-semibold text-gray-900">{status}</h1>
        {progress.total > 0 && (
          <p className="mt-2 text-[14px] text-gray-600">
            {progress.current} / {progress.total}
          </p>
        )}
      </div>
    </main>
  )
}
