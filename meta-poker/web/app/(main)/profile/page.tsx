'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { UserStats } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { Card } from '@/components/UI/Card';

export default function ProfilePage() {
  const { user, firebaseUser, subscription, isPremium } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isPublicStats, setIsPublicStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setUsername(user.username);
    setBio(user.bio);
    setIsPublicStats(user.isPublicStats);

    getDoc(doc(db, 'userStats', user.uid)).then((snap) => {
      if (snap.exists()) setStats(snap.data() as UserStats);
    });
  }, [user]);

  const handleSave = async () => {
    if (!firebaseUser || !user) return;
    setError('');
    setSaving(true);
    try {
      await Promise.all([
        updateDoc(doc(db, 'users', user.uid), {
          username,
          bio,
          isPublicStats,
          updatedAt: serverTimestamp(),
        }),
        updateProfile(firebaseUser, { displayName: username }),
      ]);
      setEditing(false);
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser || !user) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await Promise.all([
        updateDoc(doc(db, 'users', user.uid), { profileImageUrl: url, updatedAt: serverTimestamp() }),
        updateProfile(firebaseUser, { photoURL: url }),
      ]);
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  const itmRate = stats ? Math.round(stats.itmPercentage * 10) / 10 : 0;
  const roi = stats ? Math.round(stats.totalRoi * 10) / 10 : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#1E1E1E] px-5 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-white text-lg font-bold">プロフィール</h1>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>編集</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setError(''); }}>キャンセル</Button>
              <Button size="sm" onClick={handleSave} loading={saving}>保存</Button>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-5 max-w-2xl mx-auto flex flex-col gap-3">
        {/* Avatar + Identity */}
        <Card>
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#1C1C1C] border border-[#2A2A2A] group-hover:border-[#F2A900]/50 transition-colors">
                {user.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profileImageUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#606060]">
                    {user.username[0]?.toUpperCase()}
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#F2A900] rounded-full flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <div className="flex-1 min-w-0">
              <div className="text-white text-base font-bold">{user.username}</div>
              <div className="text-[#606060] text-xs mt-0.5 truncate">{user.email}</div>
              <div className="mt-2">
                {isPremium ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#F2A900]/15 text-[#F2A900] font-medium">Premium</span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#1C1C1C] text-[#606060]">Free</span>
                )}
              </div>
            </div>
          </div>

          {user.bio && !editing && (
            <p className="text-[#A0A0A0] text-sm mt-3 pt-3 border-t border-[#1E1E1E]">{user.bio}</p>
          )}
        </Card>

        {/* Edit Form */}
        {editing && (
          <Card>
            <div className="flex flex-col gap-3">
              <Input
                label="ユーザー名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <div>
                <label className="text-xs font-medium text-[#A0A0A0] tracking-wide uppercase block mb-1.5">自己紹介</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] text-white placeholder:text-[#606060] focus:outline-none focus:border-[#F2A900] transition-all resize-none text-sm"
                  placeholder="自己紹介を入力..."
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    isPublicStats ? 'bg-[#F2A900] border-[#F2A900]' : 'bg-[#1C1C1C] border-[#2A2A2A]'
                  }`}
                  onClick={() => setIsPublicStats(!isPublicStats)}
                >
                  {isPublicStats && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-[#A0A0A0] text-sm">戦績を公開する</span>
              </label>
              {error && (
                <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl px-4 py-2.5 text-sm text-[#FF3B30]">
                  {error}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Stats */}
        <Card>
          <h2 className="text-white font-semibold text-sm mb-3">スタッツ</h2>
          {stats ? (
            <div className="grid grid-cols-2 gap-2">
              <StatItem label="総ハンド数" value={stats.totalHands.toLocaleString()} />
              <StatItem label="参加大会" value={stats.totalTournaments.toLocaleString()} />
              <StatItem label="インマネ率" value={`${itmRate}%`} />
              <StatItem label="ROI" value={`${roi >= 0 ? '+' : ''}${roi}%`} color={roi >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'} />
              <StatItem label="総獲得チップ" value={stats.totalPrize.toLocaleString()} />
            </div>
          ) : (
            <p className="text-[#606060] text-sm">まだデータがありません。トーナメントに参加しましょう！</p>
          )}
        </Card>

        {/* Subscription */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-sm">プラン</h2>
              <p className="text-[#606060] text-xs mt-1">
                {isPremium ? (
                  <>Premium · {subscription?.currentPeriodEnd?.toDate().toLocaleDateString('ja-JP')} まで有効</>
                ) : (
                  <>Free プラン · ハンド履歴は Premium のみ</>
                )}
              </p>
            </div>
            {!isPremium && (
              <Button size="sm" onClick={() => window.location.href = '/settings/subscription'}>
                アップグレード
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#1C1C1C] rounded-xl p-3">
      <div className={`text-base font-bold ${color ?? 'text-white'}`}>{value}</div>
      <div className="text-[#606060] text-xs mt-0.5">{label}</div>
    </div>
  );
}
