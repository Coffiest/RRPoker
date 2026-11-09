'use client'

/**
 * 名前の入力(オーナー指定・2026-11-09)。
 * 名前の無いプレイヤー(以前に名前なしでホームまで進めてしまった人)は、ホームに入る前にここで名前を入れる。
 * 入れるまでホームへは進めない(app/home/layout.tsx)。
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import Loader from '@/components/Loader'

export default function NamePage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => auth.onAuthStateChanged(async u => {
    if (!u) { router.replace('/login'); return }
    setUid(u.uid)
    try {
      const d = (await getDoc(doc(db, 'users', u.uid))).data()
      if ((d?.name ?? '').trim()) router.replace('/home')
    } catch {}
  }), [router])

  const save = async () => {
    const v = name.trim()
    if (!v) { setError('名前を入力してください'); return }
    if (!uid) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', uid), { name: v })
      router.replace('/home')
    } catch {
      setError('保存できませんでした')
      setSaving(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="section-card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <p className="tech-label term-prompt" style={{ fontSize: 11, color: 'var(--label2)', marginBottom: 8 }}>PROFILE</p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--label)', margin: '0 0 8px' }}>名前を入力してください</h1>
        <p style={{ fontSize: 13, color: 'var(--label2)', margin: '0 0 16px', lineHeight: 1.6 }}>店舗やほかのプレイヤーに表示される名前です。入力するとホームに進めます。</p>
        <input value={name} onChange={e => { setName(e.target.value); setError('') }} maxLength={30} placeholder="ポーカーネーム" autoFocus
          onKeyDown={e => { if (e.key === 'Enter') void save() }}
          style={{ width: '100%', height: 48, padding: '0 16px', fontSize: 16, color: 'var(--label)', boxSizing: 'border-box' }} />
        {error && <p style={{ fontSize: 12, color: '#C62828', margin: '8px 4px 0' }}>{error}</p>}
        <button type="button" onClick={() => void save()} disabled={saving || !name.trim()}
          style={{ width: '100%', height: 48, marginTop: 16, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving || !name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {saving ? <Loader size={24} light /> : 'ホームへ進む'}
        </button>
      </div>
    </main>
  )
}
