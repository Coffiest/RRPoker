'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/UI/Button';
import { Card } from '@/components/UI/Card';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, subscription, isPremium } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#1E1E1E] px-5 py-4">
        <h1 className="text-white text-lg font-bold max-w-2xl mx-auto">設定</h1>
      </div>

      <div className="px-5 py-5 max-w-2xl mx-auto flex flex-col gap-3">
        {/* Account */}
        <Card>
          <h2 className="text-[#606060] text-xs font-semibold tracking-widest uppercase mb-3">アカウント</h2>
          <div className="flex flex-col">
            <SettingsRow label="メールアドレス" value={user?.email ?? ''} />
            <SettingsRow label="ユーザー名" value={user?.username ?? ''} />
          </div>
        </Card>

        {/* Subscription */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[#606060] text-xs font-semibold tracking-widest uppercase">サブスクリプション</h2>
            {isPremium ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#F2A900]/15 text-[#F2A900] font-medium">Premium</span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#1C1C1C] text-[#606060]">Free</span>
            )}
          </div>
          {isPremium ? (
            <div className="flex flex-col gap-1">
              <SettingsRow label="ステータス" value="有効" />
              {subscription?.currentPeriodEnd && (
                <SettingsRow
                  label="次回更新"
                  value={subscription.currentPeriodEnd.toDate().toLocaleDateString('ja-JP')}
                />
              )}
              <Link href="/settings/subscription">
                <button className="text-sm text-[#F2A900] hover:text-[#C88A00] transition-colors mt-2">
                  プラン管理 →
                </button>
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-[#606060] text-sm mb-3">
                ハンドヒストリー・詳細統計機能が使えます。<br />
                7日間無料トライアルあり。
              </p>
              <Link href="/settings/subscription">
                <Button size="sm">有料プランを見る</Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Display */}
        <Card>
          <h2 className="text-[#606060] text-xs font-semibold tracking-widest uppercase mb-3">表示</h2>
          <div className="flex items-center justify-between">
            <span className="text-[#A0A0A0] text-sm">ダークモード</span>
            <button
              onClick={toggleTheme}
              className={`relative w-11 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-[#F2A900]' : 'bg-[#2A2A2A]'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </Card>

        {/* Links */}
        <Card>
          <h2 className="text-[#606060] text-xs font-semibold tracking-widest uppercase mb-3">その他</h2>
          <div className="flex flex-col">
            <LinkRow href="/terms" label="利用規約" />
            <LinkRow href="/privacy" label="プライバシーポリシー" />
          </div>
        </Card>

        {/* Logout */}
        <Button variant="danger" size="lg" onClick={handleLogout} className="w-full">
          ログアウト
        </Button>

        <p className="text-center text-[#2A2A2A] text-xs pb-2">Meta Poker v1.0.0</p>
      </div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#1A1A1A] last:border-0">
      <span className="text-[#606060] text-sm">{label}</span>
      <span className="text-white text-sm">{value}</span>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-2.5 border-b border-[#1A1A1A] last:border-0 text-[#A0A0A0] hover:text-white transition-colors"
    >
      <span className="text-sm">{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
