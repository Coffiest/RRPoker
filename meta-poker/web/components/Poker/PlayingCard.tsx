'use client';

type CardSize = 'xs' | 'sm' | 'md';

interface PlayingCardProps {
  card: string | null;
  size?: CardSize;
  faceDown?: boolean;
}

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  h: { symbol: '♥', color: '#E53E3E' },
  d: { symbol: '♦', color: '#E53E3E' },
  c: { symbol: '♣', color: '#1A1A1A' },
  s: { symbol: '♠', color: '#1A1A1A' },
};

const SIZE_CLASSES: Record<CardSize, { card: string; rank: string; suit: string }> = {
  xs: { card: 'w-8 h-11 rounded-md', rank: 'text-sm leading-none', suit: 'text-xs' },
  sm: { card: 'w-10 h-14 rounded-lg', rank: 'text-base leading-none', suit: 'text-xs' },
  md: { card: 'w-14 h-20 rounded-xl', rank: 'text-xl leading-none', suit: 'text-sm' },
};

export default function PlayingCard({ card, size = 'sm', faceDown = false }: PlayingCardProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div className={`
        ${sizeClass.card}
        bg-[#1A237E] border border-[#283593]
        flex items-center justify-center
        shadow-md
      `}>
        <div className="w-full h-full rounded-[inherit] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTAgMGgyMHYyMEgweiIgZmlsbD0iIzFBMjM3RSIvPjxwYXRoIGQ9Ik0xMCAxMG01IDBWMTVIMTVWMTB6IiBzdHJva2U9IiMyODM1OTMiIHN0cm9rZS13aWR0aD0iMC41IiBmaWxsPSJub25lIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=')] opacity-50" />
      </div>
    );
  }

  const rank = card.length === 3 ? card.slice(0, 2) : card.slice(0, 1);
  const suit = card.slice(-1);
  const { symbol, color } = SUIT_SYMBOLS[suit] ?? { symbol: '?', color: '#666' };
  const displayRank = rank === 'T' ? '10' : rank;

  return (
    <div className={`
      ${sizeClass.card}
      bg-white border border-gray-200
      flex flex-col items-start justify-start
      p-1 shadow-md relative overflow-hidden
    `}>
      <div className={`${sizeClass.rank} font-bold leading-none`} style={{ color }}>
        {displayRank}
      </div>
      <div className={`${sizeClass.suit} leading-none`} style={{ color }}>
        {symbol}
      </div>
      {/* Center suit */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <span className="text-2xl" style={{ color }}>{symbol}</span>
      </div>
    </div>
  );
}
