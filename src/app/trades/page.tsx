'use client';

import { useEffect, useState, useMemo } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { TradingSidebar } from '@/components/common/TradingSidebar';
import { TradeHistory } from '@/components/Trading/TradeHistory';
import { MobileBottomNav } from '@/components/common/MobileBottomNav';
import { useMarketStore, registerTickPositionUpdater } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { formatINR, formatCompact } from '@/lib/utils/formatters';
import type { Tick } from '@/types/market';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toISTDate(ts: string | number | Date) {
  const d = new Date(ts);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDay(),
    date: ist.getUTCDate(),
  };
}

function Infographics() {
  const trades = useTradingStore(s => s.trades);

  // ── Monthly rollup (last 12 months) ─────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const t of trades) {
      const { year, month } = toISTDate(t.exitTime);
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!map[key]) map[key] = { pnl: 0, count: 0, wins: 0 };
      map[key].pnl += t.pnl;
      map[key].count++;
      if (t.pnl > 0) map[key].wins++;
    }
    // Build last 12 months
    const now = new Date();
    const months: Array<{ key: string; label: string; year: number; month: number; pnl: number; count: number; wins: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      months.push({
        key,
        label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        ...(map[key] ?? { pnl: 0, count: 0, wins: 0 }),
      });
    }
    return months;
  }, [trades]);

  // ── Weekly rollup (last 8 weeks) ────────────────────────────
  const weeklyData = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number; label: string }> = {};
    for (const t of trades) {
      const ist = new Date(new Date(t.exitTime).getTime() + 5.5 * 60 * 60 * 1000);
      // ISO week: Mon-based
      const day = ist.getUTCDay();
      const monday = new Date(ist);
      monday.setUTCDate(ist.getUTCDate() - ((day + 6) % 7));
      const key = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth()).padStart(2,'0')}-${String(monday.getUTCDate()).padStart(2,'0')}`;
      if (!map[key]) {
        const endFri = new Date(monday);
        endFri.setUTCDate(monday.getUTCDate() + 4);
        map[key] = {
          pnl: 0, count: 0, wins: 0,
          label: `${monday.getUTCDate()} ${MONTH_SHORT[monday.getUTCMonth()]}`,
        };
      }
      map[key].pnl += t.pnl;
      map[key].count++;
      if (t.pnl > 0) map[key].wins++;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([, v]) => v);
  }, [trades]);

  // ── Day-of-week breakdown ────────────────────────────────────
  const dowData = useMemo(() => {
    const map: Record<number, { pnl: number; count: number; wins: number }> = {};
    for (let i = 0; i < 7; i++) map[i] = { pnl: 0, count: 0, wins: 0 };
    for (const t of trades) {
      const { day } = toISTDate(t.exitTime);
      map[day].pnl += t.pnl;
      map[day].count++;
      if (t.pnl > 0) map[day].wins++;
    }
    return map;
  }, [trades]);

  // ── Overall stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!trades.length) return null;
    const total = trades.length;
    const wins = trades.filter(t => t.pnl > 0).length;
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const avgPnl = totalPnl / total;
    const best = Math.max(...trades.map(t => t.pnl));
    const worst = Math.min(...trades.map(t => t.pnl));
    const avgWin = wins > 0 ? trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins : 0;
    const losses = total - wins;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / losses) : 0;
    const rr = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—';
    return { total, wins, losses, totalPnl, avgPnl, best, worst, winRate: Math.round((wins / total) * 100), rr };
  }, [trades]);

  // ── Bar chart helper ─────────────────────────────────────────
  function BarChart({ data, height = 120 }: { data: { label: string; pnl: number; count: number }[]; height?: number }) {
    const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: `${height + 24}px`, paddingBottom: '24px', position: 'relative' }}>
        {/* Zero line */}
        <div style={{ position: 'absolute', bottom: '24px', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
        {data.map((d, i) => {
          const pct = (Math.abs(d.pnl) / maxAbs) * height * 0.9;
          const isPos = d.pnl >= 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '2px' }}>
              {/* Bar grows upward from zero line */}
              <div style={{
                width: '100%',
                height: `${pct}px`,
                background: isPos
                  ? 'linear-gradient(to top, #4caf50, rgba(76,175,80,0.5))'
                  : 'linear-gradient(to top, #ef5350, rgba(239,83,80,0.5))',
                borderRadius: '3px 3px 0 0',
                minHeight: d.pnl !== 0 ? '3px' : '0',
                transition: 'height 0.3s ease',
              }} title={`${d.label}: ${formatINR(d.pnl)} (${d.count}T)`} />
              <div style={{ fontSize: '8px', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' }}>
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '13px' }}>
        No trade data yet
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Summary stat cards ────────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
          {[
            { label: 'Total Trades', value: String(stats.total), sub: `${stats.wins}W / ${stats.losses}L` },
            { label: 'Win Rate', value: `${stats.winRate}%`, sub: `${stats.wins} winners`, color: stats.winRate >= 50 ? '#4caf50' : '#ef5350' },
            { label: 'Best Day', value: formatCompact(stats.best), sub: 'single trade', color: '#4caf50' },
            { label: 'Worst Day', value: formatCompact(Math.abs(stats.worst)), sub: 'single trade', color: '#ef5350' },
            { label: 'Avg Trade', value: formatCompact(Math.abs(stats.avgPnl)), sub: stats.avgPnl >= 0 ? 'profitable avg' : 'loss avg', color: stats.avgPnl >= 0 ? '#4caf50' : '#ef5350' },
            { label: 'Total P&L', value: formatINR(stats.totalPnl), sub: 'all time', color: stats.totalPnl >= 0 ? '#4caf50' : '#ef5350' },
            { label: 'Avg Win', value: formatCompact(stats.wins > 0 ? trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / stats.wins : 0), sub: 'per winner', color: '#4caf50' },
            { label: 'Risk:Reward', value: stats.rr, sub: 'avg W / avg L' },
          ].map((card, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: card.color ?? 'var(--text-bright)', lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Monthly P&L Chart ─────────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '12px 14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Monthly P&L
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400 }}>Last 12 months</span>
        </div>
        <BarChart data={monthlyData.map(m => ({ label: m.label, pnl: m.pnl, count: m.count }))} height={100} />
        {/* Month summary rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', borderTop: '1px solid var(--border-primary)', paddingTop: '8px' }}>
          {monthlyData.filter(m => m.count > 0).slice(-6).map(m => (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>{m.label}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{m.count} trades · {Math.round((m.wins / m.count) * 100)}% WR</span>
              <span style={{ fontWeight: 700, color: m.pnl >= 0 ? '#4caf50' : '#ef5350' }}>{m.pnl >= 0 ? '+' : ''}{formatINR(m.pnl)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Weekly P&L Chart ──────────────────────────────────── */}
      {weeklyData.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Weekly P&L
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400 }}>Last 10 weeks</span>
          </div>
          <BarChart data={weeklyData.map(w => ({ label: w.label, pnl: w.pnl, count: w.count }))} height={80} />
        </div>
      )}

      {/* ── Day-of-week breakdown ──────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '12px 14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
          Day of Week Performance
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
          {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
            const d = dowData[dayIdx];
            const wr = d.count > 0 ? Math.round((d.wins / d.count) * 100) : null;
            return (
              <div key={dayIdx} style={{
                background: d.count > 0
                  ? d.pnl >= 0 ? 'rgba(76,175,80,0.12)' : 'rgba(239,83,80,0.12)'
                  : 'rgba(255,255,255,0.03)',
                borderRadius: '6px',
                padding: '8px 4px',
                textAlign: 'center',
                border: `1px solid ${d.count > 0 ? (d.pnl >= 0 ? 'rgba(76,175,80,0.3)' : 'rgba(239,83,80,0.3)') : 'var(--border-primary)'}`,
              }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{DOW_LABELS[dayIdx]}</div>
                {d.count > 0 ? (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: d.pnl >= 0 ? '#4caf50' : '#ef5350' }}>
                      {d.pnl >= 0 ? '+' : '-'}{formatCompact(Math.abs(d.pnl))}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{d.count}T · {wr}%</div>
                  </>
                ) : (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default function TradesPage() {
  const initSocket = useMarketStore(s => s.initSocket);
  const [activeTab, setActiveTab] = useState<'history' | 'infographics'>('history');

  useEffect(() => {
    registerTickPositionUpdater((incoming: Tick[]) => {
      const state = useTradingStore.getState();
      const tickMap: Record<string, number> = {};
      incoming.forEach(t => { tickMap[t.symbol] = t.ltp; });
      let changed = false;
      const updated = state.positions.map(pos => {
        if (pos.isOpen && tickMap[pos.symbol] !== undefined) {
          const ltp = tickMap[pos.symbol];
          const pnl = pos.side === 'BUY'
            ? (ltp - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - ltp) * pos.quantity;
          changed = true;
          return { ...pos, currentPrice: ltp, pnl };
        }
        return pos;
      });
      if (changed) state.setPositions(updated);
    });

    useTradingStore.getState().fetchAccount();
    useTradingStore.getState().fetchPositions().then(() => {
      const open = useTradingStore.getState().positions.filter(p => p.isOpen).map(p => p.symbol);
      if (open.length) useMarketStore.getState().subscribePositionSymbols(open);
    });
    useTradingStore.getState().fetchOrders();
    useTradingStore.getState().fetchTrades();
    initSocket();
  }, [initSocket]);

  return (
    <ProtectedRoute>
      <div className="h-screen bg-surface font-sans flex flex-col overflow-hidden">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <SideNav />
          <div className="flex flex-1 md:ml-20 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="page-heading-bar">
                <span className="page-heading-title">Trading Journal</span>
                <span className="page-heading-meta">Track, review and analyse your trades</span>
              </div>

              {/* Tab bar */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)',
                flexShrink: 0,
              }}>
                {([
                  { key: 'history', label: 'Trade History' },
                  { key: 'infographics', label: 'Infographics & Analysis' },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '10px 20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: activeTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent',
                      color: activeTab === tab.key ? 'var(--color-accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'color 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto pb-16 md:pb-0">
                {activeTab === 'history'
                  ? <TradeHistory type="trades" />
                  : <Infographics />
                }
              </div>
            </div>
            <TradingSidebar />
          </div>
        </div>
        <ToastContainer />
        <MobileBottomNav />
      </div>
    </ProtectedRoute>
  );
}
