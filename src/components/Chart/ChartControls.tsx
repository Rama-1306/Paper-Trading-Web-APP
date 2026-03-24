'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { TIMEFRAMES } from '@/lib/utils/constants';
import { getCurrentFuturesSymbol, parseSymbolDisplay } from '@/lib/utils/symbols';
import type { Timeframe } from '@/types/market';

function CandleCountdown() {
  const timeframe = useMarketStore((s) => s.timeframe);
  const candles = useMarketStore((s) => s.candles);
  const [remaining, setRemaining] = useState('');

  const tfConfig = TIMEFRAMES.find(t => t.value === timeframe);
  const intervalSeconds = tfConfig?.seconds ?? 300;

  const calcRemaining = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const secondsLeft = intervalSeconds - (now % intervalSeconds);

    if (secondsLeft <= 0 || secondsLeft > intervalSeconds) {
      return '';
    }

    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;

    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}:${String(remainMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    if (mins > 0) {
      return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    return `0:${String(secs).padStart(2, '0')}`;
  }, [intervalSeconds]);

  useEffect(() => {
    setRemaining(calcRemaining());
    const timer = setInterval(() => {
      setRemaining(calcRemaining());
    }, 1000);
    return () => clearInterval(timer);
  }, [calcRemaining]);

  if (!remaining || candles.length === 0) return null;

  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      fontWeight: 600,
      color: '#ffeb3b',
      background: 'rgba(255,235,59,0.08)',
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
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 700,
          color: isOption ? '#ff9800' : isFutures ? '#00e676' : 'var(--text-primary)',
          background: isOption ? 'rgba(255,152,0,0.1)' : isFutures ? 'rgba(0,230,118,0.1)' : 'rgba(99,102,241,0.1)',
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
