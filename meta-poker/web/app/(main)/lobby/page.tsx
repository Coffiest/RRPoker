'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Tournament } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { LoadingSpinner } from '@/components/UI/LoadingSpinner';

type Tab = 'pending' | 'running' | 'completed';

export default function LobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'tournaments'),
      where('status', '==', tab),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament)));
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#1E1E1E] px-5 pt-5 pb-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-white text-xl font-bold tracking-tight">ロビー</h1>
              <p className="text-[#606060] text-xs mt-0.5">NLH MTT Platform</p>
            </div>
            <Button size="sm" onClick={() => router.push('/tournament/create')}>
              + 作成
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0">
            {(['pending', 'running', 'completed'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setLoading(true); }}
                className={`flex-1 pb-3 text-sm font-medium transition-all duration-150 border-b-2 ${
                  tab === t
                    ? 'text-[#F2A900] border-[#F2A900]'
                    : 'text-[#606060] border-transparent hover:text-[#A0A0A0]'
                }`}
              >
                {t === 'pending' ? '参加受付中' : t === 'running' ? '進行中' : '終了済み'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : tournaments.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} userId={user?.uid ?? ''} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentCard({ tournament: t, userId }: { tournament: Tournament; userId: string }) {
  const router = useRouter();
  const isRegistered = t.registeredPlayerIds?.includes(userId);
  const currentBlind = t.blindLevels?.[t.currentBlindLevel];
  const fillPercent = t.maxPlayers > 0 ? (t.currentPlayers / t.maxPlayers) * 100 : 0;

  return (
    <div
      className="bg-[#141414] border border-[#1E1E1E] rounded-[18px] p-4 cursor-pointer hover:border-[#F2A900]/30 hover:bg-[#161616] transition-all duration-150 active:scale-[0.99]"
      onClick={() => router.push(`/tournament/${t.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-sm truncate">{t.name}</h3>
            <StatusBadge status={t.status} />
            {isRegistered && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#F2A900]/15 text-[#F2A900] font-medium">
                参加中
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-[#606060]">
            {currentBlind && t.status !== 'completed' && (
              <span className="text-[#A0A0A0]">Lv.{t.currentBlindLevel + 1} {currentBlind.smallBlind}/{currentBlind.bigBlind}</span>
            )}
            {t.startAt && (
              <span>{formatTime(t.startAt)}</span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-white font-bold text-sm">{t.startingStack.toLocaleString()}</div>
          <div className="text-[#606060] text-xs">スタック</div>
        </div>
      </div>

      {/* Player fill bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-[#1E1E1E] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F2A900] rounded-full transition-all duration-300"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <span className="text-xs text-[#606060] shrink-0">{t.currentPlayers} / {t.maxPlayers}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Tournament['status'] }) {
  const config = {
    pending:   { cls: 'bg-[#0A84FF]/15 text-[#0A84FF]', label: '受付中' },
    running:   { cls: 'bg-[#34C759]/15 text-[#34C759]', label: '進行中' },
    completed: { cls: 'bg-[#2A2A2A] text-[#606060]',    label: '終了' },
    cancelled: { cls: 'bg-[#FF3B30]/15 text-[#FF3B30]', label: 'キャンセル' },
  };
  const { cls, label } = config[status] ?? config.completed;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const config = {
    pending:   { icon: '🂠', text: 'トーナメントがありません' },
    running:   { icon: '🃏', text: '現在進行中のトーナメントはありません' },
    completed: { icon: '📋', text: '終了したトーナメントはありません' },
  };
  const { icon, text } = config[tab];

  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4 select-none">{icon}</div>
      <p className="text-[#606060] text-sm">{text}</p>
      {tab === 'pending' && (
        <Link href="/tournament/create">
          <Button className="mt-6">トーナメントを作成</Button>
        </Link>
      )}
    </div>
  );
}

function formatTime(ts: Timestamp): string {
  const d = ts.toDate();
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return '開始済み';
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒後`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分後`;
  return d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
