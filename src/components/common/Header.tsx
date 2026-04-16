'use client';

import { useSession, signOut } from "next-auth/react";
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { formatINR } from '@/lib/utils/formatters';
import { InstrumentSearch } from '@/components/Trading/InstrumentSearch';

export function Header() {
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const reconnectSocket = useMarketStore((s) => s.reconnectSocket);
  const account = useTradingStore((s) => s.account);
  const positions = useTradingStore((s) => s.positions);
  const trades = useTradingStore((s) => s.trades);
  const ticks = useMarketStore((s) => s.ticks);

  const [hasToken, setHasToken] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    setHasToken(!!localStorage.getItem('fyers_access_token'));
  }, []);

  const clearBrowserCache = async () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('fyers_access_token');
    localStorage.removeItem('activeSymbol');
    localStorage.removeItem('activeLotSize');
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  };

  const handleDisconnectFyers = () => {
    localStorage.removeItem('fyers_access_token');
    setHasToken(false);
    window.location.reload();
  };

  const handleLogout = async () => {
    await clearBrowserCache();
    await signOut({ callbackUrl: "/" });
  };

  const balance = account?.balance ?? 1000000;
  const unrealizedPnl = positions
    .filter(p => p.isOpen)
    .reduce((sum, pos) => {
      const ltp = ticks[pos.symbol]?.ltp ?? pos.currentPrice;
      const pnl = pos.side === 'BUY'
        ? (ltp - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - ltp) * pos.quantity;
      return sum + pnl;
    }, 0);
  const todayISTStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const todayRealizedPnl = trades.reduce((sum, t) => {
    const exitDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(t.exitTime));
    return exitDay === todayISTStr ? sum + t.pnl : sum;
  }, 0);
  const dayPnl = todayRealizedPnl + unrealizedPnl;

  const handleMobileRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      reconnectSocket();
      await Promise.all([
        useTradingStore.getState().fetchAccount(),
        useTradingStore.getState().fetchPositions(),
        useTradingStore.getState().fetchOrders(),
        useTradingStore.getState().fetchTrades(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, reconnectSocket]);

  return (
    <>
      {/* ── Row 1: Logo + controls ── */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">
            <div className="header-logo-icon">📊</div>
            <span className="header-logo-text">BN Paper Trader</span>
          </div>

        </div>

        <div className="header-right">
          {connectionStatus.isFeedLive ? (
            <>
              <div className="status-dot connected" title="Connected to Fyers live feed" />
              {isAdmin && (
                <>
                  <a href="/api/auth/fyers" className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}>
                    Reconnect
                  </a>
                  <button onClick={handleDisconnectFyers}
                    style={{ background: 'rgba(255,152,0,0.15)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, cursor: 'pointer' }}
                    title="Clear local Fyers token and refresh">
                    Clear Token
                  </button>
                </>
              )}
            </>
          ) : isAdmin ? (
            <>
              <div className="status-dot" style={{ background: '#ff9800' }}
                title={hasToken ? 'Token found, reconnect if feed is stale' : 'Admin feed not connected'} />
              <a href="/api/auth/fyers" className="btn btn-primary"
                style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}>
                {hasToken ? 'Reconnect Fyers' : 'Connect Fyers'}
              </a>
              {hasToken && (
                <button onClick={handleDisconnectFyers}
                   style={{ background: 'rgba(255,152,0,0.15)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, cursor: 'pointer' }}
                  title="Clear local Fyers token and refresh">
                  Clear Token
                </button>
              )}
            </>
          ) : (
            <div className="status-dot" style={{ background: '#ff9800' }}
              title={hasToken ? 'Token found, connecting...' : 'Waiting for live feed'} />
          )}

          {/* Mobile-only refresh button */}
          <button
            className="mobile-refresh-btn"
            onClick={handleMobileRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            aria-label="Refresh"
          >
            <span style={{
              display: 'inline-block',
              animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
              fontSize: '14px',
            }}>
              ↻
            </span>
          </button>

          <Link href="/backtester" className="header-backtester-link" style={{
            padding: '4px 10px', borderRadius: '4px',
            background: 'rgba(88,166,255,0.12)', color: '#58a6ff',
            border: '1px solid rgba(88,166,255,0.25)',
            fontSize: '10px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
          }} title="CCC Backtester">
            Backtester
          </Link>

          {isAdmin && (
            <Link href="/admin" className="header-backtester-link" style={{
              padding: '4px 10px', borderRadius: '4px',
              background: 'rgba(255,183,77,0.14)', color: '#ffb74d',
              border: '1px solid rgba(255,183,77,0.3)',
              fontSize: '10px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            }} title="Admin Dashboard">
              Admin
            </Link>
          )}

          <Link href="/profile" style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: '#fff',
            textDecoration: 'none', cursor: 'pointer',
          }} title="Profile">
            {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
          </Link>

          <button onClick={handleLogout}
            style={{ background: 'rgba(255,23,68,0.15)', color: '#ff1744', border: '1px solid rgba(255,23,68,0.3)', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
            title="Sign Out">
            Logout
          </button>
        </div>
      </header>

      {/* ── Row 2: Instrument search bar — mobile only ── */}
      <InstrumentSearch className="header-search-mobile-only" />

      {/* Mobile-only: balance + Day P&L strip */}
      <div className="header-mobile-summary">
        <div className="header-mobile-stat">
          <span className="hms-label">Balance</span>
          <span className="hms-value">{formatINR(balance)}</span>
        </div>
        <div className="header-mobile-stat">
          <span className="hms-label">Day P&L</span>
          <span className={`hms-value ${dayPnl >= 0 ? 'profit' : 'loss'}`}>
            {dayPnl >= 0 ? '+' : ''}{formatINR(dayPnl)}
          </span>
        </div>
      </div>
    </>
  );
}
