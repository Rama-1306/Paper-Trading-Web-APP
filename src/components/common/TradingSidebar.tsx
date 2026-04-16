'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { OrderPanel } from '@/components/Trading/OrderPanel';
import { PositionList } from '@/components/Trading/PositionList';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore } from '@/stores/marketStore';
import { formatPnL } from '@/lib/utils/formatters';

const MIN_WIDTH = 260;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 320;

/**
 * Right-side trading sidebar shown on the chart page.
 * Layout (top → bottom):
 *   1. Day P&L strip — always visible, completely separate
 *   2. Place Order | Positions tab bar
 *   3. Tab content (OrderPanel or PositionList compact)
 */
export function TradingSidebar() {
  const [tab, setTab] = useState<'order' | 'positions'>('order');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // ── Day P&L data ────────────────────────────────────────────
  const positions = useTradingStore((s) => s.positions);
  const trades = useTradingStore((s) => s.trades);
  const ticks = useMarketStore((s) => s.ticks);

  const openPositions = positions.filter((p) => p.isOpen);

  const unrealizedPnl = openPositions.reduce((sum, pos) => {
    const ltp = ticks[pos.symbol]?.ltp ?? pos.currentPrice;
    const pnl =
      pos.side === 'BUY'
        ? (ltp - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - ltp) * pos.quantity;
    return sum + pnl;
  }, 0);

  const todayISTKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const todayRealizedPnl = trades.reduce((sum, t) => {
    const exitDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(t.exitTime));
    return exitDay === todayISTKey ? sum + t.pnl : sum;
  }, 0);

  const dayPnl = todayRealizedPnl + unrealizedPnl;
  const realizedInfo = formatPnL(todayRealizedPnl);
  const unrealizedInfo = formatPnL(unrealizedPnl);
  const totalInfo = formatPnL(dayPnl);

  // ── Drag-to-resize ──────────────────────────────────────────
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      e.preventDefault();
    },
    [width],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <aside
      className="hidden md:flex shrink-0 border-l border-surface-container-highest flex-row overflow-hidden bg-surface-container-lowest"
      style={{ width }}
    >
      {/* Drag handle — left edge */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
        title="Drag to resize"
      />

      {/* Panel content */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* ── 1. Day P&L strip — always visible, above everything ── */}
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--bg-panel)',
            borderBottom: '2px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '6px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              flexShrink: 0,
            }}
          >
            Day P&amp;L
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              R:{' '}
              <span className={realizedInfo.className} style={{ fontWeight: 700 }}>
                {realizedInfo.text}
              </span>
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              U:{' '}
              <span className={unrealizedInfo.className} style={{ fontWeight: 700 }}>
                {unrealizedInfo.text}
              </span>
            </span>
            <span
              className={totalInfo.className}
              style={{ fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              {totalInfo.text}
            </span>
          </div>
        </div>

        {/* ── 2. Tab bar ── */}
        <div className="grid grid-cols-2 border-b border-surface-container-highest shrink-0">
          <button
            onClick={() => setTab('order')}
            className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              tab === 'order'
                ? 'bg-primary-container text-on-primary-fixed'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Place Order
          </button>
          <button
            onClick={() => setTab('positions')}
            className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              tab === 'positions'
                ? 'bg-primary-container text-on-primary-fixed'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Positions
          </button>
        </div>

        {/* ── 3. Tab content ── */}
        <div className="flex-1 overflow-auto">
          {tab === 'order' ? <OrderPanel /> : <PositionList compact />}
        </div>
      </div>
    </aside>
  );
}
