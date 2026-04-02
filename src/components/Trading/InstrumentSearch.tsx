'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { formatPercent } from '@/lib/utils/formatters';
import { getPredefinedSymbols, SymbolItem } from '@/lib/utils/symbols';

interface InstrumentSearchProps {
  showPrice?: boolean;
  onSymbolSelect?: (symbol: string, lotSize?: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function InstrumentSearch({ 
  showPrice = true, 
  onSymbolSelect,
  className = '',
  style = {}
}: InstrumentSearchProps) {
  const spotPrice = useMarketStore((s) => s.spotPrice);
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const ticks = useMarketStore((s) => s.ticks);

  const [symbolInput, setSymbolInput] = useState(activeSymbol);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mcxSymbols, setMcxSymbols] = useState<SymbolItem[]>([]);
  const [mcxLoading, setMcxLoading] = useState(false);
  const [mcxLoaded, setMcxLoaded] = useState(false);
  const [liveSearchResults, setLiveSearchResults] = useState<SymbolItem[]>([]);
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 400 });
  
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSymbolInput(activeSymbol);
  }, [activeSymbol]);

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
      if (onSymbolSelect) onSymbolSelect(symbolInput, lotSize);
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
      if (onSymbolSelect) onSymbolSelect(val, lotSize);
    }
    inputRef.current?.blur();
  };

  const handleSearchFocus = () => {
    const bar = searchBarRef.current;
    if (bar) {
      const rect = bar.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    setShowDropdown(true);
    fetchMcxSymbols();
  };

  useEffect(() => {
    if (!showDropdown) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const bar = searchBarRef.current;
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

  const isSearching = symbolInput.length >= 2 && liveSearchResults.length > 0;
  const filtered = isSearching
    ? liveSearchResults
    : allSymbols.filter(s =>
        s.label.toLowerCase().includes(symbolInput.toLowerCase()) ||
        s.value.toLowerCase().includes(symbolInput.toLowerCase())
      );

  let lastGroup = '';

  return (
    <div className={`header-search-bar ${className}`} ref={searchBarRef} style={style}>
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

      {showPrice && (
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
      )}

      {showDropdown && (
        <div
          id="symbol-dropdown"
          onTouchStart={(e) => {
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          style={{
            position: 'fixed',
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: '55vh',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
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
                  onTouchEnd={(e) => {
                    const start = touchStartRef.current;
                    if (start) {
                      const dx = Math.abs(e.changedTouches[0].clientX - start.x);
                      const dy = Math.abs(e.changedTouches[0].clientY - start.y);
                      if (dx < 10 && dy < 10) {
                        e.preventDefault();
                        handleSymbolSelect(s.value, s.lotSize);
                      }
                    }
                    touchStartRef.current = null;
                  }}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '48px',
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
    </div>
  );
}
