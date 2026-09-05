'use client'

/**
 * iOS のスイッチ。
 *
 * つまみは押している間だけ横に伸び、離すと縮んで収まる。これがあるだけで
 * 「板の上の絵」ではなく「掴んでいる物」に見える。伸縮と移動は .a-switch に
 * 書いてあるので、ここは状態と読み上げだけを持つ。
 */
export default function AppleSwitch({
  on,
  onToggle,
  disabled,
  label,
}: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="a-switch"
      style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
    />
  )
}
