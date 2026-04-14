'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { formatINR } from '@/lib/utils/formatters';

interface AccountData {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  realizedPnl: number;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch('/api/account', { cache: 'no-store' })
        .then(r => r.json())
        .then(data => { if (data.account) setAccount(data.account); })
        .catch(() => null)
        .finally(() => setLoading(false));
    }
  }, [session]);

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fyers_access_token');
      localStorage.removeItem('activeSymbol');
      localStorage.removeItem('activeLotSize');
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    }
    await signOut({ callbackUrl: '/auth/signin' });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const balance = account?.balance ?? 1_000_000;
  const initial = account?.initialBalance ?? 1_000_000;
  const realizedPnl = account?.realizedPnl ?? 0;
  const totalReturn = initial > 0
    ? ((balance - initial + realizedPnl) / initial * 100).toFixed(2)
    : '0.00';
  const initials = session.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-surface font-sans">
        <TopNav />

        <div className="flex">
          <SideNav />

          {/* Main content — centered with max-width */}
          <main className="flex-1 ml-20 p-8 lg:p-12">

            {/* ── Profile Header ───────────────────────── */}
            <section className="mb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
              <div className="flex items-center gap-8">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-primary-container flex items-center justify-center text-on-primary-fixed text-4xl font-black border-4 border-surface-container-lowest shadow-lg">
                    {initials}
                  </div>
                  <div className="absolute bottom-2 right-1 bg-primary-container text-on-primary-fixed p-1.5 rounded-full shadow-md">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </div>
                </div>
                {/* Name block */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-on-background">
                      {session.user?.name ?? 'Trader'}
                    </h1>
                    <span className="bg-tertiary-container text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified
                      </span>
                      {isAdmin ? 'Admin' : 'Verified'}
                    </span>
                  </div>
                  <p className="text-on-surface-variant font-medium text-lg">
                    {isAdmin ? 'Administrator Account' : 'Paper Trading Account'}
                  </p>
                  <p className="text-on-surface-variant/60 text-sm mt-1">
                    {session.user?.email}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="px-6 py-3 bg-surface-container-highest text-on-surface font-bold rounded-lg hover:bg-surface-container-high transition-colors text-sm"
                  >
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-8 py-3 bg-primary-container text-on-primary-fixed font-bold rounded-lg active:scale-95 transition-transform shadow-md text-sm"
                >
                  Sign Out
                </button>
              </div>
            </section>

            {/* ── Bento Grid ───────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

              {/* Personal Information */}
              <div className="md:col-span-8 bg-surface-container-low p-8 rounded-xl">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-bold tracking-tight uppercase text-on-background">
                    Account Information
                  </h2>
                  <span className="material-symbols-outlined text-on-surface-variant">person</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {[
                    { label: 'Full Name', value: session.user?.name ?? '—' },
                    { label: 'Email Address', value: session.user?.email ?? '—' },
                    { label: 'Account Role', value: isAdmin ? 'Administrator' : 'Trader' },
                    { label: 'Account Status', value: 'Active' },
                  ].map(({ label, value }) => (
                    <div key={label} className="border-b border-outline-variant/30 pb-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                        {label}
                      </label>
                      <p className="text-on-surface font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Info */}
              <div className="md:col-span-4 bg-surface-container-highest/40 p-8 rounded-xl flex flex-col border border-outline-variant/10">
                <h2 className="text-lg font-bold tracking-tight uppercase text-on-background mb-8">
                  Financial Info
                </h2>
                <div className="space-y-6 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Current Balance
                      </p>
                      <p className="font-bold text-on-surface">{formatINR(balance)}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary">account_balance</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Initial Capital
                      </p>
                      <p className="font-bold text-on-surface">{formatINR(initial)}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary">savings</span>
                  </div>
                  <div className="flex items-center justify-between bg-white p-4 rounded-lg">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Account Status
                      </p>
                      <p className="font-bold text-on-surface">Active</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                </div>
                <Link
                  href="/"
                  className="mt-6 w-full py-3 text-center bg-surface-container-highest text-on-surface font-bold rounded-lg hover:bg-surface-container-high transition-colors text-sm"
                >
                  View Portfolio
                </Link>
              </div>

              {/* Trading Performance */}
              <div className="md:col-span-8 bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-bold tracking-tight uppercase text-on-background">
                    Trading Performance
                  </h2>
                  <span className="material-symbols-outlined text-on-surface-variant">trending_up</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Current Balance',
                      value: formatINR(balance),
                      color: 'text-on-background',
                    },
                    {
                      label: 'Initial Balance',
                      value: formatINR(initial),
                      color: 'text-on-background',
                    },
                    {
                      label: 'Realized P&L',
                      value: `${realizedPnl >= 0 ? '+' : ''}${formatINR(realizedPnl)}`,
                      color: realizedPnl >= 0 ? 'text-green-600' : 'text-error',
                    },
                    {
                      label: 'Total Return',
                      value: `${Number(totalReturn) >= 0 ? '+' : ''}${totalReturn}%`,
                      color: Number(totalReturn) >= 0 ? 'text-primary' : 'text-error',
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-surface-container-low rounded-lg p-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                        {label}
                      </p>
                      <p className={`text-xl font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trading Preferences */}
              <div className="md:col-span-4 bg-surface-container-high/60 p-8 rounded-xl">
                <h2 className="text-lg font-bold tracking-tight uppercase text-on-background mb-8">
                  Quick Actions
                </h2>
                <div className="space-y-3">
                  <Link
                    href="/trade"
                    className="flex items-center justify-between w-full py-4 px-5 bg-primary-container text-on-primary-fixed font-bold rounded-lg hover:brightness-95 transition-all"
                  >
                    Open Trading Terminal
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                  <Link
                    href="/positions"
                    className="flex items-center justify-between w-full py-4 px-5 bg-surface-container-lowest text-on-surface font-bold rounded-lg border border-outline-variant/20 hover:border-primary transition-all"
                  >
                    View Positions
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                  <Link
                    href="/backtester"
                    className="flex items-center justify-between w-full py-4 px-5 bg-surface-container-lowest text-on-surface font-bold rounded-lg border border-outline-variant/20 hover:border-primary transition-all"
                  >
                    Open Backtester
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-between w-full py-4 px-5 bg-surface-container-lowest text-error font-bold rounded-lg border border-error/20 hover:border-error hover:bg-error-container/30 transition-all"
                  >
                    Sign Out
                    <span className="material-symbols-outlined text-sm">logout</span>
                  </button>
                </div>
              </div>

            </div>

            <div className="h-16" />
          </main>
        </div>

        <ToastContainer />
      </div>
    </ProtectedRoute>
  );
}
