'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';

interface StarredItem {
  id: string;
  symbol: string;
  displayName: string;
}

const isOption = (symbol: string) => /\d(CE|PE)$/.test(symbol);

export function TopNav() {
  const { data: session } = useSession();
  const account = useTradingStore((s) => s.account);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const ticks = useMarketStore((s) => s.ticks);
  const notifications = useUIStore((s) => s.notifications);
  const clearNotifications = useUIStore((s) => s.clearNotifications);
  const [hasToken, setHasToken] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [starredItems, setStarredItems] = useState<StarredItem[]>([]);

  useEffect(() => {
    setHasToken(!!localStorage.getItem('fyers_access_token'));
    fetch('/api/watchlists')
      .then(r => r.json())
      .then((lists: Array<{ name: string; items: StarredItem[] }>) => {
        const starred = Array.isArray(lists) ? lists.find(l => l.name === 'Starred') : null;
        if (starred?.items?.length) {
          setStarredItems(starred.items);
          useMarketStore.getState().subscribePositionSymbols(starred.items.map(i => i.symbol));
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = session?.user?.role === 'ADMIN';

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fyers_access_token');
      localStorage.removeItem('activeSymbol');
      localStorage.removeItem('activeLotSize');
    }
    await signOut({ callbackUrl: '/' });
  };

  const indicesRow = starredItems.filter(i => !isOption(i.symbol));
  const optionsRow = starredItems.filter(i => isOption(i.symbol));

  return (
    <div className="sticky top-0 z-50 font-sans">

      {/* ── Row 1: Starred Indices / Futures ── */}
      <div className="h-8 bg-on-background flex items-center px-6 gap-8 overflow-x-auto border-b border-white/10" style={{ scrollbarWidth: 'none' }}>
        <span className="text-[9px] font-black uppercase tracking-widest text-surface-dim shrink-0">Indices</span>
        {indicesRow.length === 0 ? (
          <span className="text-[9px] text-surface-dim italic">— Star index/futures symbols in Watchlist → Starred tab —</span>
        ) : (
          indicesRow.map(item => {
            const tick = ticks[item.symbol];
            const ltp = tick?.ltp;
            const change = tick?.change ?? 0;
            const changePct = tick?.changePercent ?? 0;
            return (
              <div key={item.id} className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold text-white">{item.displayName}</span>
                <span className="text-[10px] font-mono font-bold text-white">{ltp !== undefined ? ltp.toFixed(2) : '—'}</span>
                {ltp !== undefined && (
                  <span className={`text-[9px] font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Row 2: Starred Options ── */}
      <div className="h-8 bg-surface-container-high flex items-center px-6 gap-8 overflow-x-auto border-b border-surface-dim/20" style={{ scrollbarWidth: 'none' }}>
        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant shrink-0">Options</span>
        {optionsRow.length === 0 ? (
          <span className="text-[9px] text-on-surface-variant italic">— Star CE/PE options in Watchlist → Starred tab —</span>
        ) : (
          optionsRow.map(item => {
            const tick = ticks[item.symbol];
            const ltp = tick?.ltp;
            const change = tick?.change ?? 0;
            const changePct = tick?.changePercent ?? 0;
            return (
              <div key={item.id} className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold text-on-surface">{item.displayName}</span>
                <span className="text-[10px] font-mono font-bold text-on-background">{ltp !== undefined ? ltp.toFixed(2) : '—'}</span>
                {ltp !== undefined && (
                  <span className={`text-[9px] font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Row 3: Main Nav Bar ── */}
      <nav className="h-[104px] flex items-center justify-between px-12 bg-surface-container-lowest border-b border-surface-dim/30">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center select-none">
            <Image
              src="/sahaai-logo-v3.png"
              alt="SAHAAI"
              width={276}
              height={92}
              className="h-[92px] w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-4">

          {/* Quick nav links */}
          <Link href="/watchlist" className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-base">visibility</span>
            Watchlist
          </Link>
          <Link href="/option-chain" className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-base">table_chart</span>
            Option Chain
          </Link>
          <Link href="/alerts" className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-base">notifications_active</span>
            Alerts
          </Link>

          <div className="w-px h-6 bg-surface-dim/40" />

          {/* WS connection indicator */}
          <div
            title={connectionStatus.isFeedLive ? 'Live feed connected' : 'Feed disconnected'}
            className={`w-2 h-2 rounded-full ${connectionStatus.isFeedLive ? 'bg-green-500' : 'bg-amber-500'}`}
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
    </div>
  );
}
