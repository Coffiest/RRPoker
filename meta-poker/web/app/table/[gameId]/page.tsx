'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { GameState, WinnerRecord } from '@/lib/types';
import { playerAction, dealNewHand } from '@/lib/api';
import { PageLoader } from '@/components/UI/LoadingSpinner';
import { Button } from '@/components/UI/Button';
import RangeDisplay from '@/components/Poker/RangeDisplay';
import PokerTable from '@/components/Poker/PokerTable';

export default function TablePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [showRange, setShowRange] = useState(false);
  const [winnerMessage, setWinnerMessage] = useState<WinnerRecord[] | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) {
        const state = { id: snap.id, ...snap.data() } as GameState;
        setGameState(state);
        if (state.winners && state.winners.length > 0) {
          setWinnerMessage(state.winners);
          setTimeout(() => setWinnerMessage(null), 3000);
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [gameId]);

  const myPlayer = gameState?.players.find((p) => p.uid === firebaseUser?.uid);
  const isMyTurn = gameState?.currentPlayerPosition === myPlayer?.position && gameState?.status === 'playing';
  const currentBet = gameState?.currentBet ?? 0;
  const myCurrentBet = myPlayer?.currentBet ?? 0;
  const callAmount = Math.min(currentBet - myCurrentBet, myPlayer?.stack ?? 0);
  const canCheck = currentBet === myCurrentBet;
  const minBet = gameState?.minRaise ?? currentBet * 2;
  const maxBet = myPlayer?.stack ?? 0;
  const isPreflop = gameState?.street === 'preflop';

  useEffect(() => {
    if (isMyTurn) {
      setBetAmount(Math.max(minBet, currentBet * 2));
    }
  }, [isMyTurn, minBet, currentBet]);

  const getToken = useCallback(async () => {
    return (await auth.currentUser?.getIdToken()) ?? '';
  }, []);

  const handleAction = async (action: string, amount = 0) => {
    setActionLoading(true);
    try {
      const token = await getToken();
      await playerAction(gameId, action, amount, token);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDealNew = async () => {
    setActionLoading(true);
    try {
      const token = await getToken();
      await dealNewHand(gameId, token);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!gameState) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#606060]">
      ゲームが見つかりません
    </div>
  );

  const isHandOver = !!gameState.winners;
  const isEliminated = myPlayer?.isEliminated ?? true;
  const isGameEnded = gameState.status === 'ended';

  return (
    <div className="min-h-screen bg-[#071A0A] flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#050F07]/80 border-b border-white/8 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <div className="text-white/80 text-sm font-semibold">Hand #{gameState.handNumber}</div>
          <div className="text-white/30 text-xs">Table {gameState.tableNumber}</div>
        </div>
        <button
          onClick={() => setShowRange((p) => !p)}
          disabled={!isPreflop}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all duration-150
            ${showRange && isPreflop
              ? 'bg-[#F2A900] text-black border-[#F2A900]'
              : 'border-white/15 text-white/50 hover:border-white/30 hover:text-white/80'
            }
            ${!isPreflop ? 'opacity-25 cursor-not-allowed' : ''}`}
        >
          レンジ
        </button>
      </div>

      {/* Poker Table */}
      <div className="flex-1 relative">
        <PokerTable
          gameState={gameState}
          myUid={firebaseUser?.uid ?? ''}
        />

        {/* Winner Overlay */}
        {winnerMessage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="bg-[#0A0A0A]/90 backdrop-blur-xl rounded-2xl px-8 py-6 text-center border border-[#F2A900]/40 shadow-[0_0_40px_rgba(242,169,0,0.15)]">
              {winnerMessage.map((w) => {
                const winner = gameState.players.find((p) => p.uid === w.playerId);
                return (
                  <div key={w.playerId}>
                    <div className="text-[#F2A900] text-xl font-bold">{winner?.username ?? w.playerId}</div>
                    <div className="text-white text-2xl font-bold mt-1">+{w.amount.toLocaleString()}</div>
                    {w.handName !== 'Uncontested' && (
                      <div className="text-[#A0A0A0] text-sm mt-1">{w.handName}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Range Display Overlay */}
        {showRange && isPreflop && myPlayer && (
          <div className="absolute inset-0 bg-black/85 flex items-end z-20 backdrop-blur-sm">
            <div className="w-full">
              <RangeDisplay
                position={getPositionName(myPlayer.position, gameState.players.length)}
                currentBet={gameState.currentBet}
                bigBlind={gameState.currentBet || 50}
                stack={myPlayer.stack}
                onClose={() => setShowRange(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Area */}
      <div className="bg-[#050F07]/90 border-t border-white/8 px-4 pt-3 pb-safe-6 backdrop-blur-xl">
        {isGameEnded ? (
          <div className="text-center py-2">
            <p className="text-white/50 text-sm mb-4">ゲーム終了</p>
            <Button onClick={() => router.push(`/tournament/${gameState.tournamentId}`)}>
              トーナメントへ戻る
            </Button>
          </div>
        ) : isEliminated ? (
          <div className="text-center text-white/30 text-sm py-3">
            敗退済み — 観戦中
          </div>
        ) : isHandOver ? (
          <div className="flex justify-center py-1">
            <Button onClick={handleDealNew} loading={actionLoading} size="lg">
              次のハンドへ
            </Button>
          </div>
        ) : isMyTurn ? (
          <div className="flex flex-col gap-2.5">
            {/* Bet Slider */}
            {!canCheck && (
              <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-2.5">
                <span className="text-white/40 text-xs shrink-0">Raise to</span>
                <input
                  type="range"
                  min={minBet}
                  max={maxBet}
                  step={gameState.currentBet || 50}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="flex-1 accent-[#F2A900]"
                />
                <span className="text-white font-mono text-sm shrink-0 w-16 text-right">
                  {betAmount.toLocaleString()}
                </span>
              </div>
            )}

            {/* Quick pot bet buttons */}
            {!canCheck && (
              <div className="flex gap-1.5">
                {[0.33, 0.5, 0.75, 1].map((mult) => {
                  const pot = gameState.pot;
                  const amount = Math.min(
                    Math.round((pot * mult) / (gameState.currentBet || 50)) * (gameState.currentBet || 50),
                    maxBet
                  );
                  return (
                    <button
                      key={mult}
                      onClick={() => setBetAmount(Math.max(minBet, amount))}
                      className="flex-1 py-1.5 rounded-xl bg-white/8 text-white/50 text-xs hover:bg-white/15 hover:text-white/80 transition-colors font-medium"
                    >
                      {mult === 1 ? 'Pot' : `${Math.round(mult * 100)}%`}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="lg"
                onClick={() => handleAction('fold')}
                loading={actionLoading}
                className="flex-1"
              >
                Fold
              </Button>

              {canCheck ? (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleAction('check')}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Check
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleAction('call', callAmount)}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Call {callAmount.toLocaleString()}
                </Button>
              )}

              {maxBet > 0 && (
                <>
                  {currentBet === 0 ? (
                    <Button
                      size="lg"
                      onClick={() => handleAction('bet', betAmount)}
                      loading={actionLoading}
                      className="flex-1"
                    >
                      Bet
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => handleAction('raise', betAmount)}
                      loading={actionLoading}
                      className="flex-1"
                    >
                      Raise
                    </Button>
                  )}
                  <Button
                    size="lg"
                    onClick={() => handleAction('allin', maxBet)}
                    loading={actionLoading}
                    variant="outline"
                  >
                    All-in
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-white/30 text-sm py-3">
            {gameState.currentPlayerPosition !== null
              ? `${gameState.players[gameState.currentPlayerPosition]?.username ?? '...'}のターン`
              : '待機中...'}
          </div>
        )}
      </div>
    </div>
  );
}

function getPositionName(seatIndex: number, totalPlayers: number): string {
  if (totalPlayers === 2) return seatIndex === 0 ? 'BTN' : 'BB';
  const positions = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO'];
  return positions[seatIndex % positions.length] ?? 'UTG';
}
