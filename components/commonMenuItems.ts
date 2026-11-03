import { useRouter } from 'next/navigation'

export type MenuItem = {
  label: string
  onClick: () => void
}

/**
 * 共通メニュー項目生成関数。
 * router: useRouter() で取得したインスタンスを渡すこと。
 * variant: 'user' | 'store' で分岐可能。
 */
export function getCommonMenuItems(router: ReturnType<typeof useRouter>, variant: 'user' | 'store' = 'user'): MenuItem[] {
  const items: MenuItem[] = []
  if (variant === 'store') {
    items.push({
      label: '設定',
      onClick: () => router.push('/home/store/settings'),
    })
  }
  // TVと連携は店舗だけ(プレイヤーは選べない。オーナー指定)。
  if (variant === 'store') {
    items.push({
      label: 'TVと連携',
      onClick: () => router.push('/home/pair'),
    })
  }
  // 必要に応じて他の共通項目を追加
  return items
}
