'use client';

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { formatINR, formatPercent } from '@/lib/utils/formatters';
import { getPredefinedSymbols, parseSymbolDisplay, SymbolItem } from '@/lib/utils/symbols';

export function Header() {
  const spotPrice = useMarketStore((s) => s.spotPrice);
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const account = useTradingStore((s) => s.account);
  const positions = useTradingStore((s) => s.positions);
  const trades = useTradingStore((s) => s.trades);
  const ticks = useMarketStore((s) => s.ticks);
  
  const [hasToken, setHasToken] = useState(false);
  const [symbolInput, setSymbolInput] = useState(activeSymbol);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mcxSymbols, setMcxSymbols] = useState<SymbolItem[]>([]);
  const [mcxLoading, setMcxLoading] = useState(false);
  const [mcxLoaded, setMcxLoaded] = useState(false);
  const [liveSearchResults, setLiveSearchResults] = useState<SymbolItem[]>([]);
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasToken(!!localStorage.getItem('fyers_access_token'));
  }, []);

  useEffect(() => {
    setSymbolInput(activeSymbol);
  }, [activeSymbol]);
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
    await signOut({ callbackUrl: "/auth/signin" });
  };

  const fetchMcxSymbols = useCallback(async () => {
    if (mcxLoaded || mcxLoading) return;
    setMcxLoading(true);
    try {
      const res = await fetch('/api/symbol-search?exchange=MCX&type=futures&limit=60');
      const data = await res.json();
      if (data.results) {
        setMcxSymbols(data.results.map((s: any) => ({
          value: s.value,
          label: s.label,
          group: 'MCX',
          lotSize: s.lotSize,
        })));
        setMcxLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch MCX symbols:', err);
    } finally {
      setMcxLoading(false);
    }
  }, [mcxLoaded, mcxLoading]);

  const handleSymbolChange = () => {
    if (symbolInput && symbolInput !== activeSymbol) {
      const match = allSymbols.find(s => s.value === symbolInput);
      const lotSize = match?.lotSize;
      useMarketStore.getState().setActiveSymbol(symbolInput, lotSize);
      useTradingStore.getState().setSelectedSymbol(symbolInput);
      if (lotSize && lotSize > 0) {
        useTradingStore.getState().setOrderQuantity(lotSize);
      }
    }
  };

  const bankNiftySymbols = getPredefinedSymbols();
  const allSymbols: SymbolItem[] = [...bankNiftySymbols, ...mcxSymbols];

  // Debounced live search for all instrument types
  const handleLiveSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) {
      setLiveSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setLiveSearchLoading(true);
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}&type=all&limit=15`);
        if (res.ok) {
          const data = await res.json();
          setLiveSearchResults((data.results || []).map((s: any) => ({
            value: s.value,
            label: s.label,
            group: s.group || 'Search',
            lotSize: s.lotSize,
          })));
        }
      } catch {
        // ignore search errors
      }
      setLiveSearchLoading(false);
    }, 300);
  }, []);

  const handleSymbolSelect = (val: string, lotSize?: number) => {
    setSymbolInput(val);
    setShowDropdown(false);
    if (val !== activeSymbol) {
      useMarketStore.getState().setActiveSymbol(val, lotSize);
      useTradingStore.getState().setSelectedSymbol(val);
      if (lotSize && lotSize > 0) {
        useTradingStore.getState().setOrderQuantity(lotSize);
      }
    }
  };

  const handleDropdownOpen = () => {
    setShowDropdown(true);
    fetchMcxSymbols();
  };

  const activeTick = ticks[activeSymbol];
  const change = activeTick?.change ?? 0;
  const changePercent = activeTick?.changePercent ?? 0;

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
  // Day's P&L = today's closed trades + current open unrealized
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

  // When user is actively searching (2+ chars), show live API results; otherwise show predefined list
  const isSearching = symbolInput.length >= 2 && liveSearchResults.length > 0;
  const filtered = isSearching
    ? liveSearchResults
    : allSymbols.filter(s =>
        s.label.toLowerCase().includes(symbolInput.toLowerCase()) ||
        s.value.toLowerCase().includes(symbolInput.toLowerCase())
      );

  let lastGroup = '';

  return (
    <>
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <div className="header-logo-icon">📊</div>
          <span className="header-logo-text">BN Paper Trader</span>
        </div>

        <div className="header-spot" style={{ position: 'relative' }} ref={dropdownRef}>
          <input
            value={symbolInput}
            onFocus={handleDropdownOpen}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setSymbolInput(val);
              handleLiveSearch(val);
            }}
            onBlur={() => {
              setTimeout(() => setShowDropdown(false), 200);
              handleSymbolChange();
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSymbolChange()}
            placeholder="Search Fyers Symbol..."
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '4px',
              width: '220px',
              outline: 'none',
              transition: 'all 0.2s',
            }}
          />

          {showDropdown && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '320px',
                maxHeight: '400px',
                overflowY: 'auto',
                background: '#1a1d23',
                border: '1px solid var(--border-primary)',
                borderRadius: '4px',
                marginTop: '4px',
                zIndex: 1000,
                boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
              }}>
              {filtered.map(s => {
                const showGroup = s.group !== lastGroup;
                lastGroup = s.group;
                return (
                  <div key={s.value}>
                    {showGroup && (
                      <div style={{
                        padding: '6px 12px',
                        fontSize: '9px',
                        fontWeight: 700,
                        color: s.group === 'MCX' ? '#ff9800' : 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        background: 'rgba(255,255,255,0.03)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        position: 'sticky',
                        top: 0,
                      }}>{s.group} {s.group === 'MCX' && '(Live from Fyers)'}</div>
                    )}
                    <div
                      onMouseDown={() => handleSymbolSelect(s.value, s.lotSize)}
                      onTouchEnd={(e) => { e.preventDefault(); handleSymbolSelect(s.value, s.lotSize); }}
                      style={{
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{s.label}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{s.value}</div>
                      </div>
                      {s.lotSize && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                          Lot: {s.lotSize}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {(mcxLoading || liveSearchLoading) && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                  {liveSearchLoading ? 'Searching...' : 'Loading MCX symbols...'}
                </div>
              )}
              {filtered.length === 0 && !mcxLoading && !liveSearchLoading && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                  No matching symbols. Type a Fyers symbol and press Enter.
                </div>
              )}
            </div>
          )}
          
          <span className="header-spot-price" style={{ minWidth: '80px' }}>
            {spotPrice > 0 ? (
              spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ) : connectionStatus.isConnected ? (
              <span style={{ opacity: 0.5, fontSize: '10px' }}>Fetching...</span>
            ) : (
              '—'
            )}
          </span>
          {spotPrice > 0 && (
            <span className={`header-spot-change ${change >= 0 ? 'profit' : 'loss'}`}
              style={{
                background: change >= 0 
                  ? 'rgba(0, 230, 118, 0.12)' 
                  : 'rgba(255, 23, 68, 0.12)'
              }}
            >
              {change >= 0 ? '+' : ''}{change.toFixed(2)} ({formatPercent(changePercent)})
            </span>
          )}
        </div>
      </div>

      <div className="header-right">
        <div className="header-balance">
          <span className="header-balance-label">Balance</span>
          <span className={`header-balance-value ${dayPnl >= 0 ? 'profit' : 'loss'}`}>
            {formatINR(balance)}
          </span>
        </div>

        <div className="header-balance">
          <span className="header-balance-label">Day P&L</span>
          <span className={`header-balance-value ${dayPnl >= 0 ? 'profit' : 'loss'}`}>
            {dayPnl >= 0 ? '+' : ''}{formatINR(dayPnl)}
          </span>
        </div>

        {connectionStatus.isConnected ? (
          <>
            <div
              className="status-dot connected"
              title="Connected to Fyers live feed"
            />
            {isAdmin && (
              <>
                <a
                  href="/api/auth/fyers"
                  className="btn btn-primary"
                  style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}
                >
                  Reconnect
                </a>
                <button
                  onClick={handleDisconnectFyers}
                  style={{
                    background: 'rgba(255, 152, 0, 0.15)',
                    color: '#ff9800',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Clear local Fyers token and refresh"
                >
                  Clear Token
                </button>
              </>
            )}
          </>
        ) : isAdmin ? (
          <>
            <div
              className="status-dot"
              style={{ background: '#ff9800' }}
              title={hasToken ? 'Token found, reconnect if feed is stale' : 'Admin feed not connected'}
            />
            <a
              href="/api/auth/fyers"
              className="btn btn-primary"
              style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}
            >
              {hasToken ? 'Reconnect Fyers' : 'Connect Fyers'}
            </a>
            {hasToken && (
              <button
                onClick={handleDisconnectFyers}
                style={{
                  background: 'rgba(255, 152, 0, 0.15)',
                  color: '#ff9800',
                  border: '1px solid rgba(255, 152, 0, 0.3)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Clear local Fyers token and refresh"
              >
                Clear Token
              </button>
            )}
          </>
        ) : hasToken ? (
          <div
            className="status-dot"
            style={{ background: '#ff9800' }}
            title="Token found, connecting..."
          />
        ) : (
          <div
            className="status-dot"
            style={{ background: '#ff9800' }}
            title="Waiting for live feed"
          />
        )}

        <Link href="/backtester" className="header-backtester-link" style={{
          padding: '4px 10px',
          borderRadius: '4px',
          background: 'rgba(88, 166, 255, 0.12)',
          color: '#58a6ff',
          border: '1px solid rgba(88, 166, 255, 0.25)',
          fontSize: '10px',
          fontWeight: 600,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }} title="CCC Backtester">
          Backtester
        </Link>

        {isAdmin && (
          <Link href="/admin" className="header-backtester-link" style={{
            padding: '4px 10px',
            borderRadius: '4px',
            background: 'rgba(255, 183, 77, 0.14)',
            color: '#ffb74d',
            border: '1px solid rgba(255, 183, 77, 0.3)',
            fontSize: '10px',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }} title="Admin Dashboard">
            Admin
          </Link>
        )}

        <Link href="/profile" style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: '#fff',
          textDecoration: 'none',
          cursor: 'pointer',
        }} title="Profile">
          {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
        </Link>

        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(255, 23, 68, 0.15)',
            color: '#ff1744',
            border: '1px solid rgba(255, 23, 68, 0.3)',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Sign Out"
        >
          Logout
        </button>
      </div>
    </header>

    {/* Mobile-only: balance + Day P&L summary strip below header */}
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
