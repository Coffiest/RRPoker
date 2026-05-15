'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { BlindLevel } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { Card } from '@/components/UI/Card';

const BLIND_TEMPLATES = {
  turbo: {
    name: 'ターボ',
    description: '各レベル8分',
    levels: [
      { level: 0, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 8 },
      { level: 1, smallBlind: 50, bigBlind: 100, ante: 100, durationMinutes: 8 },
      { level: 2, smallBlind: 75, bigBlind: 150, ante: 150, durationMinutes: 8 },
      { level: 3, smallBlind: 100, bigBlind: 200, ante: 200, durationMinutes: 8 },
      { level: 4, smallBlind: 150, bigBlind: 300, ante: 300, durationMinutes: 8 },
      { level: 5, smallBlind: 200, bigBlind: 400, ante: 400, durationMinutes: 8 },
      { level: 6, smallBlind: 300, bigBlind: 600, ante: 600, durationMinutes: 8 },
      { level: 7, smallBlind: 400, bigBlind: 800, ante: 800, durationMinutes: 8 },
      { level: 8, smallBlind: 600, bigBlind: 1200, ante: 1200, durationMinutes: 8 },
      { level: 9, smallBlind: 800, bigBlind: 1600, ante: 1600, durationMinutes: 8 },
    ] as BlindLevel[],
  },
  standard: {
    name: 'スタンダード',
    description: '各レベル15分',
    levels: [
      { level: 0, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 15 },
      { level: 1, smallBlind: 50, bigBlind: 100, ante: 100, durationMinutes: 15 },
      { level: 2, smallBlind: 75, bigBlind: 150, ante: 150, durationMinutes: 15 },
      { level: 3, smallBlind: 100, bigBlind: 200, ante: 200, durationMinutes: 15 },
      { level: 4, smallBlind: 150, bigBlind: 300, ante: 300, durationMinutes: 15 },
      { level: 5, smallBlind: 200, bigBlind: 400, ante: 400, durationMinutes: 15 },
      { level: 6, smallBlind: 300, bigBlind: 600, ante: 600, durationMinutes: 15 },
      { level: 7, smallBlind: 400, bigBlind: 800, ante: 800, durationMinutes: 15 },
      { level: 8, smallBlind: 600, bigBlind: 1200, ante: 1200, durationMinutes: 15 },
      { level: 9, smallBlind: 800, bigBlind: 1600, ante: 1600, durationMinutes: 15 },
      { level: 10, smallBlind: 1000, bigBlind: 2000, ante: 2000, durationMinutes: 15 },
      { level: 11, smallBlind: 1500, bigBlind: 3000, ante: 3000, durationMinutes: 15 },
    ] as BlindLevel[],
  },
  deepstack: {
    name: 'ディープスタック',
    description: '各レベル20分・深いスタック',
    levels: [
      { level: 0, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
      { level: 1, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 20 },
      { level: 2, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 20 },
      { level: 3, smallBlind: 100, bigBlind: 200, ante: 200, durationMinutes: 20 },
      { level: 4, smallBlind: 150, bigBlind: 300, ante: 300, durationMinutes: 20 },
      { level: 5, smallBlind: 200, bigBlind: 400, ante: 400, durationMinutes: 20 },
      { level: 6, smallBlind: 250, bigBlind: 500, ante: 500, durationMinutes: 20 },
      { level: 7, smallBlind: 300, bigBlind: 600, ante: 600, durationMinutes: 20 },
      { level: 8, smallBlind: 400, bigBlind: 800, ante: 800, durationMinutes: 20 },
      { level: 9, smallBlind: 500, bigBlind: 1000, ante: 1000, durationMinutes: 20 },
      { level: 10, smallBlind: 600, bigBlind: 1200, ante: 1200, durationMinutes: 20 },
      { level: 11, smallBlind: 800, bigBlind: 1600, ante: 1600, durationMinutes: 20 },
      { level: 12, smallBlind: 1000, bigBlind: 2000, ante: 2000, durationMinutes: 20 },
    ] as BlindLevel[],
  },
};

type TemplateKey = keyof typeof BLIND_TEMPLATES;

const selectClass = "w-full px-4 py-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] text-white focus:outline-none focus:border-[#F2A900] transition-colors text-sm";

export default function CreateTournamentPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(9);
  const [startingStack, setStartingStack] = useState(10000);
  const [template, setTemplate] = useState<TemplateKey>('standard');
  const [prize1, setPrize1] = useState(50);
  const [prize2, setPrize2] = useState(30);
  const [prize3, setPrize3] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalPrize = prize1 + prize2 + prize3;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPrize !== 100) {
      setError('賞金配分の合計は100%にしてください');
      return;
    }
    if (!name.trim()) {
      setError('トーナメント名を入力してください');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const selectedTemplate = BLIND_TEMPLATES[template];
      const now = serverTimestamp();
      const ref = await addDoc(collection(db, 'tournaments'), {
        creatorId: firebaseUser!.uid,
        name: name.trim(),
        status: 'pending',
        maxPlayers,
        currentPlayers: 0,
        startingStack,
        blindStructureId: template,
        blindLevels: selectedTemplate.levels,
        currentBlindLevel: 0,
        nextBlindAt: null,
        prizeDistribution: [
          { place: 1, percentage: prize1 },
          { place: 2, percentage: prize2 },
          { place: 3, percentage: prize3 },
        ],
        registeredPlayerIds: [],
        eliminatedPlayerIds: [],
        winnerId: null,
        startAt: null,
        endAt: null,
        tableIds: [],
        createdAt: now,
        updatedAt: now,
      });
      router.push(`/tournament/${ref.id}`);
    } catch {
      setError('作成に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-white text-lg font-bold">トーナメント作成</h1>
        </div>
      </div>

      <form onSubmit={handleCreate} className="px-5 py-5 max-w-2xl mx-auto flex flex-col gap-4">
        {/* Basic Info */}
        <Card>
          <h2 className="text-white font-semibold text-sm mb-4">基本情報</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="トーナメント名"
              placeholder="例: 金曜夜のホームゲーム"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-[#A0A0A0] tracking-wide uppercase block mb-1.5">最大参加人数</label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className={selectClass}
                >
                  {[6, 9, 18, 27, 36, 45, 54, 63, 72, 81, 90].map((n) => (
                    <option key={n} value={n} className="bg-[#1C1C1C]">{n} 人</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-[#A0A0A0] tracking-wide uppercase block mb-1.5">スタートチップ</label>
                <select
                  value={startingStack}
                  onChange={(e) => setStartingStack(Number(e.target.value))}
                  className={selectClass}
                >
                  {[5000, 10000, 15000, 20000, 30000, 50000].map((n) => (
                    <option key={n} value={n} className="bg-[#1C1C1C]">{n.toLocaleString()}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Blind Structure */}
        <Card>
          <h2 className="text-white font-semibold text-sm mb-4">ブラインド構造</h2>
          <div className="flex flex-col gap-2">
            {(Object.keys(BLIND_TEMPLATES) as TemplateKey[]).map((key) => {
              const t = BLIND_TEMPLATES[key];
              const selected = template === key;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150
                    ${selected ? 'border-[#F2A900]/50 bg-[#F2A900]/8' : 'border-[#2A2A2A] hover:border-[#383838]'}`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={key}
                    checked={selected}
                    onChange={() => setTemplate(key)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'border-[#F2A900]' : 'border-[#383838]'
                  }`}>
                    {selected && <div className="w-2 h-2 rounded-full bg-[#F2A900]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm">{t.name}</div>
                    <div className="text-[#606060] text-xs mt-0.5">{t.description} · {t.levels.length}レベル</div>
                    <div className="text-[#606060] text-xs mt-0.5">
                      {t.levels[0].smallBlind}/{t.levels[0].bigBlind} → {t.levels[t.levels.length - 1].smallBlind}/{t.levels[t.levels.length - 1].bigBlind}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>

        {/* Prize Distribution */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">賞金配分</h2>
            <span className={`text-sm font-mono font-bold ${totalPrize === 100 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
              {totalPrize}%
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { label: '1位', emoji: '🥇', value: prize1, setter: setPrize1 },
              { label: '2位', emoji: '🥈', value: prize2, setter: setPrize2 },
              { label: '3位', emoji: '🥉', value: prize3, setter: setPrize3 },
            ].map(({ label, emoji, value, setter }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-base w-7 select-none">{emoji}</span>
                <span className="text-[#A0A0A0] text-xs w-8">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="flex-1 accent-[#F2A900]"
                />
                <span className="text-white text-sm font-mono w-10 text-right">{value}%</span>
              </div>
            ))}
          </div>
        </Card>

        {error && (
          <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl px-4 py-2.5 text-sm text-[#FF3B30]">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          トーナメントを作成
        </Button>
      </form>
    </div>
  );
}
