'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch {
      setError('メールの送信に失敗しました。メールアドレスを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5">
        <div className="fixed inset-0 bg-gradient-to-br from-[#0F3D1A]/20 via-transparent to-[#F2A900]/5 pointer-events-none" />
        <div className="relative w-full max-w-[380px] text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#34C759]/15 border border-[#34C759]/20 mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">メールを送信しました</h2>
          <p className="text-[#606060] text-sm mb-8 leading-relaxed">
            {email} にパスワードリセット用のリンクを送りました。
          </p>
          <Link href="/auth/login">
            <Button size="lg" className="w-full">ログインに戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0F3D1A]/20 via-transparent to-[#F2A900]/5 pointer-events-none" />

      <div className="relative w-full max-w-[380px] animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F2A900] mb-5 shadow-[0_4px_20px_rgba(242,169,0,0.4)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">パスワードリセット</h1>
          <p className="text-[#606060] text-sm mt-1">リセット用リンクをメールで送ります</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            label="メールアドレス"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          {error && (
            <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl px-4 py-2.5 text-sm text-[#FF3B30]">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
            送信する
          </Button>
        </form>

        <p className="text-center text-[#606060] text-sm mt-6">
          <Link href="/auth/login" className="text-[#F2A900] hover:underline font-medium">
            ← ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
