'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  collection, query, orderBy, limit, where,
  getDocs, startAfter, QueryDocumentSnapshot, DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { HandHistory } from '@/lib/types';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';
import { LoadingSpinner } from '@/components/UI/LoadingSpinner';

const POSITIONS = ['ALL', 'BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO'] as const;
const RESULTS = ['ALL', 'win', 'lose', 'fold', 'split'] as const;

type PositionFilter = (typeof POSITIONS)[number];
type ResultFilter = (typeof RESULTS)[number];

const PAGE_SIZE = 20;

export default function HandHistoryPage() {
  const { isPremium } = useAuth();
  const [hands, setHands] = useState<HandHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL');

  const buildQuery = (afterDoc?: QueryDocumentSnapshot<DocumentData>) => {
    let q = query(
      collection(db, 'handHistories'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );
    if (positionFilter !== 'ALL') q = query(q, where('position', '==', positionFilter));
    if (resultFilter !== 'ALL') q = query(q, where('result', '==', resultFilter));
    if (afterDoc) q = query(q, startAfter(afterDoc));
    return q;
  };

  const fetchHands = async () => {
    setLoading(true);
    setLastDoc(null);
    setHasMore(true);
    const snap = await getDocs(buildQuery());
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HandHistory));
    setHands(docs);
    setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
    setHasMore(snap.docs.length === PAGE_SIZE);
    setLoading(false);
  };

  const loadMore = async () => {
    if (!lastDoc) return;
    setLoadingMore(true);
    const snap = await getDocs(buildQuery(lastDoc));
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HandHistory));
    setHands((prev) => [...prev, ...docs]);
    setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
    setHasMore(snap.docs.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (isPremium) fetchHands();
    else setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, positionFilter, resultFilter]);

  const stats = {
    total: hands.length,
    wins: hands.filter((h) => h.result === 'win').length,
    winRate: hands.length > 0 ? Math.round((hands.filter((h) => h.result === 'win').length / hands.length) * 100) : 0,
    avgPot: hands.length > 0 ? Math.round(hands.reduce((s, h) => s + h.potAmount, 0) / hands.length) : 0,
    totalNetGain: hands.reduce((s, h) => s + (h.netGain ?? 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#1E1E1E] px-5 py-4">
        <h1 className="text-white text-lg font-bold max-w-2xl mx-auto">ハンドヒストリー</h1>
      </div>

      {!isPremium ? (
        <PremiumGate />
      ) : (
        <div className="px-5 py-4 max-w-2xl mx-auto flex flex-col gap-3">
          {/* Stats */}
          {hands.length > 0 && (
            <Card>
              <div className="grid grid-cols-4 gap-3 text-center">
                <StatBox label="ハンド" value={String(stats.total)} />
                <StatBox label="勝率" value={`${stats.winRate}%`} />
                <StatBox label="平均ポット" value={stats.avgPot.toLocaleString()} />
                <StatBox
                  label="収支"
                  value={`${stats.totalNetGain >= 0 ? '+' : ''}${stats.totalNetGain.toLocaleString()}`}
                  color={stats.totalNetGain >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}
                />
              </div>
              {hands.length > 3 && <MiniChart hands={hands} />}
            </Card>
          )}

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as PositionFilter)}
              className="px-3 py-2 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:border-[#F2A900] transition-colors"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p} className="bg-[#141414]">
                  {p === 'ALL' ? 'ポジション: 全て' : p}
                </option>
              ))}
            </select>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
              className="px-3 py-2 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:border-[#F2A900] transition-colors"
            >
              {RESULTS.map((r) => (
                <option key={r} value={r} className="bg-[#141414]">
                  {r === 'ALL' ? '結果: 全て' : r}
                </option>
              ))}
            </select>
          </div>

          {/* Hand List */}
          {loading ? (
            <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
          ) : hands.length === 0 ? (
            <div className="text-center py-20 text-[#606060] text-sm">ハンドが見つかりません</div>
          ) : (
            <>
              <div className="bg-[#141414] rounded-[18px] overflow-hidden border border-[#1E1E1E]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1E1E1E]">
                      <th className="text-left px-4 py-3 text-[#606060] font-normal">ハンド</th>
                      <th className="text-left px-4 py-3 text-[#606060] font-normal">POS</th>
                      <th className="text-right px-4 py-3 text-[#606060] font-normal">ポット</th>
                      <th className="text-right px-4 py-3 text-[#606060] font-normal">収支</th>
                      <th className="text-center px-4 py-3 text-[#606060] font-normal">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hands.map((hand) => (
                      <HandRow key={hand.id} hand={hand} />
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMore && (
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                    もっと見る
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className={`font-bold text-base ${color ?? 'text-white'}`}>{value}</div>
      <div className="text-[#606060] text-xs mt-0.5">{label}</div>
    </div>
  );
}

function HandRow({ hand }: { hand: HandHistory }) {
  const resultConfig: Record<string, { cls: string; label: string }> = {
    win:   { cls: 'text-[#34C759]', label: '勝' },
    lose:  { cls: 'text-[#FF3B30]', label: '負' },
    fold:  { cls: 'text-[#606060]', label: 'F' },
    split: { cls: 'text-[#0A84FF]', label: '分' },
  };
  const rc = resultConfig[hand.result] ?? { cls: 'text-[#606060]', label: hand.result };
  const netGain = hand.netGain ?? 0;

  const formatCards = (s: string): string => {
    if (!s || s.length < 2) return s;
    const rank1 = s[0] === 'T' ? '10' : s[0];
    const suit1 = s[1];
    const rank2 = s.length >= 4 ? (s[2] === 'T' ? '10' : s[2]) : '';
    const suit2 = s.length >= 4 ? s[3] : '';
    return `${rank1}${suit1}${rank2}${suit2}`;
  };

  return (
    <tr className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A] transition-colors">
      <td className="px-4 py-3 font-mono text-white text-xs">{formatCards(hand.holeCards)}</td>
      <td className="px-4 py-3 text-[#A0A0A0] text-xs">{hand.position}</td>
      <td className="px-4 py-3 text-right text-[#A0A0A0] text-xs">{hand.potAmount?.toLocaleString()}</td>
      <td className={`px-4 py-3 text-right font-medium text-xs ${netGain >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
        {netGain >= 0 ? '+' : ''}{netGain.toLocaleString()}
      </td>
      <td className={`px-4 py-3 text-center text-xs font-semibold ${rc.cls}`}>
        {rc.label}
      </td>
    </tr>
  );
}

function MiniChart({ hands }: { hands: HandHistory[] }) {
  const netGains = hands.slice().reverse().reduce<number[]>((acc, h) => {
    const last = acc[acc.length - 1] ?? 0;
    acc.push(last + (h.netGain ?? 0));
    return acc;
  }, []);

  const min = Math.min(...netGains);
  const max = Math.max(...netGains);
  const range = max - min || 1;
  const W = 100;
  const H = 40;

  const points = netGains.map((v, i) => {
    const x = (i / (netGains.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  const isPositive = netGains[netGains.length - 1] >= 0;
  const color = isPositive ? '#34C759' : '#FF3B30';

  return (
    <div className="mt-4 pt-4 border-t border-[#1E1E1E]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 48 }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function PremiumGate() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-5">
      <div className="w-16 h-16 rounded-2xl bg-[#F2A900]/10 border border-[#F2A900]/20 flex items-center justify-center mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F2A900" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <h2 className="text-white text-lg font-bold mb-2 text-center">
        ハンドヒストリーは Premium のみ
      </h2>
      <p className="text-[#606060] text-sm text-center mb-8 max-w-xs leading-relaxed">
        全ハンドを検索・閲覧できます。<br />
        7日間無料トライアルをお試しください。
      </p>
      <Link href="/settings/subscription">
        <Button size="lg">有料プランを見る</Button>
      </Link>
    </div>
  );
}
