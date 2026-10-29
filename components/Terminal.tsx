'use client'

import { useEffect, useState } from 'react'

/**
 * コンソール風の部品(CLAUDE.md の絶対ルール「テック感・プログラマー感・コンソール感」)。
 *
 * TermBar  … カード上端のターミナル窓の帯。● ● ● と現在地(~/store/home など)を出す。
 * BootLog  … 画面を開いた瞬間だけ流れる短い起動ログ。操作は待たせない(表示しながら押せる)。
 */

export function TermBar({ path, onDark = false, right }: { path: string; onDark?: boolean; right?: React.ReactNode }) {
  const dot = (bg: string) => <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: bg, display: 'inline-block' }} />
  return (
    <div className="term-bar" style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      borderBottom: `1px solid ${onDark ? 'rgba(255,255,255,0.28)' : 'rgba(21,70,217,0.14)'}`,
    }}>
      <span style={{ display: 'inline-flex', gap: 6 }}>
        {dot(onDark ? 'rgba(255,255,255,0.9)' : '#1546D9')}
        {dot(onDark ? 'rgba(255,255,255,0.65)' : '#F9B318')}
        {dot(onDark ? 'rgba(255,255,255,0.4)' : 'rgba(60,60,67,0.28)')}
      </span>
      <span className="tech-label" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'none', color: onDark ? '#fff' : 'var(--label2)' }}>{path}</span>
      {right}
    </div>
  )
}

type Line = { text: string; ok?: boolean }

export function BootLog({ lines, storageKey }: { lines: Line[]; storageKey: string }) {
  // 1 回のセッションで 1 度だけ流す(画面を行き来するたびに出るとうるさい)
  const [shown, setShown] = useState(0)
  const [done, setDone] = useState(false)
  const [skip, setSkip] = useState(true)

  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem(storageKey) === '1'; sessionStorage.setItem(storageKey, '1') } catch {}
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (seen) return
    setSkip(false)
    if (reduce) { setShown(lines.length); const t = setTimeout(() => setDone(true), 900); return () => clearTimeout(t) }
    const timers: number[] = []
    lines.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), 120 + i * 160)))
    timers.push(window.setTimeout(() => setDone(true), 120 + lines.length * 160 + 700))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (skip) return null
  return (
    <div aria-hidden="true" className="boot-log" data-done={done ? '' : undefined} style={{
      fontFamily: 'var(--stack-mono)', fontSize: 10, lineHeight: 1.7, color: 'var(--label2)',
      padding: '8px 4px 0', overflow: 'hidden',
    }}>
      {lines.slice(0, shown).map((l, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: '#1546D9', marginRight: 8 }}>{i === 0 ? '$' : '›'}</span>
          {l.text}
          {l.ok && <span style={{ color: '#1E7B34', marginLeft: 8, fontWeight: 700 }}>[ OK ]</span>}
          {i === shown - 1 && !done && <span className="tech-caret" />}
        </div>
      ))}
      <style>{`
        .boot-log { max-height: 120px; transition: max-height .4s cubic-bezier(0.2,0.9,0.3,1) .1s, opacity .3s ease .1s; }
        .boot-log[data-done] { max-height: 0; opacity: 0; padding-top: 0; }
      `}</style>
    </div>
  )
}
