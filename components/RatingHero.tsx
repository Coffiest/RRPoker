'use client'

import { FiHelpCircle } from 'react-icons/fi'

/**
 * トナメ偏差値カードの中身。
 *
 * ライブ(店舗のトーナメント)と Poker ART(オンライン)で全く同じ意匠にするため、
 * 両方がこの1つのコンポーネントを使う。違うのは母集団だけで、計算式は同一
 * (回収率に経験ベイズ収縮 → 平均50・標準偏差10のTスコア)。
 */

export interface RatingHeroProps {
  /** カードの見出し(どちらの偏差値か)。 */
  title: string
  /** 参加したトーナメント数。0 のときは数値を出さない。 */
  plays: number
  /** 偏差値。 */
  rating: number
  /** 前回からの変化量。出さないときは null。 */
  delta?: number | null
  /** 全国順位。無ければ null。 */
  rank?: number | null
  /** 参加数が0のときに数値の代わりに出す文言。 */
  emptyLabel: string
  /** 参加数が0のときの補足説明。 */
  emptyNote?: string
  /** 「未プレイ」のときに出す導線ボタン。 */
  emptyAction?: { label: string; onClick: () => void }
  /** 「?」ボタン。省略すると出さない。 */
  onInfo?: (rect: DOMRect) => void
}

export default function RatingHero({
  title, plays, rating, delta = null, rank = null,
  emptyLabel, emptyNote, emptyAction, onInfo,
}: RatingHeroProps) {
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* ラベル行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        {/* ラベルの意匠は main のテック基調刷新に合わせる(モノスペース + 広めの字送り)。 */}
        <p className="term-prompt-arrow" style={{ fontFamily: 'var(--stack-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)' }}>
          {title}
        </p>
        {onInfo && (
          <button
            type="button"
            onClick={(e) => onInfo(e.currentTarget.getBoundingClientRect())}
            aria-label="トナメ偏差値とは"
            style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <FiHelpCircle size={13} style={{ color: 'rgba(255,255,255,0.85)' }} />
          </button>
        )}
      </div>

      {/* メイン数値 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        {plays === 0 ? (
          <div>
            <p style={{ fontSize: 40, fontWeight: 800, color: 'rgba(255,255,255,0.75)', lineHeight: 1, letterSpacing: '-0.5px' }}>
              {emptyLabel}
            </p>
            {emptyNote && (
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5, maxWidth: 220 }}>
                {emptyNote}
              </p>
            )}
            {emptyAction && (
              <button
                type="button"
                onClick={emptyAction.onClick}
                style={{
                  marginTop: 10, height: 34, padding: '0 16px', borderRadius: 99,
                  background: 'rgba(255,255,255,0.92)', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, color: '#C97D00',
                }}
              >
                {emptyAction.label}
              </button>
            )}
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <p className="tech-num" style={{ fontSize: 52, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>
              {rating.toFixed(2)}
            </p>
            {delta !== null && Math.abs(delta) > 0.001 && (
              <span className="delta-badge" style={{ fontSize: 13, fontWeight: 800, color: delta >= 0 ? '#86EFAC' : '#FCA5A5', background: 'rgba(0,0,0,0.3)', borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
              </span>
            )}
            {rank !== null && (
              <div style={{ marginBottom: 6, background: 'rgba(0,0,0,0.18)', borderRadius: 99, padding: '4px 10px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>全国{rank}位</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
