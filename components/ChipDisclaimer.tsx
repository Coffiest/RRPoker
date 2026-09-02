/**
 * チップの性質を明示する注記。
 *
 * RRPoker のチップは店舗内のゲーム進行を記録するためのポイントであり、
 * 現金・賞金・換金可能な価値を持たない。App Store の年齢制限
 * (Guideline 2.3.6) では「実際の金銭を伴うゲーム」に該当しないことを
 * 画面上でも読み取れる必要があるため、チップを扱う画面に置く。
 */
export default function ChipDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p
      className={className}
      style={{ fontSize: 11, lineHeight: 1.6, color: '#8E8E93' }}
    >
      チップは店舗内でのゲーム進行を記録するためのポイントです。現金・賞金との交換や換金はできず、金銭的な価値はありません。
    </p>
  )
}
