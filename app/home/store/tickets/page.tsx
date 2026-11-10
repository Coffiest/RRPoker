'use client'

/**
 * 店舗のチケット(オーナー指定・2026-11-10)。ヘッダーのチケットのボタンから開く。仕組みは lib/tickets.ts。
 * - チケットを作る(名前・詳細・有効期限・使える店舗)→ 一覧に残り、何人にでも付与できる。編集はこれから付与する分だけ。
 * - 付与: 名前・ID で検索、来たことのある人の一覧、QR。複数人を選び、枚数を決めてまとめて付与。入店したことの無い人にも付与できる。
 * - 付与の履歴: 誰に・いつ・何枚。使用済みにする・未使用の取り消し。
 * - 作る・付与するのはオーナーと権限のある人。
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, query, where,
} from 'firebase/firestore'
import { FiEdit2, FiTrash2, FiX } from 'react-icons/fi'
import { QrCode, Search, Ticket } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import HomeHeader from '@/components/HomeHeader'
import StoreBottomNav from '@/components/StoreBottomNav'
import { getCommonMenuItems } from '@/components/commonMenuItems'
import BackButton, { RingButton } from '@/components/BackButton'
import AddButton from '@/components/AddButton'
import AppleSheet from '@/components/AppleSheet'
import ConfirmDialog, { type ConfirmRequest } from '@/components/ConfirmDialog'
import Loader from '@/components/Loader'
import PlayerAvatar from '@/components/PlayerAvatar'
import StepButton from '@/components/StepButton'
import { CheckMark } from '@/components/RrCheckbox'
import { showToast } from '@/lib/toast'
import { expiryLabel, validateTicket, type ExpiryMode } from '@/lib/ticketExpiry'
import {
  createTemplate, deleteTemplate, grantTicket, loadGrantTickets, markTicketUsed, revokeTickets, updateTemplate,
  type GrantedTicket, type TemplateInput, type TicketGrant, type TicketTemplate,
} from '@/lib/tickets'

const QRScanner = dynamic(() => import('@/app/components/QRScanner'), { ssr: false })

type GroupStore = { id: string; name: string }
type PickPlayer = { uid: string; name: string; playerId?: string; iconUrl?: string | null }

const EMPTY: TemplateInput = { name: '', description: '', expiryMode: 'relative', expiryValue: 30, expiryUnit: 'day', expiryDate: null, usableStoreIds: [] }
const fmtDate = (t?: { toDate?: () => Date } | null) => {
  const d = t?.toDate?.()
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function StoreTicketsPage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [denied, setDenied] = useState(false)
  const [group, setGroup] = useState<GroupStore[]>([])
  const [templates, setTemplates] = useState<TicketTemplate[] | null>(null)
  const [grants, setGrants] = useState<TicketGrant[] | null>(null)
  const [tab, setTab] = useState<'tickets' | 'history'>('tickets')
  const [editing, setEditing] = useState<{ id: string | null; data: TemplateInput } | null>(null)
  const [editErr, setEditErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [granting, setGranting] = useState<TicketTemplate | null>(null)
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)

  // 店舗と権限(オーナーか managerUids)。系列店 = 同じオーナーの店舗
  useEffect(() => auth.onAuthStateChanged(async user => {
    if (!user) { router.replace('/login'); return }
    setUid(user.uid)
    const u = (await getDoc(doc(db, 'users', user.uid))).data()
    const sid = typeof u?.storeId === 'string' ? u.storeId : null
    if (!sid) { setDenied(true); return }
    const s = (await getDoc(doc(db, 'stores', sid))).data()
    const ok = !!s && (s.ownerUid === user.uid || (Array.isArray(s.managerUids) && s.managerUids.includes(user.uid)))
    if (!ok) { setDenied(true); return }
    setStoreId(sid)
    setStoreName(s?.name ?? '店舗')
    const gs = s?.ownerUid ? await getDocs(query(collection(db, 'stores'), where('ownerUid', '==', s.ownerUid))).catch(() => null) : null
    const list = (gs?.docs ?? []).map(d => ({ id: d.id, name: (d.data().name as string) || '店舗' }))
    setGroup(list.some(g => g.id === sid) ? list : [{ id: sid, name: s?.name ?? '店舗' }, ...list])
  }), [router])

  useEffect(() => {
    if (!storeId) return
    const u1 = onSnapshot(collection(db, 'stores', storeId, 'ticketTemplates'), snap => {
      const l = snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketTemplate))
      l.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setTemplates(l)
    }, () => setTemplates([]))
    const u2 = onSnapshot(collection(db, 'stores', storeId, 'ticketGrants'), snap => {
      const l = snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketGrant))
      l.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setGrants(l)
    }, () => setGrants([]))
    return () => { u1(); u2() }
  }, [storeId])

  const nameOf = useMemo(() => new Map(group.map(g => [g.id, g.name])), [group])

  const save = async () => {
    if (!storeId || !editing) return
    const err = validateTicket(editing.data, editing.data.usableStoreIds.length)
    if (err) { setEditErr(err); return }
    setSaving(true)
    try {
      if (editing.id) await updateTemplate(storeId, editing.id, editing.data)
      else await createTemplate(storeId, editing.data)
      showToast(editing.id ? 'チケットを保存しました' : 'チケットを作りました', 'ok')
      setEditing(null)
    } catch { setEditErr('保存できませんでした(権限を確認してください)') }
    finally { setSaving(false) }
  }

  if (denied) {
    return (
      <main className="min-h-screen" style={{ padding: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--label)' }}>この画面は店舗のオーナーと権限のある人だけが開けます。</p>
        <button type="button" className="rr-btn is-gold" style={{ marginTop: 16 }} onClick={() => router.push('/home')}>ホームへ</button>
      </main>
    )
  }

  const ed = editing?.data
  const setEd = (p: Partial<TemplateInput>) => setEditing(e => e && ({ ...e, data: { ...e.data, ...p } }))

  return (
    <main className="min-h-screen pb-28" style={{ background: 'transparent' }}>
      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" menuItems={getCommonMenuItems(router, 'store')} />

      <div className="pc-wide mx-auto max-w-sm px-6">
        <div className="flex justify-center mt-6"><BackButton href="/home/store" /></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <div>
            <p className="tech-label" style={{ fontSize: 10, color: 'var(--label2)', letterSpacing: '0.14em' }}>TICKETS</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--label)', margin: '4px 0 0' }}>チケット</h1>
          </div>
          {tab === 'tickets' && <AddButton label="チケットを作る" onClick={() => { setEditErr(''); setEditing({ id: null, data: { ...EMPTY, usableStoreIds: storeId ? [storeId] : [] } }) }} />}
        </div>

        <div className="rr-seg" style={{ marginTop: 16 }}>
          <button type="button" aria-pressed={tab === 'tickets'} onClick={() => setTab('tickets')}>チケット {templates ? templates.length : ''}</button>
          <button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>付与の履歴</button>
        </div>

        {tab === 'tickets' ? (
          templates === null ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader /></div>
          : templates.length === 0 ? (
            <div className="rr-dots" style={{ marginTop: 16, padding: '32px 24px', textAlign: 'center' }}>
              <Ticket size={32} strokeWidth={2} color="#6E6E73" aria-hidden style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', margin: 0 }}>チケットはまだありません</p>
              <p style={{ fontSize: 13, color: 'var(--label2)', margin: '8px 0 0' }}>右上の + で作ると、ここから何人にでも付与できます。</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              {templates.map(t => (
                <div key={t.id} className="section-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="tech-label" style={{ fontSize: 9, color: '#D4910A', letterSpacing: '0.12em', margin: 0 }}>TICKET</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', margin: '4px 0 0', wordBreak: 'break-word' }}>{t.name}</p>
                      {t.description && <p style={{ fontSize: 12, color: 'var(--label2)', margin: '4px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.description}</p>}
                      <p className="tech-num" style={{ fontSize: 11, color: 'var(--label2)', margin: '8px 0 0' }}>期限: {expiryLabel(t)}</p>
                      <p style={{ fontSize: 11, color: 'var(--label2)', margin: '4px 0 0' }}>使える店: {t.usableStoreIds.map(id => nameOf.get(id) ?? '(削除された店舗)').join(' / ')}</p>
                    </div>
                    <RingButton label={`${t.name}を編集`} icon={<FiEdit2 />} onClick={() => { setEditErr(''); setEditing({ id: t.id, data: { name: t.name, description: t.description ?? '', expiryMode: t.expiryMode, expiryValue: t.expiryValue ?? 30, expiryUnit: t.expiryUnit ?? 'day', expiryDate: t.expiryDate ?? null, usableStoreIds: t.usableStoreIds ?? [] } }) }} />
                    <RingButton label={`${t.name}を削除`} icon={<FiTrash2 />} onClick={() => setConfirmReq({
                      title: 'チケットを削除しますか?', message: `「${t.name}」を一覧から消します。すでに付与した分はプレイヤーの手元に残ります。`, action: '削除', destructive: true,
                      run: async () => { if (storeId) { try { await deleteTemplate(storeId, t.id); showToast('削除しました', 'ok') } catch { showToast('削除できませんでした', 'error') } } },
                    })} />
                  </div>
                  <button type="button" className="rr-btn is-solid is-block" style={{ marginTop: 16 }} onClick={() => setGranting(t)}>付与する</button>
                </div>
              ))}
            </div>
          )
        ) : (
          <GrantHistory storeId={storeId} grants={grants} onConfirm={setConfirmReq} />
        )}
      </div>

      {/* 作る・編集 */}
      <AppleSheet open={!!editing} onClose={() => setEditing(null)} maxWidth={480} maxHeightVh={94}
        title={<span style={{ fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>{editing?.id ? 'チケットを編集' : 'チケットを作る'}</span>}>
        {ed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
            {editing?.id && <p style={{ fontSize: 12, color: 'var(--label2)', margin: 0 }}>変えた内容は、これから付与する分だけに使われます(付与済みのチケットはそのまま)。</p>}
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label2)' }}>名前</span>
              <input value={ed.name} onChange={e => setEd({ name: e.target.value })} maxLength={40} placeholder="例: 参加費無料"
                style={{ display: 'block', width: '100%', height: 44, padding: '0 16px', marginTop: 8, fontSize: 14 }} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label2)' }}>詳細({ed.description.length}/200)</span>
              <textarea value={ed.description} onChange={e => setEd({ description: e.target.value.slice(0, 200) })} rows={3} placeholder="例: 土日のデイリートーナメントで 1 回使えます"
                style={{ display: 'block', width: '100%', padding: '8px 16px', marginTop: 8, fontSize: 14, resize: 'none' }} />
            </label>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label2)' }}>有効期限</span>
              <div className="rr-seg" style={{ marginTop: 8 }}>
                {([['relative', '付与から'], ['date', '日付で'], ['none', '無期限']] as [ExpiryMode, string][]).map(([m, l]) => (
                  <button key={m} type="button" aria-pressed={ed.expiryMode === m} onClick={() => setEd({ expiryMode: m })}>{l}</button>
                ))}
              </div>
              {ed.expiryMode === 'relative' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input type="number" inputMode="numeric" min={1} value={ed.expiryValue ?? ''} onChange={e => setEd({ expiryValue: e.target.value === '' ? null : Number(e.target.value) })}
                    style={{ width: 96, height: 44, padding: '0 16px', fontSize: 14 }} />
                  <div className="rr-seg" style={{ flex: 1 }}>
                    <button type="button" aria-pressed={ed.expiryUnit !== 'month'} onClick={() => setEd({ expiryUnit: 'day' })}>日</button>
                    <button type="button" aria-pressed={ed.expiryUnit === 'month'} onClick={() => setEd({ expiryUnit: 'month' })}>ヶ月</button>
                  </div>
                </div>
              )}
              {ed.expiryMode === 'date' && (
                <input type="date" value={ed.expiryDate ?? ''} onChange={e => setEd({ expiryDate: e.target.value || null })}
                  style={{ display: 'block', width: '100%', height: 44, padding: '0 16px', marginTop: 8, fontSize: 14 }} />
              )}
              <p className="tech-num" style={{ fontSize: 11, color: 'var(--label2)', margin: '8px 0 0' }}>{expiryLabel(ed)}</p>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label2)' }}>使える店舗</span>
              <div className="ios-card" style={{ marginTop: 8, overflow: 'hidden' }}>
                {group.map((g, i) => {
                  const on = ed.usableStoreIds.includes(g.id)
                  return (
                    <button key={g.id} type="button" role="checkbox" aria-checked={on} className="rr-row"
                      onClick={() => setEd({ usableStoreIds: on ? ed.usableStoreIds.filter(x => x !== g.id) : [...ed.usableStoreIds, g.id] })}
                      style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 48, padding: '0 16px', border: 'none', borderTop: i ? '1px solid var(--sep)' : 'none', background: 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--label)' }}>{g.name}{g.id === storeId ? '(この店)' : ''}</span>
                      <CheckMark on={on} />
                    </button>
                  )
                })}
              </div>
            </div>
            {editErr && <p style={{ fontSize: 13, color: '#C62828', margin: 0 }}>{editErr}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="rr-btn is-mute" style={{ flex: 1 }} onClick={() => setEditing(null)}>キャンセル</button>
              <button type="button" className="rr-btn is-solid" style={{ flex: 2 }} disabled={saving} onClick={() => void save()}>
                {saving ? <Loader size={20} light /> : editing?.id ? '保存する' : '作る'}
              </button>
            </div>
          </div>
        )}
      </AppleSheet>

      {granting && storeId && uid && (
        <GrantSheet template={granting} storeId={storeId} storeName={storeName} groupIds={group.map(g => g.id)}
          usableStoreNames={granting.usableStoreIds.map(id => nameOf.get(id) ?? '店舗')} grantedBy={uid}
          onClose={() => setGranting(null)} onDone={() => { setGranting(null); setTab('history') }} />
      )}

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} zIndex={3000} />
      <StoreBottomNav />
    </main>
  )
}

/** 付与: プレイヤーを選び(検索・来たことのある人・QR)、枚数を決めてまとめて付与 */
function GrantSheet({ template, storeId, storeName, groupIds, usableStoreNames, grantedBy, onClose, onDone }: {
  template: TicketTemplate; storeId: string; storeName: string; groupIds: string[]; usableStoreNames: string[]; grantedBy: string
  onClose: () => void; onDone: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PickPlayer[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [visited, setVisited] = useState<PickPlayer[] | null>(null)
  const [picked, setPicked] = useState<PickPlayer[]>([])
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)

  const toPick = (id: string, d: Record<string, unknown> | undefined): PickPlayer => ({
    uid: id, name: (d?.name as string) || '', playerId: typeof d?.playerId === 'string' ? (d.playerId as string).replace(/^@+/, '') : undefined, iconUrl: (d?.iconUrl as string) ?? null,
  })

  // 来たことのある人(系列店のどこか)。名前順
  useEffect(() => {
    let alive = true
    ;(async () => {
      const seen = new Map<string, PickPlayer>()
      for (const sid of groupIds.slice(0, 10)) {
        const s = await getDocs(query(collection(db, 'users'), where('joinedStores', 'array-contains', sid), limit(300))).catch(() => null)
        s?.docs.forEach(d => { if (d.data().role !== 'store') seen.set(d.id, toPick(d.id, d.data())) })
      }
      if (alive) setVisited([...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja')))
    })()
    return () => { alive = false }
  }, [groupIds])

  // 名前(前から一致)と ID(完全一致)で検索。入店したことの無い人も出る
  const search = async () => {
    const t = q.trim().replace(/^@+/, '')
    if (!t) { setResults(null); return }
    setSearching(true)
    try {
      const [byName, byId, byIdAt] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('name', '>=', t), where('name', '<=', t + ''), limit(20))).catch(() => null),
        getDocs(query(collection(db, 'users'), where('playerId', '==', t), limit(5))).catch(() => null),
        getDocs(query(collection(db, 'users'), where('playerId', '==', '@' + t), limit(5))).catch(() => null),
      ])
      const m = new Map<string, PickPlayer>()
      ;[byId, byIdAt, byName].forEach(s => s?.docs.forEach(d => { if (d.data().role !== 'store') m.set(d.id, toPick(d.id, d.data())) }))
      setResults([...m.values()])
    } finally { setSearching(false) }
  }

  const toggle = (p: PickPlayer) => setPicked(l => l.some(x => x.uid === p.uid) ? l.filter(x => x.uid !== p.uid) : [...l, p])
  const onScan = async (scanned: string) => {
    setScan(false)
    const s = await getDoc(doc(db, 'users', scanned)).catch(() => null)
    if (!s?.exists() || s.data()?.role === 'store') { showToast('プレイヤーが見つかりませんでした', 'error'); return }
    const p = toPick(s.id, s.data())
    setPicked(l => l.some(x => x.uid === p.uid) ? l : [...l, p])
    showToast(`${p.name || 'プレイヤー'} を選びました`, 'ok')
  }

  const run = async () => {
    if (picked.length === 0) return
    setBusy(true)
    let ok = 0
    for (const p of picked) {
      try { await grantTicket({ storeId, storeName, template, usableStoreNames, player: p, count, grantedBy }); ok++ } catch { /* 下で数を出す */ }
    }
    setBusy(false)
    if (ok === picked.length) { showToast(`${ok} 人に付与しました`, 'ok'); onDone() }
    else showToast(`${ok} / ${picked.length} 人に付与しました(残りは失敗)`, 'error')
  }

  const Row = ({ p }: { p: PickPlayer }) => {
    const on = picked.some(x => x.uid === p.uid)
    return (
      <button type="button" role="checkbox" aria-checked={on} className="rr-row" onClick={() => toggle(p)}
        style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 52, padding: '4px 16px', border: 'none', borderRadius: 12, background: on ? 'rgba(242,169,0,0.08)' : 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <PlayerAvatar src={p.iconUrl} size={32} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '名前未設定'}</span>
          {p.playerId && <span className="tech-num" style={{ fontSize: 11, color: 'var(--label2)' }}>@{p.playerId}</span>}
        </span>
        <CheckMark on={on} />
      </button>
    )
  }

  return (
    <>
      <AppleSheet open onClose={onClose} maxWidth={520} maxHeightVh={94} zIndex={200}
        title={<span style={{ fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>「{template.name}」を付与</span>}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>1 人</span>
            <StepButton kind="minus" onClick={() => setCount(c => Math.max(1, c - 1))} disabled={count <= 1} label="枚数を減らす" />
            <span className="tech-num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', minWidth: 24, textAlign: 'center' }}>{count}</span>
            <StepButton kind="plus" onClick={() => setCount(c => Math.min(99, c + 1))} label="枚数を増やす" />
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>枚</span>
            <button type="button" className="rr-btn is-solid" style={{ flex: 1 }} disabled={busy || picked.length === 0} onClick={() => void run()}>
              {busy ? <Loader size={20} light /> : `${picked.length} 人に付与`}
            </button>
          </div>
        }>
        <div style={{ paddingBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} strokeWidth={2} color="#545458" aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }} />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void search() }}
                placeholder="名前(前から)・ID で検索" aria-label="名前・ID で検索"
                style={{ width: '100%', height: 44, paddingLeft: 40, paddingRight: 16, fontSize: 14 }} />
            </div>
            <button type="button" className="rr-btn is-gold is-sm" onClick={() => void search()}>検索</button>
            <RingButton label="QR を読む" icon={<QrCode />} onClick={() => setScan(true)} />
          </div>

          {picked.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {picked.map(p => (
                <button key={p.uid} type="button" className="rr-pill" onClick={() => toggle(p)} aria-label={`${p.name}を外す`}
                  style={{ minHeight: 36, padding: '0 16px', letterSpacing: 0, textTransform: 'none', fontSize: 12 }}>
                  <PlayerAvatar src={p.iconUrl} size={20} />{p.name || '名前未設定'}<FiX size={12} aria-hidden />
                </button>
              ))}
            </div>
          )}

          {searching ? <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Loader size={32} /></div>
            : results && (
              <div style={{ marginTop: 16 }}>
                <p className="tech-label" style={{ fontSize: 10, color: 'var(--label2)', letterSpacing: '0.12em', margin: '0 0 4px' }}>SEARCH RESULT</p>
                {results.length === 0 ? <p style={{ fontSize: 13, color: 'var(--label2)', margin: '8px 0' }}>見つかりませんでした</p>
                  : results.map(p => <Row key={p.uid} p={p} />)}
              </div>
            )}

          <p className="tech-label" style={{ fontSize: 10, color: 'var(--label2)', letterSpacing: '0.12em', margin: '16px 0 4px' }}>来たことのある人</p>
          {visited === null ? <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Loader size={32} /></div>
            : visited.length === 0 ? <p style={{ fontSize: 13, color: 'var(--label2)', margin: '8px 0' }}>まだいません。上の検索か QR で選べます。</p>
            : visited.map(p => <Row key={p.uid} p={p} />)}
        </div>
      </AppleSheet>
      {scan && <QRScanner onScan={onScan} onClose={() => setScan(false)} />}
    </>
  )
}

/** 付与の履歴。押すと 1 枚ずつの状態が開き、使用済みにする・未使用を取り消す */
function GrantHistory({ storeId, grants, onConfirm }: { storeId: string | null; grants: TicketGrant[] | null; onConfirm: (r: ConfirmRequest) => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Record<string, GrantedTicket[]>>({})
  const reload = async (g: TicketGrant) => { const t = await loadGrantTickets(g); setTickets(m => ({ ...m, [g.id]: t })) }
  useEffect(() => {
    if (!openId || !grants) return
    const g = grants.find(x => x.id === openId)
    if (g) void reload(g)
  }, [openId, grants])

  if (grants === null) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader /></div>
  if (grants.length === 0) return (
    <div className="rr-dots" style={{ marginTop: 16, padding: '32px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', margin: 0 }}>まだ付与していません</p>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      {grants.map(g => {
        const open = openId === g.id
        const list = tickets[g.id]
        const revoked = new Set(g.revokedIds ?? [])
        return (
          <div key={g.id} className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
            <button type="button" className="rr-row" aria-expanded={open} onClick={() => setOpenId(open ? null : g.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 56, padding: '8px 16px', border: 'none', background: 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <PlayerAvatar src={g.playerIconUrl} size={32} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.playerName || '名前未設定'}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--label2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name} × {g.count}{revoked.size ? `(取り消し ${revoked.size})` : ''}</span>
                <span className="tech-num" style={{ fontSize: 10, color: 'var(--label2)' }}>{fmtDate(g.createdAt)}</span>
              </span>
            </button>
            {open && (
              <div style={{ borderTop: '1px solid var(--sep)', padding: '8px 16px 16px' }}>
                {!list ? <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}><Loader size={28} /></div> : list.map((t, i) => {
                  const state = revoked.has(t.id) || !t.exists ? 'revoked' : t.isUsed ? 'used' : 'unused'
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, borderTop: i ? '1px solid var(--sep)' : 'none' }}>
                      <span className="tech-num" style={{ fontSize: 12, color: 'var(--label2)', width: 28 }}>#{i + 1}</span>
                      <span className="tech-label" style={{ flex: 1, fontSize: 10, letterSpacing: '0.1em', color: state === 'used' ? '#1E7B34' : state === 'revoked' ? 'var(--label2)' : '#D4910A' }}>
                        {state === 'used' ? `USED ${fmtDate(t.usedAt)}` : state === 'revoked' ? 'REVOKED' : 'UNUSED'}
                      </span>
                      {state === 'unused' && (
                        <>
                          <button type="button" className="rr-btn is-green is-sm" onClick={() => onConfirm({
                            title: '使用済みにしますか?', message: `${g.playerName || 'プレイヤー'} の「${g.name}」を使用済みにします。`, action: '使用済みにする',
                            run: async () => { try { await markTicketUsed(g.uid, t.id); await reload(g); showToast('使用済みにしました', 'ok') } catch { showToast('変更できませんでした', 'error') } },
                          })}>使用</button>
                          <button type="button" className="rr-btn is-danger is-sm" onClick={() => onConfirm({
                            title: '取り消しますか?', message: `${g.playerName || 'プレイヤー'} の手元から「${g.name}」を 1 枚回収します。`, action: '取り消す', destructive: true,
                            run: async () => { if (!storeId) return; try { await revokeTickets(storeId, g, [t.id]); showToast('取り消しました', 'ok') } catch { showToast('取り消せませんでした', 'error') } },
                          })}>取消</button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
