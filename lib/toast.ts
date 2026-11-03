/**
 * 画面の下に短く出すお知らせ(トースト)。
 * ブラウザ標準の alert() は画面全体を止め、見た目もアプリと合わないため使わない。
 * 表示は components/Toaster.tsx(app/layout.tsx に 1 つだけ置く)。
 */
export type ToastKind = 'error' | 'ok'

export function showToast(message: string, kind: ToastKind = 'error') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('rrpoker:toast', { detail: { message, kind } }))
}
