'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { createCheckoutSession } from '@/lib/api';
import { Button } from '@/components/UI/Button';
import { Card } from '@/components/UI/Card';

export default function SubscriptionPage() {
  const router = useRouter();
  const { isPremium, subscription } = useAuth();
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    setLoading(plan);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const priceId = plan === 'monthly'
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? ''
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ?? '';

      const origin = window.location.origin;
      const data = await createCheckoutSession(
        priceId,
        `${origin}/settings/subscription?success=true`,
        `${origin}/settings/subscription?cancelled=true`,
        token
      );

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      alert('決済の開始に失敗しました。');
    } finally {
      setLoading(null);
    }
  };

  const BackHeader = ({ title }: { title: string }) => (
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
        <h1 className="text-white text-lg font-bold">{title}</h1>
      </div>
    </div>
  );

  if (isPremium) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <BackHeader title="プラン管理" />
        <div className="px-5 py-5 max-w-2xl mx-auto flex flex-col gap-3">
          <div className="bg-[#F2A900]/8 border border-[#F2A900]/25 rounded-[20px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F2A900] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                  <path d="M12 1L15.09 8.26L23 9.27L17.5 14.14L19.18 22L12 18.77L4.82 22L6.5 14.14L1 9.27L8.91 8.26L12 1Z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold">Premium プラン</h2>
                <p className="text-[#F2A900] text-xs">ご利用中</p>
              </div>
            </div>
            {subscription?.currentPeriodEnd && (
              <p className="text-[#A0A0A0] text-sm">
                次回更新日: {subscription.currentPeriodEnd.toDate().toLocaleDateString('ja-JP')}
              </p>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <p className="text-[#F2A900] text-sm mt-2">
                期間終了後にキャンセルされます
              </p>
            )}
          </div>
          <Card>
            <h2 className="text-white font-semibold text-sm mb-3">Premium 特典</h2>
            <PremiumFeatures />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <BackHeader title="プランを選択" />

      <div className="px-5 py-5 max-w-2xl mx-auto flex flex-col gap-3">
        {/* Trial banner */}
        <div className="bg-[#F2A900]/8 border border-[#F2A900]/20 rounded-[18px] px-4 py-3.5 text-center">
          <p className="text-[#F2A900] font-semibold text-sm">7日間無料トライアル</p>
          <p className="text-[#606060] text-xs mt-1">カード登録で今すぐ全機能が使えます</p>
        </div>

        {/* Plans */}
        <div className="flex flex-col gap-2.5">
          {/* Monthly */}
          <Card>
            <h3 className="text-white font-bold text-base mb-1">月額プラン</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">¥980</span>
              <span className="text-[#606060] text-sm">/ 月</span>
            </div>
            <PremiumFeatures compact />
            <Button
              size="lg"
              variant="secondary"
              onClick={() => handleSubscribe('monthly')}
              loading={loading === 'monthly'}
              className="w-full mt-4"
            >
              月額プランで始める
            </Button>
          </Card>

          {/* Yearly — recommended */}
          <div className="relative">
            <div className="absolute -top-2.5 left-4 z-10 bg-[#F2A900] text-black text-xs font-bold px-3 py-0.5 rounded-full">
              おすすめ・約16%OFF
            </div>
            <Card glow>
              <h3 className="text-white font-bold text-base mb-1 mt-1">年間プラン</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-white">¥9,800</span>
                <span className="text-[#606060] text-sm">/ 年</span>
                <span className="text-[#606060] text-xs ml-1">（月々816円）</span>
              </div>
              <PremiumFeatures compact />
              <Button
                size="lg"
                onClick={() => handleSubscribe('yearly')}
                loading={loading === 'yearly'}
                className="w-full mt-4"
              >
                年間プランで始める
              </Button>
            </Card>
          </div>
        </div>

        <div className="text-center">
          <button onClick={() => router.back()} className="text-[#606060] text-sm hover:text-[#A0A0A0] transition-colors">
            今はFreeプランで続ける
          </button>
        </div>

        <p className="text-[#383838] text-xs text-center">
          いつでもキャンセル可能。クレジットカード決済（Stripe）。
        </p>
      </div>
    </div>
  );
}

function PremiumFeatures({ compact = false }: { compact?: boolean }) {
  const features = [
    'ハンドヒストリー閲覧・検索',
    '詳細フィルター・ソート',
    '収支グラフ・スタッツ',
    'トーナメント参加（無制限）',
    'プリフロップレンジ表示',
  ];

  return (
    <ul className="flex flex-col gap-1.5">
      {features.map((f) => (
        <li key={f} className={`flex items-center gap-2 text-[#A0A0A0] ${compact ? 'text-xs' : 'text-sm'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F2A900" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {f}
        </li>
      ))}
    </ul>
  );
}
