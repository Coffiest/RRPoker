'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/Navigation/BottomNav';
import { PageLoader } from '@/components/UI/LoadingSpinner';

export function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace('/auth/login');
    }
  }, [loading, firebaseUser, router]);

  if (loading) return <PageLoader />;
  if (!firebaseUser) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
