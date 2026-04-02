'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { formatINR, formatPnL } from '@/lib/utils/formatters';
import { TradeDetailModal } from './TradeDetailModal';
import { TradeData } from '@/types/trading';

interface TradeHistoryProps {
  type: 'orders' | 'trades';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 4 week band colours at 25% opacity
const WEEK_COLORS = [
  'rgba(99,102,241,0.13)',
  'rgba(34,197,94,0.10)',
  'rgba(251,191,36,0.10)',
  'rgba(168,85,247,0.10)',
];

function toIST(timestamp: number | string | Date) {
  const d = new Date(timestamp);
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
}
function getISTDate(timestamp: number | string | Date) {
  const ist = toIST(timestamp);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth(), date: ist.getUTCDate(), day: ist.getUTCDay() };
}
function formatTimeOnly(timestamp: number | string | Date): string {
  const ist = toIST(timestamp);
  const h = ist.getUTCHours(), m = ist.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface DayGroup {
  dateKey: string; year: number; month: number; date: number; day: number;
  trades: TradeData[]; pnl: number; wins: number; losses: number;
}

type CalCell = { d: number; dateKey: string } | null;

export function TradeHistory({ type }: TradeHistoryProps) {
  const orders = useTradingStore((s) => s.orders);
  const trades = useTradingStore((s) => s.trades);
  const addNotification = useUIStore((s) => s.addNotification);

  const [selectedTrade, setSelectedTrade] = useState<TradeData | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Calendar state
  const _today = new Date();
  const [calYear, setCalYear] = useState(_today.getFullYear());
  const [calMonth, setCalMonth] = useState(_today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number | null>(null);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null); setSelectedWeekIdx(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null); setSelectedWeekIdx(null);
  };

  // Build day→trades lookup
  const dayMap = useMemo(() => {
    const map = new Map<string, DayGroup>();
    for (const trade of trades) {
      const { year, month, date, day } = getISTDate(trade.exitTime);
      const dk = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      if (!map.has(dk)) map.set(dk, { dateKey: dk, year, month, date, day, trades: [], pnl: 0, wins: 0, losses: 0 });
      const dg = map.get(dk)!;
      dg.trades.push(trade);
      dg.pnl += trade.pnl;
      if (trade.pnl > 0) dg.wins++; else if (trade.pnl < 0) dg.losses++;
    }
    return map;
  }, [trades]);

  // Build calendar grid (rows of 7)
  const calendarWeeks = useMemo((): CalCell[][] => {
    const firstDow = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const weeks: CalCell[][] = [];
    let week: CalCell[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mo = String(calMonth).padStart(2, '0');
      const da = String(d).padStart(2, '0');
      week.push({ d, dateKey: `${calYear}-${mo}-${da}` });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [calYear, calMonth]);

  // Aggregate stats for a calendar week row
  const weekStats = (week: CalCell[]) => {
    let pnl = 0, count = 0, wins = 0, losses = 0;
    for (const cell of week) {
      if (!cell) continue;
      const dg = dayMap.get(cell.dateKey);
      if (dg) { pnl += dg.pnl; count += dg.trades.length; wins += dg.wins; losses += dg.losses; }
    }
    return { pnl, count, wins, losses };
  };

  // Month totals
  const monthStats = useMemo(() => {
    let pnl = 0, count = 0;
    const prefix = `${calYear}-${String(calMonth).padStart(2, '0')}`;
    for (const [k, dg] of dayMap.entries()) {
      if (k.startsWith(prefix)) { pnl += dg.pnl; count += dg.trades.length; }
    }
    return { pnl, count };
  }, [dayMap, calYear, calMonth]);

  // Bottom panel content
  const bottomTrades = useMemo((): TradeData[] => {
    if (selectedDate) return dayMap.get(selectedDate)?.trades ?? [];
    if (selectedWeekIdx !== null && calendarWeeks[selectedWeekIdx]) {
      const week = calendarWeeks[selectedWeekIdx];
      return week.flatMap(cell => cell ? (dayMap.get(cell.dateKey)?.trades ?? []) : [])
        .sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime());
    }
    return [];
  }, [selectedDate, selectedWeekIdx, dayMap, calendarWeeks]);

  const bottomLabel = useMemo(() => {
    if (selectedDate) {
      const dg = dayMap.get(selectedDate);
      if (!dg) return { title: 'No trades on this day', pnl: null, count: 0 };
      const d = new Date(calYear, calMonth, dg.date);
      return {
        title: `${dg.date} ${MONTH_SHORT[calMonth]} ${calYear}`,
        pnl: dg.pnl, count: dg.trades.length,
      };
    }
    if (selectedWeekIdx !== null) {
      const ws = weekStats(calendarWeeks[selectedWeekIdx] ?? []);
      return { title: `Week ${selectedWeekIdx + 1} summary`, pnl: ws.pnl, count: ws.count };
    }
    return { title: 'Tap a date or week band to see trades', pnl: null, count: 0 };
  }, [selectedDate, selectedWeekIdx, dayMap, calendarWeeks, calYear, calMonth]);

  // ── Cancel order helper ──────────────────────────────────────
  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancellingOrderId(orderId);
      const res = await fetch('/api/orders', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        addNotification({ type: 'success', title: 'Order Cancelled', message: 'Pending order has been cancelled' });
        useTradingStore.getState().fetchOrders();
      } else {
        const data = await res.json();
        addNotification({ type: 'error', title: 'Cancel Failed', message: data.error || 'Unable to cancel order' });
      }
    } catch {
      addNotification({ type: 'error', title: 'Cancel Failed', message: 'Failed to connect to server' });
    } finally {
      setCancellingOrderId(null);
    }
  };

  // ── ORDERS view ───────────────────────────────────────────────
  if (type === 'orders') {
    if (orders.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">No orders placed yet</div>
        </div>
      );
    }
    return (
      <div style={{ overflow: 'auto', height: '100%', padding: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {orders.map((order) => {
            const sideLabel = order.side === 'BUY' ? 'B' : 'S';
            const sideClass = order.side === 'BUY' ? 'jnl-side-buy' : 'jnl-side-sell';
            const typeLabel = order.orderType === 'MARKET' ? 'M' : order.orderType === 'LIMIT' ? 'L' : order.orderType === 'SL' ? 'SL' : 'SM';
            const statusLabel = order.status === 'FILLED' ? 'F' : order.status === 'PENDING' ? 'P' : order.status === 'REJECTED' ? 'R' : 'C';
            return (
              <div key={order.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={`jnl-trade-side ${sideClass}`} style={{ padding: '2px 6px', fontSize: '11px', minWidth: 'auto' }}>{sideLabel}</span>
                  <span style={{ fontWeight: 600, fontSize: '12px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.displayName || order.symbol}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 4px', borderRadius: '4px' }}>{typeLabel}</span>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, ...(order.status === 'FILLED' ? { color: 'var(--color-profit)', background: 'var(--color-profit-bg)' } : order.status === 'REJECTED' || order.status === 'CANCELLED' ? { color: 'var(--color-loss)', background: 'var(--color-loss-bg)' } : { color: 'var(--color-warning)', background: 'rgba(255,171,0,0.1)' }) }}>{statusLabel}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{order.quantity}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>P: <span style={{ color: 'var(--text-primary)' }}>{order.filledPrice ? order.filledPrice.toFixed(2) : order.price?.toFixed(2) ?? 'MKT'}</span></span>
                    {(order.triggerPrice || order.orderType === 'SL' || order.orderType === 'SL-M') && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>T: <span style={{ color: 'var(--text-primary)' }}>{order.triggerPrice?.toFixed(2) ?? '—'}</span></span>
                    )}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatTimeOnly(order.createdAt)}</span>
                  </div>
                  {order.status === 'PENDING' ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleCancelOrder(order.id)} disabled={cancellingOrderId === order.id} style={{ padding: '2px 8px', fontSize: '10px', color: '#ef5350' }}>
                      {cancellingOrderId === order.id ? '...' : 'Cancel'}
                    </button>
                  ) : order.status === 'REJECTED' && order.rejectedReason ? (
                    <span style={{ fontSize: '9px', color: 'var(--color-loss)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.rejectedReason}>{order.rejectedReason}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── TRADES view ───────────────────────────────────────────────
  if (trades.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-text">No completed trades</div>
      </div>
    );
  }

  const todayKey = `${_today.getFullYear()}-${String(_today.getMonth()).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`;
  const isCurrentMonth = calYear === _today.getFullYear() && calMonth === _today.getMonth();

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* ── UPPER HALF: Calendar ─────────────────────────────── */}
        <div style={{ flexShrink: 0, borderBottom: '2px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>

          {/* Month header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 4px' }}>
            <button onClick={prevMonth} style={navBtn}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>
                {MONTH_NAMES[calMonth]} {calYear}
              </div>
              {monthStats.count > 0 && (
                <div style={{ fontSize: '11px', marginTop: '1px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{monthStats.count} trades · </span>
                  <span style={{ fontWeight: 700, color: monthStats.pnl >= 0 ? '#4caf50' : '#ef5350' }}>
                    {monthStats.pnl >= 0 ? '+' : ''}{formatINR(monthStats.pnl)}
                  </span>
                </div>
              )}
            </div>
            <button onClick={nextMonth} style={navBtn}>›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 4px' }}>
            {DAY_SHORT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Week rows */}
          <div style={{ padding: '0 4px 6px' }}>
            {calendarWeeks.map((week, wi) => {
              const ws = weekStats(week);
              const isSelWeek = selectedWeekIdx === wi && selectedDate === null;
              return (
                <div
                  key={wi}
                  onClick={() => { setSelectedWeekIdx(wi); setSelectedDate(null); }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7,1fr)',
                    background: isSelWeek
                      ? WEEK_COLORS[wi % 4].replace(/[\d.]+\)$/, '0.28)')
                      : WEEK_COLORS[wi % 4],
                    borderRadius: '6px',
                    marginBottom: '3px',
                    cursor: 'pointer',
                    outline: isSelWeek ? '1.5px solid rgba(255,255,255,0.2)' : 'none',
                    position: 'relative',
                  }}
                >
                  {week.map((cell, ci) => {
                    if (!cell) {
                      return <div key={ci} style={{ height: '48px' }} />;
                    }
                    const dg = dayMap.get(cell.dateKey);
                    const isToday = isCurrentMonth && cell.d === _today.getDate();
                    const isSelDate = selectedDate === cell.dateKey;
                    return (
                      <div
                        key={ci}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateKey);
                          setSelectedWeekIdx(wi);
                        }}
                        style={{
                          height: '48px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          background: isSelDate ? 'rgba(99,102,241,0.35)' : isToday ? 'rgba(255,255,255,0.08)' : 'transparent',
                          outline: isSelDate ? '1.5px solid rgba(154,180,255,0.7)' : isToday ? '1px solid rgba(255,255,255,0.2)' : 'none',
                          transition: 'background 0.15s',
                          padding: '2px',
                        }}
                      >
                        {/* Date number */}
                        <div style={{
                          fontSize: '10px',
                          fontWeight: isToday ? 800 : 600,
                          color: isToday ? '#fff' : dg ? 'var(--text-primary)' : 'var(--text-muted)',
                          lineHeight: 1,
                          marginBottom: '2px',
                        }}>
                          {cell.d}
                        </div>
                        {dg ? (
                          <>
                            {/* P&L */}
                            <div style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              color: dg.pnl >= 0 ? '#4caf50' : '#ef5350',
                              lineHeight: 1,
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              padding: '0 2px',
                            }}>
                              {dg.pnl >= 0 ? '+' : ''}{formatINR(Math.abs(dg.pnl))}
                            </div>
                            {/* Trade count */}
                            <div style={{ fontSize: '8px', color: 'var(--text-muted)', lineHeight: 1, marginTop: '1px' }}>
                              {dg.trades.length}T
                            </div>
                          </>
                        ) : null}
                      </div>
                    );
                  })}

                  {/* Week P&L chip — shows on right if week has trades */}
                  {ws.count > 0 && (
                    <div style={{
                      position: 'absolute',
                      right: '-2px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '8px',
                      fontWeight: 700,
                      color: ws.pnl >= 0 ? '#4caf50' : '#ef5350',
                      background: 'var(--bg-primary)',
                      border: `1px solid ${ws.pnl >= 0 ? 'rgba(76,175,80,0.3)' : 'rgba(239,83,80,0.3)'}`,
                      borderRadius: '4px',
                      padding: '1px 3px',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}>
                      {ws.pnl >= 0 ? '+' : ''}{formatINR(Math.abs(ws.pnl))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── LOWER HALF: Trade list ────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Bottom header */}
          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {bottomLabel.title}
            </div>
            {bottomLabel.pnl !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{bottomLabel.count}T</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: bottomLabel.pnl >= 0 ? '#4caf50' : '#ef5350' }}>
                  {bottomLabel.pnl >= 0 ? '+' : ''}{formatINR(bottomLabel.pnl)}
                </span>
              </div>
            )}
          </div>

          {/* Scrollable trade list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {bottomTrades.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                {selectedDate || selectedWeekIdx !== null
                  ? 'No trades for this selection'
                  : 'Tap a date or week band above'}
              </div>
            ) : (
              bottomTrades.map((trade) => {
                const exitLabel = trade.exitReason === 'SL_HIT' ? 'SL'
                  : trade.exitReason === 'TARGET_HIT' ? 'TGT' : 'MAN';
                const exitColor = trade.exitReason === 'SL_HIT' ? '#ef5350'
                  : trade.exitReason === 'TARGET_HIT' ? '#4caf50' : 'var(--text-muted)';
                return (
                  <div
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade)}
                    style={{
                      padding: '9px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      minHeight: '48px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                          background: trade.side === 'BUY' ? 'rgba(76,175,80,0.15)' : 'rgba(239,83,80,0.15)',
                          color: trade.side === 'BUY' ? '#4caf50' : '#ef5350',
                        }}>{trade.side}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {trade.displayName || trade.symbol}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>×{trade.quantity}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatTimeOnly(trade.entryTime)} → {formatTimeOnly(trade.exitTime)}
                        <span style={{ marginLeft: '6px', color: exitColor }}>{exitLabel}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: trade.pnl >= 0 ? '#4caf50' : '#ef5350' }}>
                        {trade.pnl >= 0 ? '+' : ''}{formatINR(trade.pnl)}
                      </div>
                      {trade.notes && (
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>N</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selectedTrade && (
        <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      )}
    </>
  );
}

// ── Shared styles ────────────────────────────────────────────────
const navBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'var(--text-primary)',
  borderRadius: '6px',
  width: '28px',
  height: '28px',
  fontSize: '18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};
