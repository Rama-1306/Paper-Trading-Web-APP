'use client';

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { formatINR, formatPercent } from '@/lib/utils/formatters';
import { getPredefinedSymbols, SymbolItem } from '@/lib/utils/symbols';

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
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 400 });
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

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

  const bankNiftySymbols = getPredefinedSymbols();
  const allSymbols: SymbolItem[] = [...bankNiftySymbols, ...mcxSymbols];

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

  const handleLiveSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) {
      setLiveSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setLiveSearchLoading(true);
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}&type=all&limit=20`);
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
        // ignore
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
    // Dismiss keyboard on mobile
    inputRef.current?.blur();
  };

  const handleSearchFocus = () => {
    // Position dropdown below the entire search bar, full width of search strip
    const bar = searchBarRef.current;
    if (bar) {
      const rect = bar.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    setShowDropdown(true);
    fetchMcxSymbols();
  };

  // Close on outside tap/click — capture phase fires before blur on mobile
  useEffect(() => {
    if (!showDropdown) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const bar = searchBarRef.current;
      // The dropdown is position:fixed so not in bar's DOM — check both
      const dropdownEl = document.getElementById('symbol-dropdown');
      if (bar && !bar.contains(target) && dropdownEl && !dropdownEl.contains(target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('touchstart', handleOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('touchstart', handleOutside, true);
    };
  }, [showDropdown]);

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
      {/* ── Row 1: Logo + controls ── */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">
            <div className="header-logo-icon">📊</div>
            <span className="header-logo-text">BN Paper Trader</span>
          </div>

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
        </div>

        <div className="header-right">
          {connectionStatus.isConnected ? (
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

      {/* ── Row 2: Dedicated instrument search bar ── */}
      <div className="header-search-bar" ref={searchBarRef}>
        <div className="header-search-input-wrap">
          <span className="header-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="header-search-input"
            value={symbolInput}
            onFocus={handleSearchFocus}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setSymbolInput(val);
              handleLiveSearch(val);
            }}
            onBlur={handleSymbolChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { handleSymbolChange(); setShowDropdown(false); inputRef.current?.blur(); }
              if (e.key === 'Escape') { setShowDropdown(false); inputRef.current?.blur(); }
            }}
            placeholder="Search instrument — BANKNIFTY, NIFTY, GOLD, CRUDEOIL…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {symbolInput.length > 0 && (
            <button
              className="header-search-clear"
              onMouseDown={(e) => { e.preventDefault(); setSymbolInput(''); setLiveSearchResults([]); inputRef.current?.focus(); }}
              onTouchEnd={(e) => { e.preventDefault(); setSymbolInput(''); setLiveSearchResults([]); inputRef.current?.focus(); }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Current price — right side of search bar */}
        <div className="header-search-price">
          <span className="hsp-price">
            {spotPrice > 0
              ? spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : connectionStatus.isConnected ? '…' : '—'}
          </span>
          {spotPrice > 0 && (
            <span className={`hsp-change ${change >= 0 ? 'profit' : 'loss'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)} ({formatPercent(changePercent)})
            </span>
          )}
        </div>
      </div>

      {/* ── Instrument search dropdown (fixed, below search bar) ── */}
      {showDropdown && (
        <div
          id="symbol-dropdown"
          style={{
            position: 'fixed',
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: '55vh',
            overflowY: 'auto',
            background: '#1a1d23',
            border: '1px solid var(--border-primary)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            zIndex: 9999,
            boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
            WebkitOverflowScrolling: 'touch' as any,
          }}
        >
          {filtered.map(s => {
            const showGroup = s.group !== lastGroup;
            lastGroup = s.group;
            return (
              <div key={s.value}>
                {showGroup && (
                  <div style={{
                    padding: '6px 14px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: s.group === 'MCX' ? '#ff9800' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    position: 'sticky',
                    top: 0,
                  }}>
                    {s.group}{s.group === 'MCX' ? ' — Live from Fyers' : ''}
                  </div>
                )}
                <div
                  onMouseDown={() => handleSymbolSelect(s.value, s.lotSize)}
                  onTouchEnd={(e) => { e.preventDefault(); handleSymbolSelect(s.value, s.lotSize); }}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '44px',   // 44px min tap target (Apple HIG)
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.18)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: 1 }}>{s.value}</div>
                  </div>
                  {s.lotSize && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
                      Lot: {s.lotSize}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(mcxLoading || liveSearchLoading) && (
            <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              {liveSearchLoading ? 'Searching…' : 'Loading MCX symbols…'}
            </div>
          )}
          {filtered.length === 0 && !mcxLoading && !liveSearchLoading && (
            <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No results. Type a Fyers symbol (e.g. NSE:RELIANCE-EQ) and press Enter.
            </div>
          )}
        </div>
      )}

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
