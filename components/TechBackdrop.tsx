'use client'

/**
 * 画面の下地。方眼(ブループリント)と、ゆっくり息づく金色のにじみ。
 *
 * ログイン画面と同じ下地を、ホーム・マイページ・入出金でも使う。
 * 各画面で書くと必ずズレていくので、1か所にまとめて同じものを敷く。
 *
 * ヘッダーには方眼を敷かない。ヘッダーまで方眼にすると紙面全体が
 * うるさくなり、白いヘッダーとの境目も消えてしまうため。
 *
 * `position: fixed` で画面に貼り付けるので、スクロールしても方眼は動かない。
 * 内容より後ろ(zIndex: 0)に置き、指はすべて素通しにする。
 */
export default function TechBackdrop({ base = '#FFFBF5' }: { base?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', background: base }}
    >
      <style>{`
        @keyframes techOrbDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(0, -18px, 0) scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tech-orb { animation: none !important; }
        }
      `}</style>

      <div className="tech-grid" style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

      <div
        className="tech-orb"
        style={{
          position: 'absolute', top: '6%', right: '-8%', width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(242,169,0,0.11) 0%, transparent 70%)',
          animation: 'techOrbDrift 14s ease-in-out infinite',
        }}
      />
      <div
        className="tech-orb"
        style={{
          position: 'absolute', bottom: '12%', left: '-10%', width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(242,169,0,0.07) 0%, transparent 70%)',
          animation: 'techOrbDrift 18s ease-in-out infinite',
          animationDelay: '-6s',
        }}
      />
      <div
        className="tech-orb"
        style={{
          position: 'absolute', top: '44%', left: '38%', width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(242,169,0,0.06) 0%, transparent 70%)',
          animation: 'techOrbDrift 22s ease-in-out infinite',
          animationDelay: '-11s',
        }}
      />
    </div>
  )
}
