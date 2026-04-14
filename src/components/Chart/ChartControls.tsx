'use client';

import { useState, useEffect } from 'react';
import { useMarketStore, getAccurateNowUTC } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { TIMEFRAMES } from '@/lib/utils/constants';
import { getCurrentFuturesSymbol, parseSymbolDisplay } from '@/lib/utils/symbols';
import type { Timeframe } from '@/types/market';

function CandleCountdown() {
  const timeframe = useMarketStore((s) => s.timeframe);
  // Only subscribe to whether candles exist — not the full array.
  // Using the full array causes this component to re-render (and restart the
  // interval) on every single tick, which breaks the countdown.
  const hasCandles = useMarketStore((s) => s.candles.length > 0);
  const [remaining, setRemaining] = useState('');

  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const tfConfig = TIMEFRAMES.find(t => t.value === timeframe);
  const intervalSeconds = tfConfig?.seconds ?? 300;

  useEffect(() => {
    const calc = (): string => {
      if (!hasCandles) return '';

      // Wall-clock calculation aligned to exchange open — same as TradingView.
      // MCX: 9:00 AM – 11:30 PM IST (continuous session)
      // NSE/BSE: 9:15 AM – 3:30 PM IST
      const IST_OFFSET = 19800; // +5:30 in seconds
      const isMCX = activeSymbol.startsWith('MCX:');
      const MARKET_OPEN  = isMCX ? 9 * 3600 : 9 * 3600 + 15 * 60;     // 9:00 or 9:15 AM
      const MARKET_CLOSE = isMCX ? 23 * 3600 + 30 * 60 : 15 * 3600 + 30 * 60; // 11:30 PM or 3:30 PM

      const nowUTC = getAccurateNowUTC();
      const nowIST = nowUTC + IST_OFFSET;
      const timeOfDayIST = nowIST % 86400;

      if (timeOfDayIST < MARKET_OPEN || timeOfDayIST >= MARKET_CLOSE) return '';

      const elapsed = timeOfDayIST - MARKET_OPEN;
      const secondsLeft = intervalSeconds - (elapsed % intervalSeconds);

      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;

      if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hrs}:${String(remainMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
      if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}`;
      return `0:${String(secs).padStart(2, '0')}`;
    };

    setRemaining(calc());
    const timer = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(timer);
  // Only restart when timeframe changes or candles first appear — NOT on every tick.
  }, [intervalSeconds, hasCandles, activeSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!remaining || !hasCandles) return null;

  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      fontWeight: 600,
      color: '#745b00',
      background: 'rgba(116,91,0,0.1)',
      padding: '2px 6px',
      borderRadius: '3px',
      letterSpacing: '0.5px',
      minWidth: '40px',
      textAlign: 'center',
    }}>
      {remaining}
    </span>
  );
}

interface ChartControlsProps {
  onToggleChart?: () => void;
}

export function ChartControls({ onToggleChart }: ChartControlsProps) {
  const timeframe = useMarketStore((s) => s.timeframe);
  const setTimeframe = useMarketStore((s) => s.setTimeframe);
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const showIndicators = useUIStore((s) => s.showIndicators);
  const toggleIndicators = useUIStore((s) => s.toggleIndicators);

  const futuresSymbol = getCurrentFuturesSymbol();
  const isOption = activeSymbol.includes('CE') || activeSymbol.includes('PE');
  const isFutures = activeSymbol.endsWith('FUT');
  const displayName = parseSymbolDisplay(activeSymbol);

  const handleBackToFutures = () => {
    useMarketStore.getState().setActiveSymbol(futuresSymbol);
    useTradingStore.getState().setSelectedSymbol(futuresSymbol);
  };

  return (
    <div className="chart-controls">
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginRight: '8px',
        paddingRight: '8px',
        borderRight: '1px solid #e4e2de',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 700,
          color: isOption ? '#d47a00' : isFutures ? '#00875a' : '#745b00',
          background: isOption ? 'rgba(212,122,0,0.1)' : isFutures ? 'rgba(0,135,90,0.1)' : 'rgba(116,91,0,0.1)',
          padding: '2px 8px',
          borderRadius: '3px',
          letterSpacing: '0.5px',
        }}>
          {displayName}
        </span>
        {isOption && (
          <button
            className="tf-btn"
            onClick={handleBackToFutures}
            style={{ fontSize: '10px', padding: '2px 6px' }}
            title="Switch back to Bank Nifty Futures chart"
          >
            FUT
          </button>
        )}
      </div>

      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          className={`tf-btn ${timeframe === tf.value ? 'active' : ''}`}
          onClick={() => setTimeframe(tf.value as Timeframe)}
        >
          {tf.label}
        </button>
      ))}

      <CandleCountdown />

      <div className="chart-separator" />
      <button
        className={`tf-btn ${showIndicators ? 'active' : ''}`}
        onClick={toggleIndicators}
        title="Toggle Indicators"
      >
        CCC
      </button>
      {onToggleChart && (
        <button
          className="tf-btn chart-hide-btn"
          onClick={onToggleChart}
          title="Hide Chart"
        >
          ✕
        </button>
      )}
    </div>
  );
}
