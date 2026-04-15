'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { ThemeSwitcher } from './ThemeSwitcher';

export function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const account = useTradingStore((s) => s.account);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const notifications = useUIStore((s) => s.notifications);
  const clearNotifications = useUIStore((s) => s.clearNotifications);
  const [hasToken, setHasToken] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem('fyers_access_token'));
  }, []);

  const isAdmin = session?.user?.role === 'ADMIN';

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fyers_access_token');
      localStorage.removeItem('activeSymbol');
      localStorage.removeItem('activeLotSize');
    }
    await signOut({ callbackUrl: '/auth/signin' });
  };

  const navLinks = [
    { href: '/trade', label: 'Markets' },
    { href: '/', label: 'Portfolio' },
    { href: '/positions', label: 'Positions' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 h-16 flex items-center justify-between px-8 bg-surface-container-lowest border-b border-surface-dim/30 font-sans">
      {/* Logo + nav links */}
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-black tracking-tighter text-on-background select-none">
          WU Precision Ledger
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-150 pb-0.5 ${active
                  ? 'text-on-background border-b-2 border-primary-container font-bold'
                  : 'text-surface-dim hover:text-on-background'
                  }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* WS connection indicator */}
        <div
          title={connectionStatus.isFeedLive ? 'Live feed connected' : 'Feed disconnected'}
          className={`w-2 h-2 rounded-full ${connectionStatus.isFeedLive ? 'bg-green-500' : 'bg-amber-500'
            }`}
        />

        {/* Fyers connect (admin only) */}
        {isAdmin && !connectionStatus.isFeedLive && (
          <a
            href="/api/auth/fyers"
            className="text-[10px] font-bold px-3 py-1.5 bg-surface-container text-on-surface-variant rounded hover:bg-surface-container-high transition-colors"
          >
            {hasToken ? 'Reconnect' : 'Connect Fyers'}
          </a>
        )}

        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifPanel(v => !v)}
            className="relative material-symbols-outlined text-on-surface-variant hover:text-on-surface text-xl transition-colors"
          >
            notifications
          </button>
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-on-error text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
          {showNotifPanel && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest border border-surface-dim/30 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-dim/20">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Notifications</span>
                <button onClick={() => { clearNotifications(); setShowNotifPanel(false); }} className="text-[10px] text-on-surface-variant hover:text-on-surface font-semibold">Clear all</button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-on-surface-variant text-center">No notifications</div>
                ) : (
                  notifications.slice().reverse().map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-surface-dim/10 last:border-0 ${n.type === 'success' ? 'border-l-2 border-l-green-500' : n.type === 'error' ? 'border-l-2 border-l-red-600' : 'border-l-2 border-l-amber-500'}`}>
                      <div className="text-xs font-semibold text-on-background">{n.title}</div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Balance chip */}
        {account && (
          <div className="hidden md:flex items-center px-3 py-1.5 bg-surface-container rounded text-xs font-bold text-on-surface">
            ₹{account.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        )}

        {/* Trade Now CTA */}
        <Link
          href="/trade"
          className="hidden md:inline-flex bg-primary-container text-on-primary-fixed px-5 py-2 rounded-lg font-bold text-sm hover:brightness-95 active:scale-95 transition-all"
        >
          Trade Now
        </Link>

        {/* Avatar → Profile */}
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-sm text-on-surface hover:bg-surface-container-highest transition-colors select-none"
          title="Profile"
        >
          {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
        </Link>
      </div>
    </nav>
  );
}
