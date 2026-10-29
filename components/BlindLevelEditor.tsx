'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownIcon, ArrowUpIcon, CoffeeIcon, EllipsisIcon, MessageSquareIcon, PlusIcon, Trash2Icon } from 'lucide-react'

/**
 * ブラインド表の編集。トーナメント作成・店舗ホームの調整・タイマー画面で同じものを使う
 * (以前は 3 か所に別々の実装があり、どれも指では並べ替えられなかった)。
 *
 * 並べ替えは HTML のドラッグ(タッチ端末では動かない)ではなく、行の「…」から
 * 上へ/下へ移動する。誤操作で順番が崩れないよう、1 行ずつ確実に動かす。
 */

export type BlindLevel = { type: 'level'; smallBlind: number | null; bigBlind: number | null; ante: number | null; duration: number | null; comment?: string | null }
export type BreakLevel = { type: 'break'; duration: number | null; comment?: string | null }
export type Level = BlindLevel | BreakLevel

export const emptyLevel = (): BlindLevel => ({ type: 'level', smallBlind: null, bigBlind: null, ante: null, duration: null })

/** 直前のレベルを 1.5 倍にした次のレベルを足す。 */
export function withNextLevel(ls: Level[]): Level[] {
  const last = [...ls].reverse().find(l => l.type === 'level') as BlindLevel | undefined
  if (!last) return [...ls, { type: 'level', smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 }]
  const sb = Math.max(1, Math.round((last.smallBlind ?? 100) * 1.5))
  const bb = Math.max(1, Math.round((last.bigBlind ?? 200) * 1.5))
  return [...ls, { type: 'level', smallBlind: sb, bigBlind: bb, ante: bb, duration: last.duration ?? 20 }]
}
export const withBreak = (ls: Level[]): Level[] => [...ls, { type: 'break', duration: 10 }]

/** 保存してよい表か。だめなら理由を返す。 */
export function validateLevels(ls: Level[]): string | null {
  if (!ls.some(l => l.type === 'level')) return 'レベルを1つ以上追加してください'
  const bad = ls.findIndex(l => !l.duration || (l.type === 'level' && (!l.smallBlind || !l.bigBlind)))
  if (bad >= 0) return `${bad + 1}行目: SB・BB・時間を入力してください`
  return null
}

export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60), r = m % 60
  return h ? (r ? `${h}時間${r}分` : `${h}時間`) : `${r}分`
}

const GRID = '32px repeat(4, minmax(0, 1fr)) 44px'

const numInput: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 4px', borderRadius: 12, border: 'none',
  background: 'rgba(118,118,128,0.12)', fontSize: 14, fontWeight: 600, color: 'var(--label)',
  outline: 'none', textAlign: 'center', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit',
}
const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 48,
  padding: '0 16px', background: 'transparent', border: 'none', borderTop: '1px solid rgba(60,60,67,0.12)',
  fontSize: 14, color: 'var(--label)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
}

export default function BlindLevelEditor({ levels, onChange, showAddButtons = false }: {
  levels: Level[]
  onChange: (next: Level[]) => void
  /** 表の下に「+ レベル」「+ 休憩」を出す(呼び出し側が固定の場所に置くなら false)。 */
  showAddButtons?: boolean
}) {
  const [menuIdx, setMenuIdx] = useState<number | null>(null)
  const [commentIdx, setCommentIdx] = useState<number | null>(null)

  const levelNo = (idx: number) => levels.slice(0, idx + 1).filter(l => l.type === 'level').length
  const update = (fn: (ls: Level[]) => Level[]) => onChange(fn(levels))
  const toNum = (raw: string): number | null => raw.trim() === '' ? null : Math.max(0, Math.round(Number(raw)))

  const setField = (idx: number, key: 'smallBlind' | 'bigBlind' | 'ante' | 'duration', raw: string) => {
    const v = toNum(raw)
    update(ls => ls.map((l, i) => {
      if (i !== idx) return l
      if (l.type === 'break') return key === 'duration' ? { ...l, duration: v } : l
      // SB を入れたら BB・アンティを 2 倍で埋め、BB を入れたらアンティを揃える(よくある構成)。
      if (key === 'smallBlind') return { ...l, smallBlind: v, bigBlind: v === null ? l.bigBlind : v * 2, ante: v === null ? l.ante : v * 2 }
      if (key === 'bigBlind') return { ...l, bigBlind: v, ante: v }
      return { ...l, [key]: v }
    }))
  }
  const move = (idx: number, dir: -1 | 1) => update(ls => {
    const to = idx + dir
    if (to < 0 || to >= ls.length) return ls
    const nl = [...ls]; const [m] = nl.splice(idx, 1); nl.splice(to, 0, m); return nl
  })
  const insertAt = (at: number) => update(ls => { const nl = [...ls]; nl.splice(at, 0, emptyLevel()); return nl })
  const toggleBreak = (idx: number) => update(ls => ls.map((lv, i) => {
    if (i !== idx) return lv
    if (lv.type === 'level') return { type: 'break', duration: lv.duration, comment: lv.comment ?? null }
    return { ...emptyLevel(), duration: lv.duration, comment: lv.comment ?? null }
  }))
  const remove = (idx: number) => update(ls => ls.filter((_, i) => i !== idx))
  const run = (fn: () => void) => { fn(); setMenuIdx(null) }

  return (
    <>
      {/* 列の見出し(行の入力欄と同じ並び) */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '0 8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--label2)', textAlign: 'center' }}>
        <span>Lv</span><span>SB</span><span>BB</span><span>Ante</span><span>分</span><span />
      </div>

      {levels.length === 0 && (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--label2)', padding: '24px 0' }}>ブラインドが設定されていません</p>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {levels.map((lv, idx) => (
          <li key={idx} style={{ background: lv.type === 'break' ? 'rgba(10,108,214,0.06)' : '#fff', borderRadius: 16, padding: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center' }}>
              {lv.type === 'level' ? (
                <>
                  <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#995C00', fontVariantNumeric: 'tabular-nums' }}>{levelNo(idx)}</span>
                  {(['smallBlind', 'bigBlind', 'ante', 'duration'] as const).map(key => (
                    <input key={key} type="number" inputMode="numeric" min={0} value={lv[key] ?? ''} placeholder="—"
                      aria-label={`レベル${levelNo(idx)} ${{ smallBlind: 'SB', bigBlind: 'BB', ante: 'アンティ', duration: '分' }[key]}`}
                      onChange={e => setField(idx, key, e.target.value)} className="no-spin ble-input" style={numInput} />
                  ))}
                </>
              ) : (
                <>
                  <span style={{ display: 'flex', justifyContent: 'center', color: '#1546D9' }}><CoffeeIcon size={20} /></span>
                  <span style={{ gridColumn: '2 / span 3', fontSize: 13, fontWeight: 600, color: '#1546D9', paddingLeft: 8 }}>休憩</span>
                  <input type="number" inputMode="numeric" min={0} value={lv.duration ?? ''} placeholder="10" aria-label="休憩の分"
                    onChange={e => setField(idx, 'duration', e.target.value)} className="no-spin ble-input" style={numInput} />
                </>
              )}
              <button type="button" onClick={() => setMenuIdx(idx)} aria-label={lv.type === 'level' ? `レベル${levelNo(idx)}の操作` : 'この休憩の操作'}
                className="ble-press" style={{ width: 44, height: 44, border: 'none', borderRadius: 22, background: 'transparent', color: 'var(--label2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <EllipsisIcon size={20} />
              </button>
            </div>
            {(commentIdx === idx || lv.comment) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <MessageSquareIcon size={16} style={{ color: 'var(--label3)', flexShrink: 0, marginLeft: 8 }} />
                <input type="text" placeholder="タイマーに出すメモ(例: 次からアンティ)" value={lv.comment ?? ''}
                  onChange={e => update(ls => ls.map((l, i) => i !== idx ? l : { ...l, comment: e.target.value || null }))}
                  onBlur={() => setCommentIdx(null)}
                  className="ble-input" style={{ ...numInput, flex: 1, textAlign: 'left', padding: '0 16px', fontWeight: 400 }}
                  autoFocus={commentIdx === idx} />
              </div>
            )}
          </li>
        ))}
      </ol>

      {showAddButtons && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => onChange(withNextLevel(levels))} className="ble-press" style={addBtn}><PlusIcon size={20} /> レベル</button>
          <button type="button" onClick={() => onChange(withBreak(levels))} className="ble-press" style={addBtn}><CoffeeIcon size={20} /> 休憩</button>
        </div>
      )}

      <style>{`
        .ble-input:focus { box-shadow: inset 0 0 0 2px #F9B318; background: #fff; }
        .ble-press { -webkit-tap-highlight-color: transparent; transition: transform 100ms ease-out, background-color 100ms ease-out; }
        .ble-press:active { transform: scale(0.97); }
        .ble-row:active { background: rgba(60,60,67,0.06); }
        .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spin { -moz-appearance: textfield; }
      `}</style>

      {/* 行の操作(iOS のアクションシート) */}
      {menuIdx !== null && levels[menuIdx] && typeof document !== 'undefined' && createPortal((() => {
        const idx = menuIdx
        const lv = levels[idx]
        const items: [React.ReactNode, string, () => void, boolean][] = [
          [<ArrowUpIcon key="u" size={20} />, '上へ移動', () => move(idx, -1), idx === 0],
          [<ArrowDownIcon key="d" size={20} />, '下へ移動', () => move(idx, 1), idx === levels.length - 1],
          [<PlusIcon key="b" size={20} />, 'この上にレベルを追加', () => insertAt(idx), false],
          [<PlusIcon key="a" size={20} />, 'この下にレベルを追加', () => insertAt(idx + 1), false],
          [<MessageSquareIcon key="c" size={20} />, lv.comment ? 'メモを編集' : 'メモを追加', () => setCommentIdx(idx), false],
          [<CoffeeIcon key="t" size={20} />, lv.type === 'level' ? '休憩に変える' : 'レベルに変える', () => toggleBreak(idx), false],
        ]
        return (
          <div role="dialog" aria-modal="true" aria-label="行の操作" style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 8px calc(8px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="a-scrim" onClick={() => setMenuIdx(null)} style={{ position: 'absolute', inset: 0 }} />
            <div className="a-sheet" style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'transparent', boxShadow: 'none', borderRadius: 0 }}>
              <div role="menu" style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
                <p style={{ fontSize: 11, color: 'var(--label2)', textAlign: 'center', margin: 0, padding: '16px 16px 8px' }}>
                  {lv.type === 'level' ? `レベル ${levelNo(idx)}` : '休憩'}
                </p>
                {items.map(([icon, label, action, disabled]) => (
                  <button key={label} type="button" role="menuitem" onClick={() => run(action)} disabled={disabled} className="ble-row" style={{ ...menuItem, opacity: disabled ? 0.35 : 1 }}>
                    <span style={{ flex: 1 }}>{label}</span>{icon}
                  </button>
                ))}
                <button type="button" role="menuitem" onClick={() => run(() => remove(idx))} className="ble-row" style={{ ...menuItem, color: '#D70015' }}>
                  <span style={{ flex: 1 }}>削除</span><Trash2Icon size={20} />
                </button>
              </div>
              <button type="button" onClick={() => setMenuIdx(null)} className="ble-press" style={{ width: '100%', minHeight: 56, marginTop: 8, borderRadius: 16, border: 'none', background: '#fff', fontSize: 14, fontWeight: 600, color: '#1546D9', fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )
      })(), document.body)}
    </>
  )
}

const addBtn: React.CSSProperties = {
  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  minHeight: 48, borderRadius: 999, border: 'none', background: '#fff', color: 'var(--label)',
  boxShadow: 'inset 0 0 0 1px rgba(60,60,67,0.12)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
}
