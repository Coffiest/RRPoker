'use client'

import PokerArtEmbed from '@/components/PokerArtEmbed'

/** ハンドヒストリー。Poker ART のロビーの履歴タブを直接開く。 */
export default function ArtHandsPage() {
  return <PokerArtEmbed path="/?tab=history" />
}
