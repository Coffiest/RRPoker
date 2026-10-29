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
  const bar = dark ? '#1A1A1E' : '#EDECE6'
  const line = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const titleColor = dark ? 'rgba(255,255,255,0.75)' : 'var(--label3)'

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
        padding: '8px 16px',
        background: bar,
        borderBottom: `1px solid ${line}`,
      }}>
        <span className="tech-label" style={{ fontSize: 11, color: titleColor }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * 端末に流れる1行。`kind` で行頭の記号と色を決める。
 *  - cmd  … 打ち込んだ命令( $ )
 *  - out  … その出力( > )
 *  - ok   … 成功(チェックの印は呼び出し側で足す)
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
    : kind === 'ok' ? '#F9B318'
    : kind === 'note' ? (dark ? 'rgba(255,255,255,0.7)' : 'var(--label3)')
    : (dark ? 'rgba(255,255,255,0.75)' : 'var(--label2)')

  const prefix = ''

  return (
    <p
      className="tech-reveal"
      style={{
        fontFamily: 'var(--stack-mono)',
        fontSize: 12,
        lineHeight: 1.6,
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
