'use client';

import { useMemo } from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

type HandAction = 'raise' | 'call' | 'fold' | 'mixed';

interface RangeDisplayProps {
  position: string;
  currentBet: number;
  bigBlind: number;
  stack: number;
  onClose: () => void;
}

// GTO推奨レンジデータ（プリフロップOpen）
const GTO_RANGES: Record<string, Record<string, HandAction>> = {
  BTN: {
    AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise', '77': 'raise', '66': 'mixed', '55': 'mixed', '44': 'fold', '33': 'fold', '22': 'fold',
    AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise', A7s: 'raise', A6s: 'raise', A5s: 'raise', A4s: 'raise', A3s: 'raise', A2s: 'raise',
    AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'mixed', A8o: 'mixed', A7o: 'fold', A6o: 'fold', A5o: 'fold', A4o: 'fold', A3o: 'fold', A2o: 'fold',
    KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise', K8s: 'raise', K7s: 'raise', K6s: 'mixed', K5s: 'mixed', K4s: 'fold', K3s: 'fold', K2s: 'fold',
    KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'mixed', K8o: 'fold', K7o: 'fold',
    QJs: 'raise', QTs: 'raise', Q9s: 'raise', Q8s: 'mixed', Q7s: 'mixed', Q6s: 'fold', Q5s: 'fold',
    QJo: 'raise', QTo: 'raise', Q9o: 'mixed', Q8o: 'fold',
    JTs: 'raise', J9s: 'raise', J8s: 'mixed', J7s: 'fold',
    JTo: 'raise', J9o: 'mixed', J8o: 'fold',
    'T9s': 'raise', 'T8s': 'raise', 'T7s': 'mixed',
    'T9o': 'raise', 'T8o': 'mixed',
    '98s': 'raise', '97s': 'raise', '96s': 'mixed',
    '98o': 'mixed',
    '87s': 'raise', '86s': 'raise', '85s': 'mixed',
    '87o': 'mixed',
    '76s': 'raise', '75s': 'raise', '74s': 'fold',
    '76o': 'mixed',
    '65s': 'raise', '64s': 'mixed',
    '54s': 'raise', '53s': 'mixed',
    '43s': 'mixed', '42s': 'fold',
  },
  CO: {
    AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise', '77': 'raise', '66': 'raise', '55': 'mixed', '44': 'fold', '33': 'fold', '22': 'fold',
    AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise', A7s: 'mixed', A6s: 'mixed', A5s: 'raise', A4s: 'mixed', A3s: 'mixed', A2s: 'mixed',
    AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'mixed', A8o: 'fold', A7o: 'fold',
    KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise', K8s: 'mixed', K7s: 'mixed', K6s: 'fold', K5s: 'fold',
    KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'mixed', K8o: 'fold',
    QJs: 'raise', QTs: 'raise', Q9s: 'raise', Q8s: 'mixed', Q7s: 'fold',
    QJo: 'raise', QTo: 'raise', Q9o: 'mixed',
    JTs: 'raise', J9s: 'raise', J8s: 'mixed',
    JTo: 'raise', J9o: 'mixed',
    'T9s': 'raise', 'T8s': 'raise', 'T7s': 'mixed',
    '98s': 'raise', '97s': 'mixed',
    '87s': 'raise', '86s': 'mixed',
    '76s': 'raise', '75s': 'mixed',
    '65s': 'raise', '64s': 'fold',
    '54s': 'mixed',
  },
  UTG: {
    AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise', '77': 'raise', '66': 'fold', '55': 'fold', '44': 'fold', '33': 'fold', '22': 'fold',
    AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'mixed', A7s: 'fold', A6s: 'fold', A5s: 'raise', A4s: 'fold', A3s: 'fold', A2s: 'fold',
    AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'mixed', A9o: 'fold',
    KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'mixed', K8s: 'fold',
    KQo: 'raise', KJo: 'raise', KTo: 'mixed', K9o: 'fold',
    QJs: 'raise', QTs: 'raise', Q9s: 'mixed', Q8s: 'fold',
    QJo: 'raise', QTo: 'mixed', Q9o: 'fold',
    JTs: 'raise', J9s: 'raise', J8s: 'fold',
    JTo: 'mixed',
    'T9s': 'raise', 'T8s': 'mixed',
    '98s': 'raise', '97s': 'fold',
    '87s': 'mixed',
    '76s': 'fold',
  },
  SB: {
    AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise', '77': 'raise', '66': 'raise', '55': 'raise', '44': 'mixed', '33': 'mixed', '22': 'mixed',
    AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise', A7s: 'raise', A6s: 'raise', A5s: 'raise', A4s: 'raise', A3s: 'raise', A2s: 'raise',
    AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'raise', A8o: 'mixed', A7o: 'mixed',
    KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise', K8s: 'raise', K7s: 'raise', K6s: 'raise', K5s: 'mixed',
    KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'raise', K8o: 'mixed',
    QJs: 'raise', QTs: 'raise', Q9s: 'raise', Q8s: 'raise',
    QJo: 'raise', QTo: 'raise', Q9o: 'mixed',
    JTs: 'raise', J9s: 'raise', J8s: 'raise',
    JTo: 'raise', J9o: 'mixed',
    'T9s': 'raise', 'T8s': 'raise', 'T7s': 'mixed',
    '98s': 'raise', '97s': 'raise',
    '87s': 'raise', '86s': 'mixed',
    '76s': 'raise', '75s': 'mixed',
    '65s': 'raise', '54s': 'raise',
  },
};

const ACTION_COLORS: Record<HandAction, string> = {
  raise: '#F2A900',
  call: '#4CAF50',
  mixed: '#8BC34A',
  fold: '#2E2E2E',
};

export default function RangeDisplay({ position, onClose }: RangeDisplayProps) {
  const range = GTO_RANGES[position] ?? GTO_RANGES['BTN'];

  const getHandAction = (r1: string, r2: string, suited: boolean): HandAction => {
    const hand = r1 === r2 ? r1 + r2 : suited ? r1 + r2 + 's' : r1 + r2 + 'o';
    return range[hand] ?? 'fold';
  };

  const stats = useMemo(() => {
    const counts = { raise: 0, call: 0, mixed: 0, fold: 0 };
    let total = 0;
    for (let i = 0; i < RANKS.length; i++) {
      for (let j = 0; j < RANKS.length; j++) {
        const r1 = RANKS[i];
        const r2 = RANKS[j];
        const action = i === j
          ? getHandAction(r1, r2, false)
          : i < j
            ? getHandAction(r1, r2, true)
            : getHandAction(r2, r1, false);
        counts[action]++;
        total++;
      }
    }
    return { ...counts, total };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  return (
    <div className="bg-[#0F0F0F] border-t border-[#2E2E2E] px-3 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-white font-semibold">{position} Open Range</span>
          <span className="text-[#F2A900] text-xs ml-2 px-1.5 py-0.5 rounded bg-[#F2A900]/20">GTO</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white text-lg p-1">×</button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${RANKS.length}, minmax(0, 1fr))`,
            width: '100%',
          }}
        >
          {RANKS.map((r1, i) =>
            RANKS.map((r2, j) => {
              let action: HandAction;
              let label: string;

              if (i === j) {
                action = getHandAction(r1, r2, false);
                label = r1 + r2;
              } else if (i < j) {
                action = getHandAction(r1, r2, true);
                label = r1 + r2 + 's';
              } else {
                action = getHandAction(r2, r1, false);
                label = r2 + r1 + 'o';
              }

              return (
                <div
                  key={`${i}-${j}`}
                  title={`${label}: ${action}`}
                  style={{ backgroundColor: ACTION_COLORS[action] }}
                  className="aspect-square rounded-sm flex items-center justify-center"
                >
                  <span className="text-black/70 font-bold" style={{ fontSize: '6px' }}>
                    {label.length <= 3 ? label : label.slice(0, 2)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {Object.entries(ACTION_COLORS).map(([action, color]) => (
          <div key={action} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-white/60 text-xs capitalize">{action}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-2 text-white/40 text-xs">
        Open率: {Math.round(((stats.raise + stats.mixed * 0.5) / stats.total) * 100)}%
      </div>
    </div>
  );
}
