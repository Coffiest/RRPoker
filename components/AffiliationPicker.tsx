'use client'

/**
 * 「所属」の入力(オーナー指定・2026-11-03)。
 * 所属しているサークル、よく行く店舗、所属している店舗など。
 *
 * - 入店したことのある店舗を一番上に、その下に近い店舗を候補として出す。選ぶと店舗のアイコン付きになる。
 * - 自由入力もできる(この場合アイコンは出さない)。
 * 値は { affiliation, affiliationStoreId, affiliationIconUrl } の 3 つで users/{uid} に保存する(呼び出し側)。
 */

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { Check, MapPin, Store, Users } from 'lucide-react'
import { db } from '@/lib/firebase'
import { readCachedGeoConsent } from '@/lib/geoConsent'

export type Affiliation = { affiliation: string; affiliationStoreId: string | null; affiliationIconUrl: string | null }

type StoreRow = { id: string; name: string; iconUrl: string | null; lat?: number; lng?: number }

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (v: number) => (v * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function AffiliationPicker({ value, onChange, joinedStoreIds }: {
  value: Affiliation
  onChange: (v: Affiliation) => void
  /** 入店したことのある店舗(users.joinedStores) */
  joinedStoreIds: string[]
}) {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null)
  const [text, setText] = useState(value.affiliationStoreId ? '' : value.affiliation)

  useEffect(() => {
    getDocs(collection(db, 'stores')).then(snap => {
      const list: StoreRow[] = []
      snap.forEach(d => {
        const x = d.data()
        list.push({ id: d.id, name: x.name ?? '店舗', iconUrl: x.iconUrl ?? null, lat: typeof x.lat === 'number' ? x.lat : undefined, lng: typeof x.lng === 'number' ? x.lng : undefined })
      })
      setStores(list)
    }).catch(() => {})
    // 位置情報は、利用に同意済みのときだけ使う(同意の確認は lib/geoConsent.ts)
    if (readCachedGeoConsent() === 'granted' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 5000 })
    }
  }, [])

  const joined = useMemo(() => stores.filter(s => joinedStoreIds.includes(s.id)), [stores, joinedStoreIds])
  const nearby = useMemo(() => {
    const rest = stores.filter(s => !joinedStoreIds.includes(s.id))
    if (!here) return rest.slice(0, 8)
    return rest
      .filter(s => s.lat !== undefined && s.lng !== undefined)
      .sort((a, b) => km(here.lat, here.lng, a.lat!, a.lng!) - km(here.lat, here.lng, b.lat!, b.lng!))
      .slice(0, 8)
  }, [stores, joinedStoreIds, here])

  const pick = (s: StoreRow) => { setText(''); onChange({ affiliation: s.name, affiliationStoreId: s.id, affiliationIconUrl: s.iconUrl }) }

  const row = (s: StoreRow) => {
    const on = value.affiliationStoreId === s.id
    return (
      <button key={s.id} type="button" onClick={() => pick(s)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48, padding: '4px 12px', border: 'none', borderRadius: 12, background: on ? 'rgba(242,169,0,0.12)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {s.iconUrl
            // eslint-disable-next-line @next/next/no-img-element -- 店舗のアイコン(data URL)
            ? <img src={s.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Store size={16} strokeWidth={2} color="#6E6E73" aria-hidden />}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: on ? 700 : 500, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
        {on && <Check size={18} strokeWidth={2} color="#D4910A" aria-hidden />}
      </button>
    )
  }

  const head = (label: string, Icon: typeof Store) => (
    <p className="tech-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--label3)', margin: '12px 4px 4px' }}>
      <Icon size={12} strokeWidth={2} aria-hidden /> {label}
    </p>
  )

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--label2)', margin: '0 0 8px', lineHeight: 1.5 }}>所属しているサークル、もしくはよく行く店舗、所属している店舗など</p>
      <input type="text" value={text} maxLength={40} placeholder="自由に入力(例: 〇〇大学ポーカーサークル)"
        onChange={e => { setText(e.target.value); onChange({ affiliation: e.target.value, affiliationStoreId: null, affiliationIconUrl: null }) }}
        style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', padding: '0 14px', fontSize: 16, color: '#1C1C1E', background: '#F2F2F7', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      {value.affiliationStoreId && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--label2)', margin: '8px 4px 0' }}>
          <Users size={12} strokeWidth={2} aria-hidden /> 選択中: <strong style={{ color: 'var(--label)' }}>{value.affiliation}</strong>
          <button type="button" onClick={() => onChange({ affiliation: '', affiliationStoreId: null, affiliationIconUrl: null })}
            style={{ marginLeft: 'auto', minHeight: 32, padding: '0 8px', border: 'none', background: 'none', color: '#C62828', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>外す</button>
        </p>
      )}
      <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
        {joined.length > 0 && <>{head('入店したことのある店舗', Store)}{joined.map(row)}</>}
        {nearby.length > 0 && <>{head(here ? '近くの店舗' : 'ほかの店舗', MapPin)}{nearby.map(row)}</>}
      </div>
    </div>
  )
}
