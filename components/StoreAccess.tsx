'use client'

// 店舗の権限まわりの画面(lib/storeAccess.ts)。
// - GrantAccessSheet: プレイヤーが「権限を追加」。店舗のアカウントで一度ログインして本人確認する
// - ManageAccessSheet: 店舗オーナーが「権限を管理」。付いている人の一覧・外す・プレイヤーIDで付ける
// - StoreChooserSheet: 権限のある店舗が複数あるとき、どの店舗の画面を開くか選ぶ

import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppleSheet from '@/components/AppleSheet'
import ConfirmDialog, { type ConfirmRequest } from '@/components/ConfirmDialog'
import { addManager, grantByStoreLogin, removeManager, type ManagedStore } from '@/lib/storeAccess'

const input: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 12, border: '1px solid var(--sep)', padding: '0 16px',
  fontSize: 14, color: 'var(--label)', background: '#fff', outline: 'none', fontFamily: 'inherit',
}
const goldBtn: React.CSSProperties = {
  width: '100%', minHeight: 48, borderRadius: 999, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
}
const note: React.CSSProperties = { fontSize: 12, color: 'var(--label3)', lineHeight: 1.6 }

export function GrantAccessSheet({ open, onClose, uid }: { open: boolean; onClose: () => void; uid: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { if (!open) { setPassword(''); setMsg(null) } }, [open])

  const submit = async () => {
    if (!uid || !email || !password) return
    setBusy(true); setMsg(null)
    try {
      const r = await grantByStoreLogin(email, password, uid)
      setMsg({ ok: true, text: `${r.name} の権限を追加しました` })
      setPassword('')
    } catch (e: any) {
      const m = String(e?.message ?? '')
      setMsg({
        ok: false,
        text: m === 'not_store' ? '店舗のアカウントではありません'
          : m === 'not_owner' ? 'この店舗のオーナーのアカウントでログインしてください'
          : m === 'self' ? '自分自身には追加できません'
          : 'ログインできませんでした。メールアドレスとパスワードを確かめてください',
      })
    } finally { setBusy(false) }
  }

  return (
    <AppleSheet open={open} onClose={onClose} zIndex={1300}
      title={<span className="tech-label" style={{ fontSize: 11, color: 'var(--label)', letterSpacing: '0.14em' }}>権限を追加</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
        <p style={note}>店舗のアカウントで一度だけログインすると、その店舗の画面をこのアカウントから使えるようになる。パスワードは保存しない。</p>
        <input style={input} type="email" autoComplete="off" placeholder="店舗のメールアドレス" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={input} type="password" autoComplete="off" placeholder="店舗のパスワード" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="button" className="gl-press" style={{ ...goldBtn, opacity: busy || !email || !password ? 0.6 : 1 }} disabled={busy || !email || !password} onClick={submit}>
          {busy ? '確認中…' : 'ログインして権限を追加'}
        </button>
        {msg && <p style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? '#D4910A' : '#E53E3A', textAlign: 'center' }}>{msg.text}</p>}
      </div>
    </AppleSheet>
  )
}

type Member = { uid: string; name: string; playerId?: string }

export function ManageAccessSheet({ open, onClose, storeId }: { open: boolean; onClose: () => void; storeId: string | null }) {
  const [members, setMembers] = useState<Member[]>([])
  const [pid, setPid] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  useEffect(() => {
    if (!open || !storeId) return
    return onSnapshot(doc(db, 'stores', storeId), async snap => {
      const ids: string[] = Array.isArray(snap.data()?.managerUids) ? snap.data()!.managerUids : []
      const list = await Promise.all(ids.map(async id => {
        const u = (await getDoc(doc(db, 'users', id)).catch(() => null))?.data()
        return { uid: id, name: u?.name ?? '(名前なし)', playerId: u?.playerId }
      }))
      setMembers(list)
    }, () => {})
  }, [open, storeId])
  useEffect(() => { if (!open) { setMsg(null); setPid('') } }, [open])

  const add = async () => {
    if (!storeId || !pid.trim()) return
    setMsg(null)
    const snap = await getDocs(query(collection(db, 'users'), where('playerId', '==', pid.trim()))).catch(() => null)
    const hit = snap?.docs.find(d => d.data().role !== 'store')
    if (!hit) { setMsg({ ok: false, text: 'そのプレイヤーIDは見つかりません' }); return }
    try {
      await addManager(storeId, hit.id)
      setMsg({ ok: true, text: `${hit.data().name ?? 'プレイヤー'} に権限を付けました` }); setPid('')
    } catch { setMsg({ ok: false, text: '権限を付けられませんでした(オーナーのアカウントで操作してください)' }) }
  }

  return (
    <AppleSheet open={open} onClose={onClose} zIndex={1300}
      title={<span className="tech-label" style={{ fontSize: 11, color: 'var(--label)', letterSpacing: '0.14em' }}>権限を管理</span>}>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
        <p style={note}>権限を付けたプレイヤーは、この店舗の画面をオーナーと同じように使える。権限の付け外し・店舗の削除・解約はオーナーだけ。</p>
        {members.length === 0 && <p style={{ ...note, textAlign: 'center', padding: '8px 0' }}>権限を付けた人はいない</p>}
        {members.map(m => (
          <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 52, padding: '0 4px 0 16px', borderRadius: 12, background: 'var(--fill)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
              {m.playerId && <p className="con-mono" style={{ fontSize: 11, color: 'var(--label3)' }}>ID {m.playerId}</p>}
            </div>
            <button type="button" className="gl-press" onClick={() => setConfirm({
              title: '権限を外す', message: `${m.name} の権限を外しますか?`, action: '外す', destructive: true,
              run: async () => { if (storeId) await removeManager(storeId, m.uid) },
            })} style={{ minHeight: 44, padding: '0 16px', border: 'none', background: 'none', color: '#E53E3A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              外す
            </button>
          </div>
        ))}
        <p className="tech-label" style={{ fontSize: 10, color: 'var(--label2)', marginTop: 8 }}>プレイヤーIDで権限を付ける</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...input, flex: 1 }} placeholder="プレイヤーID" value={pid} onChange={e => setPid(e.target.value)} />
          <button type="button" className="gl-press" onClick={add} disabled={!pid.trim()}
            style={{ ...goldBtn, width: 88, opacity: pid.trim() ? 1 : 0.6 }}>付ける</button>
        </div>
        {msg && <p style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? '#D4910A' : '#E53E3A', textAlign: 'center' }}>{msg.text}</p>}
      </div>
    </AppleSheet>
  )
}

export function StoreChooserSheet({ open, onClose, stores, onPick }: { open: boolean; onClose: () => void; stores: ManagedStore[]; onPick: (id: string) => void }) {
  return (
    <AppleSheet open={open} onClose={onClose} zIndex={1300}
      title={<span className="tech-label" style={{ fontSize: 11, color: 'var(--label)', letterSpacing: '0.14em' }}>店舗の画面を開く</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
        {stores.map(s => (
          <button key={s.id} type="button" className="gl-press" onClick={() => onPick(s.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 56, padding: '0 16px', borderRadius: 12, border: '1px solid var(--sep)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--fill)', flexShrink: 0 }}>
              {s.iconUrl && <img src={s.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{s.name}</span>
          </button>
        ))}
      </div>
    </AppleSheet>
  )
}
