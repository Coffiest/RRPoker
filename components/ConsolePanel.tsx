'use client'

/**
 * コンソール(端末)の窓に見せる枠。
 *
 * 上端にタイトルバー、中身は等幅。角の3つの丸はSVGで描いた点で、
 * 絵文字は使っていない。ダイアログでも面でも同じ見え方になるよう、
 * 見た目だけをここに集約する(中身は呼び出し側が決める)。
 */
export function ConsolePanel({
  title,
  children,
  tone = 'dark',
  style,
  className = '',
}: {
  /** タイトルバーに出すファイル名風の文字列。 */
  title: string
  children: React.ReactNode
  /** dark = 黒地の端末、light = 紙面に置く明るい端末。 */
  tone?: 'dark' | 'light'
  style?: React.CSSProperties
  className?: string
}) {
  const dark = tone === 'dark'
  const bg = dark ? '#0E0E10' : '#FFFFFF'
  const bar = dark ? '#1A1A1E' : '#F2F2F7'
  const line = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const titleColor = dark ? 'rgba(255,255,255,0.42)' : 'rgba(60,60,67,0.45)'

  return (
    <div
      className={className}
      style={{
        background: bg,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${line}`,
        boxShadow: dark
          ? '0 18px 50px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 8px 26px rgba(0,0,0,0.10)',
        ...style,
      }}
    >
      {/* タイトルバー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 12px',
        background: bar,
        borderBottom: `1px solid ${line}`,
      }}>
        <svg width="38" height="8" viewBox="0 0 38 8" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="4" cy="4" r="4" fill={dark ? '#3A3A40' : '#D8D8DE'} />
          <circle cx="17" cy="4" r="4" fill={dark ? '#3A3A40' : '#D8D8DE'} />
          <circle cx="30" cy="4" r="4" fill="#F2A900" />
        </svg>
        <span className="tech-label" style={{ fontSize: 9.5, color: titleColor, letterSpacing: '0.16em' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * 端末に流れる1行。`kind` で行頭の記号と色を決める。
 *  - cmd  … 打ち込んだ命令( $ )
 *  - out  … その出力( > )
 *  - ok   … 成功( ✓ 相当の印は呼び出し側で足す)
 *  - note … 補足のコメント( // )
 */
export function ConsoleLine({
  kind = 'out',
  children,
  delay = 0,
  tone = 'dark',
}: {
  kind?: 'cmd' | 'out' | 'ok' | 'note'
  children: React.ReactNode
  /** 上から順に流れて見えるよう、行ごとに遅らせる秒数。 */
  delay?: number
  tone?: 'dark' | 'light'
}) {
  const dark = tone === 'dark'
  const color =
    kind === 'cmd' ? (dark ? 'rgba(255,255,255,0.92)' : '#1C1C1E')
    : kind === 'ok' ? '#F2A900'
    : kind === 'note' ? (dark ? 'rgba(255,255,255,0.32)' : 'rgba(60,60,67,0.40)')
    : (dark ? 'rgba(255,255,255,0.62)' : 'rgba(60,60,67,0.62)')

  const prefix = kind === 'cmd' ? '$' : kind === 'out' ? '>' : kind === 'note' ? '//' : ''

  return (
    <p
      className="tech-reveal"
      style={{
        fontFamily: 'var(--stack-mono)',
        fontSize: 12,
        lineHeight: 1.75,
        color,
        display: 'flex',
        gap: 8,
        ['--tech-reveal-delay' as string]: `${delay}s`,
      } as React.CSSProperties}
    >
      {prefix && <span style={{ opacity: 0.5, flexShrink: 0 }}>{prefix}</span>}
      <span style={{ minWidth: 0 }}>{children}</span>
    </p>
  )
}
