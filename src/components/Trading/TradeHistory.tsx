'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { formatINR, formatPnL, formatDateTime } from '@/lib/utils/formatters';
import { TradeDetailModal } from './TradeDetailModal';
import { TradeData } from '@/types/trading';

interface TradeHistoryProps {
  type: 'orders' | 'trades';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toIST(timestamp: number | string | Date) {
  const d = new Date(timestamp);
  const offset = 5.5 * 60 * 60 * 1000;
  return new Date(d.getTime() + offset);
}

function getISTDate(timestamp: number | string | Date) {
  const ist = toIST(timestamp);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth(), date: ist.getUTCDate(), day: ist.getUTCDay() };
}

function getWeekOfMonth(date: number, firstDayOfMonth: number): number {
  return Math.ceil((date + firstDayOfMonth) / 7);
}

function getMonday(year: number, month: number, date: number): Date {
  const d = new Date(year, month, date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(year, month, date + diff);
}

function getFriday(year: number, month: number, date: number): Date {
  const d = new Date(year, month, date);
  const day = d.getDay();
  const diff = day === 0 ? -1 : 5 - day;
  return new Date(year, month, date + diff);
}

function formatTimeOnly(timestamp: number | string | Date): string {
  const ist = toIST(timestamp);
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface DayGroup {
  dateKey: string;
  year: number;
  month: number;
  date: number;
  day: number;
  trades: TradeData[];
  pnl: number;
  wins: number;
  losses: number;
}

interface WeekGroup {
  weekKey: string;
  weekNum: number;
  monDate: Date;
  friDate: Date;
  days: DayGroup[];
  pnl: number;
  tradeCount: number;
  wins: number;
  losses: number;
}

interface MonthGroup {
  monthKey: string;
  year: number;
  month: number;
  weeks: WeekGroup[];
  pnl: number;
  tradeCount: number;
  wins: number;
  losses: number;
}

function PnlBadge({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = value > 0 ? 'jnl-pnl-profit' : value < 0 ? 'jnl-pnl-loss' : 'jnl-pnl-neutral';
  const sizeClass = `jnl-pnl-${size}`;
  const text = value > 0 ? `+${formatINR(value)}` : value < 0 ? `-${formatINR(Math.abs(value))}` : formatINR(0);
  return <span className={`jnl-pnl ${cls} ${sizeClass}`}>{text}</span>;
}

function WinLossBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) return null;
  const winPct = (wins / total) * 100;
  return (
    <div className="jnl-winloss">
      <div className="jnl-winloss-bar">
        <div className="jnl-winloss-fill" style={{ width: `${winPct}%` }} />
      </div>
      <span className="jnl-winloss-text">{wins}W {losses}L</span>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="jnl-stat-pill">
      <span className="jnl-stat-label">{label}</span>
      <span className="jnl-stat-value">{value}</span>
    </span>
  );
}

export function TradeHistory({ type }: TradeHistoryProps) {
  const orders = useTradingStore((s) => s.orders);
  const trades = useTradingStore((s) => s.trades);
  const addNotification = useUIStore((s) => s.addNotification);
  const [selectedTrade, setSelectedTrade] = useState<TradeData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancellingOrderId(orderId);
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      if (res.ok) {
        addNotification({
          type: 'success',
          title: 'Order Cancelled',
          message: 'Pending order has been cancelled',
        });
        useTradingStore.getState().fetchOrders();
      } else {
        const data = await res.json();
        addNotification({
          type: 'error',
          title: 'Cancel Failed',
          message: data.error || 'Unable to cancel order',
        });
      }
    } catch {
      addNotification({
        type: 'error',
        title: 'Cancel Failed',
        message: 'Failed to connect to server',
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const hierarchy = useMemo((): MonthGroup[] => {
    const dayMap = new Map<string, DayGroup>();

    for (const trade of trades) {
      const { year, month, date, day } = getISTDate(trade.exitTime);
      const dk = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      if (!dayMap.has(dk)) {
        dayMap.set(dk, { dateKey: dk, year, month, date, day, trades: [], pnl: 0, wins: 0, losses: 0 });
      }
      const dg = dayMap.get(dk)!;
      dg.trades.push(trade);
      dg.pnl += trade.pnl;
      if (trade.pnl > 0) dg.wins++;
      else if (trade.pnl < 0) dg.losses++;
    }

    const weekMap = new Map<string, WeekGroup>();
    for (const dg of dayMap.values()) {
      const mon = getMonday(dg.year, dg.month, dg.date);
      const fri = getFriday(dg.year, dg.month, dg.date);
      const wk = `${dg.year}-${String(dg.month).padStart(2, '0')}-W${String(mon.getDate()).padStart(2, '0')}`;
      if (!weekMap.has(wk)) {
        const firstOfMonth = new Date(dg.year, dg.month, 1).getDay();
        weekMap.set(wk, {
          weekKey: wk,
          weekNum: getWeekOfMonth(mon.getDate(), firstOfMonth),
          monDate: mon,
          friDate: fri,
          days: [],
          pnl: 0,
          tradeCount: 0,
          wins: 0,
          losses: 0,
        });
      }
      const wg = weekMap.get(wk)!;
      wg.days.push(dg);
      wg.pnl += dg.pnl;
      wg.tradeCount += dg.trades.length;
      wg.wins += dg.wins;
      wg.losses += dg.losses;
    }

    for (const wg of weekMap.values()) {
      wg.days.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    }

    const monthMap = new Map<string, MonthGroup>();
    for (const wg of weekMap.values()) {
      const sample = wg.days[0];
      const mk = `${sample.year}-${String(sample.month).padStart(2, '0')}`;
      if (!monthMap.has(mk)) {
        monthMap.set(mk, {
          monthKey: mk,
          year: sample.year,
          month: sample.month,
          weeks: [],
          pnl: 0,
          tradeCount: 0,
          wins: 0,
          losses: 0,
        });
      }
      const mg = monthMap.get(mk)!;
      mg.weeks.push(wg);
      mg.pnl += wg.pnl;
      mg.tradeCount += wg.tradeCount;
      mg.wins += wg.wins;
      mg.losses += wg.losses;
    }

    const months = Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    for (const mg of months) {
      mg.weeks.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
    }

    return months;
  }, [trades]);

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
      <div style={{ overflow: 'auto', height: '100%' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Instrument</th>
              <th>Side</th>
              <th>Type</th>
              <th className="right">Qty</th>
              <th className="right">Price</th>
              <th className="right">Trigger</th>
              <th className="center">Status</th>
              <th className="center">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={{ color: 'var(--text-muted)' }}>
                  {formatDateTime(order.createdAt)}
                </td>
                <td style={{ fontWeight: 600 }}>{order.displayName || order.symbol}</td>
                <td>
                  <span className={order.side === 'BUY' ? 'buy-side' : 'sell-side'}
                    style={{ fontWeight: 600 }}
                  >
                    {order.side}
                  </span>
                </td>
                <td>{order.orderType}</td>
                <td className="right">{order.quantity}</td>
                <td className="right">
                  {order.filledPrice
                    ? order.filledPrice.toFixed(2)
                    : order.price?.toFixed(2) ?? 'MKT'}
                </td>
                <td className="right">{order.triggerPrice?.toFixed(2) ?? '—'}</td>
                <td className="center">
                  <div style={{ display: 'grid', justifyItems: 'center', gap: '2px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      ...(order.status === 'FILLED' ? {
                        color: 'var(--color-profit)',
                        background: 'var(--color-profit-bg)',
                      } : order.status === 'REJECTED' || order.status === 'CANCELLED' ? {
                        color: 'var(--color-loss)',
                        background: 'var(--color-loss-bg)',
                      } : {
                        color: 'var(--color-warning)',
                        background: 'rgba(255, 171, 0, 0.1)',
                      }),
                    }}>
                      {order.status}
                    </span>
                    {order.status === 'REJECTED' && order.rejectedReason && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '160px', whiteSpace: 'normal' }}>
                        {order.rejectedReason}
                      </span>
                    )}
                  </div>
                </td>
                <td className="center">
                  {order.status === 'PENDING' ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingOrderId === order.id}
                      style={{ padding: '2px 8px', fontSize: '10px', color: '#ef5350' }}
                    >
                      {cancellingOrderId === order.id ? '...' : 'Cancel'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-text">No completed trades</div>
      </div>
    );
  }

  return (
    <>
      <div className="jnl-container">
        {hierarchy.map((mg) => {
          const mKey = `m-${mg.monthKey}`;
          const mOpen = expanded.has(mKey);
          return (
            <div key={mKey} className="jnl-month">
              <button className="jnl-month-header" onClick={() => toggle(mKey)}>
                <span className="jnl-arrow">{mOpen ? '▾' : '▸'}</span>
                <span className="jnl-month-title">{MONTH_NAMES[mg.month]} {mg.year}</span>
                <StatPill label="Trades" value={mg.tradeCount} />
                <WinLossBar wins={mg.wins} losses={mg.losses} />
                <PnlBadge value={mg.pnl} size="lg" />
              </button>

              {mOpen && mg.weeks.map((wg) => {
                const wKey = `w-${wg.weekKey}`;
                const wOpen = expanded.has(wKey);
                const monD = wg.monDate;
                const friD = wg.friDate;
                const weekLabel = `${monD.getDate()} ${MONTH_SHORT[monD.getMonth()]} - ${friD.getDate()} ${MONTH_SHORT[friD.getMonth()]}`;
                return (
                  <div key={wKey} className="jnl-week">
                    <button className="jnl-week-header" onClick={() => toggle(wKey)}>
                      <span className="jnl-arrow">{wOpen ? '▾' : '▸'}</span>
                      <span className="jnl-week-title">Week ({weekLabel})</span>
                      <StatPill label="Trades" value={wg.tradeCount} />
                      <WinLossBar wins={wg.wins} losses={wg.losses} />
                      <PnlBadge value={wg.pnl} size="md" />
                    </button>

                    {wOpen && wg.days.map((dg) => {
                      const dKey = `d-${dg.dateKey}`;
                      const dOpen = expanded.has(dKey);
                      const today = new Date();
                      const isToday = dg.year === today.getFullYear() && dg.month === today.getMonth() && dg.date === today.getDate();
                      return (
                        <div key={dKey} className="jnl-day">
                          <button className={`jnl-day-header ${isToday ? 'jnl-day-today' : ''}`} onClick={() => toggle(dKey)}>
                            <span className="jnl-arrow">{dOpen ? '▾' : '▸'}</span>
                            <span className="jnl-day-name">{DAY_SHORT[dg.day]}</span>
                            <span className="jnl-day-date">{dg.date} {MONTH_SHORT[dg.month]}</span>
                            {isToday && <span className="jnl-today-badge">Today</span>}
                            <span className="jnl-day-count">{dg.trades.length}</span>
                            <WinLossBar wins={dg.wins} losses={dg.losses} />
                            <PnlBadge value={dg.pnl} size="sm" />
                          </button>

                          {dOpen && (
                            <div className="jnl-trades">
                              {dg.trades.map((trade) => {
                                const pnl = formatPnL(trade.pnl);
                                const exitLabel = trade.exitReason === 'SL_HIT' ? 'SL' :
                                  trade.exitReason === 'TARGET_HIT' ? 'TGT' :
                                  trade.exitReason === 'MANUAL' ? 'MAN' : trade.exitReason || 'MAN';
                                const exitCls = trade.exitReason === 'SL_HIT' ? 'jnl-exit-sl' :
                                  trade.exitReason === 'TARGET_HIT' ? 'jnl-exit-tgt' : 'jnl-exit-man';
                                const hasNotes = !!trade.notes;
                                const hasScreenshot = !!trade.screenshotUrl;
                                return (
                                  <div
                                    key={trade.id}
                                    className="jnl-trade-card"
                                    onClick={() => setSelectedTrade(trade)}
                                  >
                                    <div className="jnl-trade-row1">
                                      <span className={`jnl-trade-side ${trade.side === 'BUY' ? 'jnl-side-buy' : 'jnl-side-sell'}`}>
                                        {trade.side}
                                      </span>
                                      <span className="jnl-trade-name">{trade.displayName || trade.symbol}</span>
                                      <span className="jnl-trade-qty">x{trade.quantity}</span>
                                      <span className={`jnl-exit-tag ${exitCls}`}>{exitLabel}</span>
                                      {(hasNotes || hasScreenshot) && (
                                        <span className="jnl-trade-info">
                                          {hasNotes && <span title="Has notes">N</span>}
                                          {hasScreenshot && <span title="Has screenshot">S</span>}
                                        </span>
                                      )}
                                      <span className={`jnl-trade-pnl ${pnl.className}`}>{pnl.text}</span>
                                    </div>
                                    <div className="jnl-trade-row2">
                                      <span className="jnl-trade-time">{formatTimeOnly(trade.entryTime)}</span>
                                      <span className="jnl-trade-price">{trade.entryPrice.toFixed(2)}</span>
                                      <span className="jnl-trade-arrow">&rarr;</span>
                                      <span className="jnl-trade-price">{trade.exitPrice.toFixed(2)}</span>
                                      <span className="jnl-trade-time">{formatTimeOnly(trade.exitTime)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </>
  );
}
