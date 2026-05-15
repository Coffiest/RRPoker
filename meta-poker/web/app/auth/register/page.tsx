'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';

type Step = 'email' | 'username';

export default function RegisterPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください');
      return;
    }
    setStep('username');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError('利用規約に同意してください');
      return;
    }
    if (username.length < 3 || username.length > 20) {
      setError('ユーザー名は3〜20文字で設定してください');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('ユーザー名は英数字とアンダースコアのみ使用できます');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUpWithEmail(email, password, username);
      router.push('/lobby');
    } catch (err: unknown) {
      const msg = (err as { code?: string }).code;
      if (msg === 'auth/email-already-in-use') setError('このメールアドレスはすでに使用されています');
      else setError('登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push('/lobby');
    } catch {
      setError('Googleログインに失敗しました');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0F3D1A]/20 via-transparent to-[#F2A900]/5 pointer-events-none" />

      <div className="relative w-full max-w-[380px] animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F2A900] mb-5 shadow-[0_4px_20px_rgba(242,169,0,0.4)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="black">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">アカウント作成</h1>
          <p className="text-[#606060] text-sm mt-1">
            {step === 'email' ? 'Meta Poker へようこそ' : 'プロフィールを設定'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-2 h-2 rounded-full bg-[#F2A900]" />
          <div className={`w-2 h-2 rounded-full transition-colors ${step === 'username' ? 'bg-[#F2A900]' : 'bg-[#2A2A2A]'}`} />
        </div>

        {step === 'email' && (
          <>
            {/* Google */}
            <button
              onClick={handleGoogleRegister}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-white text-[#1A1A1A] font-medium text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 active:scale-[0.98] disabled:opacity-60 mb-4"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Googleで登録
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#2A2A2A]" />
              <span className="text-[#606060] text-xs">または</span>
              <div className="flex-1 h-px bg-[#2A2A2A]" />
            </div>

            <form onSubmit={validateEmail} className="flex flex-col gap-3">
              <Input
                type="email"
                label="メールアドレス"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                type="password"
                label="パスワード"
                placeholder="8文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                hint="8文字以上で設定してください"
              />
              <Input
                type="password"
                label="パスワード（確認）"
                placeholder="もう一度入力"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />

              {error && (
                <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl px-4 py-2.5 text-sm text-[#FF3B30]">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" className="w-full mt-1">
                次へ →
              </Button>
            </form>
          </>
        )}

        {step === 'username' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <Input
              type="text"
              label="ユーザー名"
              placeholder="poker_master"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              hint="英数字・アンダースコアのみ、3〜20文字"
            />

            <label className="flex items-start gap-3 cursor-pointer mt-1">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  agreed ? 'bg-[#F2A900] border-[#F2A900]' : 'bg-[#1C1C1C] border-[#2A2A2A]'
                }`}>
                  {agreed && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[#A0A0A0] text-sm leading-relaxed">
                <Link href="/terms" className="text-[#F2A900] hover:underline">利用規約</Link>
                および
                <Link href="/privacy" className="text-[#F2A900] hover:underline">プライバシーポリシー</Link>
                に同意します
              </span>
            </label>

            {error && (
              <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl px-4 py-2.5 text-sm text-[#FF3B30]">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
              登録する
            </Button>

            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); }}
              className="text-[#606060] text-sm text-center hover:text-[#A0A0A0] transition-colors"
            >
              ← 戻る
            </button>
          </form>
        )}

        <p className="text-center text-[#606060] text-sm mt-6">
          すでにアカウントをお持ちの方{' '}
          <Link href="/auth/login" className="text-[#F2A900] hover:underline font-medium">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
