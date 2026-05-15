'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Tournament, BlindLevel } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { Card } from '@/components/UI/Card';
import { PageLoader } from '@/components/UI/LoadingSpinner';

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser, user } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournaments', id), (snap) => {
      if (snap.exists()) setTournament({ id: snap.id, ...snap.data() } as Tournament);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const isCreator = tournament?.creatorId === firebaseUser?.uid;
  const isRegistered = tournament?.registeredPlayerIds?.includes(firebaseUser?.uid ?? '');
  const isFull = (tournament?.currentPlayers ?? 0) >= (tournament?.maxPlayers ?? 0);
  const canStart = isCreator && tournament?.status === 'pending' && (tournament?.currentPlayers ?? 0) >= 2;

  const handleJoin = async () => {
    if (!firebaseUser || !tournament) return;
    setJoining(true);
    try {
      await updateDoc(doc(db, 'tournaments', id), {
        registeredPlayerIds: arrayUnion(firebaseUser.uid),
        currentPlayers: increment(1),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!firebaseUser || !tournament) return;
    setJoining(true);
    try {
      await updateDoc(doc(db, 'tournaments', id), {
        registeredPlayerIds: arrayRemove(firebaseUser.uid),
        currentPlayers: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setJoining(false);
    }
  };

  const handleStartTournament = async () => {
    if (!tournament) return;
    setStarting(true);
    try {
      const response = await fetch('/api/tournament/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id }),
      });
      if (!response.ok) throw new Error('Start failed');
      const { gameId } = await response.json();
      router.push(`/table/${gameId}`);
    } catch {
      alert('トーナメントの開始に失敗しました');
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!tournament) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#606060]">
      トーナメントが見つかりません
    </div>
  );

  const fillPercent = tournament.maxPlayers > 0 ? (tournament.currentPlayers / tournament.maxPlayers) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#1E1E1E] px-5 py-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#606060] hover:text-white hover:bg-[#1C1C1C] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold truncate">{tournament.name}</h1>
          </div>
          <StatusBadge status={tournament.status} />
        </div>
      </div>

      <div className="px-5 py-4 max-w-2xl mx-auto flex flex-col gap-3">
        {/* Overview */}
        <Card>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <StatItem label="参加者" value={`${tournament.currentPlayers} / ${tournament.maxPlayers}`} />
            <StatItem label="スタック" value={tournament.startingStack.toLocaleString()} />
            <StatItem label="テーブル数" value={String(Math.ceil(tournament.currentPlayers / 9) || '—')} />
          </div>
          {/* Fill bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-[#1E1E1E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F2A900] rounded-full transition-all duration-300"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
            <span className="text-xs text-[#606060] shrink-0">{Math.round(fillPercent)}%</span>
          </div>
        </Card>

        {/* Current Blind Level (running) */}
        {tournament.status === 'running' && tournament.blindLevels[tournament.currentBlindLevel] && (
          <BlindLevelCard
            level={tournament.blindLevels[tournament.currentBlindLevel]}
            levelIndex={tournament.currentBlindLevel}
            nextLevel={tournament.blindLevels[tournament.currentBlindLevel + 1]}
            nextBlindAt={tournament.nextBlindAt}
          />
        )}

        {/* Blind Structure */}
        <Card>
          <h2 className="text-white font-semibold text-sm mb-3">ブラインド構造</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#606060] border-b border-[#1E1E1E]">
                  <th className="text-left pb-2 font-normal">Lv</th>
                  <th className="text-right pb-2 font-normal">SB</th>
                  <th className="text-right pb-2 font-normal">BB</th>
                  <th className="text-right pb-2 font-normal">Ante</th>
                  <th className="text-right pb-2 font-normal">時間</th>
                </tr>
              </thead>
              <tbody>
                {tournament.blindLevels.map((lv, i) => {
                  const isCurrent = i === tournament.currentBlindLevel && tournament.status === 'running';
                  return (
                    <tr
                      key={i}
                      className={`border-b border-[#1A1A1A] ${isCurrent ? 'text-[#F2A900]' : 'text-[#A0A0A0]'}`}
                    >
                      <td className="py-1.5">{i + 1}{isCurrent && ' ←'}</td>
                      <td className="text-right">{lv.smallBlind.toLocaleString()}</td>
                      <td className="text-right">{lv.bigBlind.toLocaleString()}</td>
                      <td className="text-right">{lv.ante > 0 ? lv.ante.toLocaleString() : '—'}</td>
                      <td className="text-right">{lv.durationMinutes}分</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Prize */}
        <Card>
          <h2 className="text-white font-semibold text-sm mb-3">賞金配分</h2>
          <div className="flex flex-col gap-2">
            {tournament.prizeDistribution.map((p) => {
              const emojis = ['🥇', '🥈', '🥉'];
              return (
                <div key={p.place} className="flex items-center justify-between">
                  <span className="text-[#A0A0A0] text-sm">
                    {emojis[p.place - 1]} {p.place}位
                  </span>
                  <span className="text-white font-semibold">{p.percentage}%</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Actions */}
        {tournament.status === 'pending' && (
          <div className="flex flex-col gap-2.5">
            {!isRegistered ? (
              <Button size="lg" onClick={handleJoin} loading={joining} disabled={isFull} className="w-full">
                {isFull ? '満員です' : '参加する'}
              </Button>
            ) : (
              <>
                {canStart && (
                  <Button size="lg" onClick={handleStartTournament} loading={starting} className="w-full">
                    トーナメントを開始
                  </Button>
                )}
                <Button variant="secondary" size="lg" onClick={handleLeave} loading={joining} className="w-full">
                  参加をキャンセル
                </Button>
              </>
            )}
          </div>
        )}

        {tournament.status === 'running' && isRegistered && (
          <Button size="lg" onClick={() => router.push(`/table/${tournament.tableIds[0]}`)} className="w-full">
            テーブルへ戻る
          </Button>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white font-bold text-lg">{value}</div>
      <div className="text-[#606060] text-xs mt-0.5">{label}</div>
    </div>
  );
}

function BlindLevelCard({ level, levelIndex, nextLevel, nextBlindAt }: {
  level: BlindLevel;
  levelIndex: number;
  nextLevel?: BlindLevel;
  nextBlindAt: Tournament['nextBlindAt'];
}) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!nextBlindAt) return;
    const update = () => {
      const diff = nextBlindAt.toMillis() - Date.now();
      if (diff <= 0) { setTimeLeft('00:00'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [nextBlindAt]);

  return (
    <div className="bg-[#F2A900]/8 border border-[#F2A900]/25 rounded-[20px] p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#F2A900] text-xs font-semibold mb-1.5 tracking-wide uppercase">
            Lv.{levelIndex + 1} 現在のブラインド
          </div>
          <div className="text-white text-2xl font-bold">
            {level.smallBlind.toLocaleString()} / {level.bigBlind.toLocaleString()}
          </div>
          {level.ante > 0 && (
            <div className="text-[#A0A0A0] text-sm mt-0.5">Ante: {level.ante.toLocaleString()}</div>
          )}
        </div>
        {timeLeft && (
          <div className="text-right">
            <div className="text-[#606060] text-xs mb-1">次のレベルまで</div>
            <div className="text-white text-2xl font-mono font-bold">{timeLeft}</div>
            {nextLevel && (
              <div className="text-[#606060] text-xs mt-0.5">
                次: {nextLevel.smallBlind}/{nextLevel.bigBlind}
              </div>
            )}
          </div>
        )}
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
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cls}`}>{label}</span>
  );
}
