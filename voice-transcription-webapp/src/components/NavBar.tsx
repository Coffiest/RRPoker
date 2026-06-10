'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { Mic, History, LogOut } from 'lucide-react';

export function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const handleSignOut = () => signOut(auth);

  const navLink = (href: string, label: string, Icon: React.ElementType) => (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        pathname === href ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-gray-900">VoiceNote</span>
          <div className="flex gap-1">
            {navLink('/dashboard', '録音', Mic)}
            {navLink('/dashboard/history', '履歴', History)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-500 sm:block">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
            <LogOut className="h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </div>
    </nav>
  );
}
