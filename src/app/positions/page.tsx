'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore, registerTickPositionUpdater } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { formatINR } from '@/lib/utils/formatters';
import type { Tick } from '@/types/market';

export default function PositionsPage() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [filter, setFilter] = useState('');
  const [closing, setClosing] = useState<string | null>(null);

  const initSocket = useMarketStore(s => s.initSocket);
  const ticks = useMarketStore(s => s.ticks);
  const account = useTradingStore(s => s.account);
  const positions = useTradingStore(s => s.positions);
  const trades = useTradingStore(s => s.trades);
  const addNotification = useUIStore(s => s.addNotification);

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
    useTradingStore.getState().fetchTrades();
    initSocket();
  }, [initSocket]);

  const handleClose = async (positionId: string, symbol: string) => {
    setClosing(positionId);
    try {
      const tick = ticks[symbol];
      const res = await fetch('/api/positions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, exitPrice: tick?.ltp }),
      });
      if (res.ok) {
        const data = await res.json();
        addNotification({
          type: data.pnl >= 0 ? 'success' : 'error',
          title: 'Position Closed',
          message: `P&L: ${data.pnl >= 0 ? '+' : ''}${formatINR(data.pnl)}`,
        });
        useTradingStore.getState().fetchPositions();
        useTradingStore.getState().fetchAccount();
        useTradingStore.getState().fetchTrades();
      }
    } finally {
      setClosing(null);
    }
  };

  // ── Derived data ───────────────────────────────────────────
  const openPositions = positions.filter(p => p.isOpen);
  const closedPositions = positions.filter(p => !p.isOpen);

  const totalUnrealizedPnl = openPositions.reduce((sum, pos) => {
    const ltp = ticks[pos.symbol]?.ltp ?? pos.currentPrice;
    const pnl = pos.side === 'BUY'
      ? (ltp - pos.entryPrice) * pos.quantity
      : (pos.entryPrice - ltp) * pos.quantity;
    return sum + pnl;
  }, 0);

  const usedMargin = account?.usedMargin ?? 0;
  const availCash = account?.availableMargin ?? account?.balance ?? 0;
  const realizedPnl = account?.realizedPnl ?? 0;

  // Win trades (for risk metrics)
  const winTrades = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? Math.round((winTrades / trades.length) * 100) : 0;
  const maxDrawdown = trades.length > 0
    ? Math.abs(Math.min(0, Math.min(...trades.map(t => t.pnl))))
    : 0;

  // Filter logic
  const filtered = (tab === 'open' ? openPositions : closedPositions).filter(p =>
    filter === '' || (p.displayName || p.symbol).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-surface font-sans">
        <TopNav />

        {/* Main content — centered with max-width */}
        <main className="max-w-screen-2xl mx-auto p-8 lg:p-12 transition-all duration-300">
          {/* ── Header ──────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <h1 className="text-5xl font-extrabold text-on-background tracking-tighter mb-3">
                Precision Positions
              </h1>
              <p className="text-on-surface-variant leading-relaxed text-base max-w-xl">
                Real-time ledger of your open market liabilities and asset holdings. Managed
                with precision and heritage-grade accuracy.
              </p>
            </div>
            <div className="flex gap-4 items-end">
              <div className="bg-surface-container-low px-6 py-3 rounded-lg flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
                  Total Unrealized P&L
                </span>
                <span className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-primary' : 'text-error'}`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}{formatINR(totalUnrealizedPnl)}
                </span>
              </div>
              <Link
                href="/trade"
                className="bg-primary-container text-on-primary-fixed px-7 py-4 rounded-lg font-bold flex items-center gap-2 hover:brightness-95 transition-all text-sm"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                New Order
              </Link>
            </div>
          </div>

          {/* ── Bento Grid ──────────────────────────────── */}
          <div className="grid grid-cols-12 gap-6 mb-10">

            {/* Positions Table Card */}
            <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border-b-2 border-primary-container flex flex-col">
              {/* Tabs + filter */}
              <div className="bg-surface-container-high px-8 py-4 flex justify-between items-center">
                <div className="flex gap-8">
                  <button
                    onClick={() => setTab('open')}
                    className={`text-sm font-bold pb-1 transition-all ${tab === 'open'
                      ? 'border-b-2 border-primary text-on-surface'
                      : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    Open Positions ({openPositions.length})
                  </button>
                  <button
                    onClick={() => setTab('closed')}
                    className={`text-sm font-medium pb-1 transition-all ${tab === 'closed'
                      ? 'border-b-2 border-primary text-on-surface font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    Closed History
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-1.5 rounded text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">search</span>
                  <input
                    type="text"
                    placeholder="Filter symbol..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="bg-transparent border-none focus:outline-none p-0 text-sm placeholder:text-on-surface-variant/50 w-28"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto flex-1">
                {filtered.length === 0 ? (
                  <div className="px-8 py-16 text-center text-on-surface-variant text-sm">
                    {tab === 'open' ? 'No open positions.' : 'No closed positions.'}&nbsp;
                    {tab === 'open' && (
                      <Link href="/trade" className="text-primary font-bold underline">
                        Start trading
                      </Link>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-on-background">
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Symbol</th>
                        <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Qty</th>
                        <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Avg Price</th>
                        <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">LTP</th>
                        <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Unrealized P&L</th>
                        <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">SL / Target</th>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-highest">
                      {filtered.map(pos => {
                        const ltp = ticks[pos.symbol]?.ltp ?? pos.currentPrice;
                        const pnl = pos.isOpen
                          ? (pos.side === 'BUY'
                            ? (ltp - pos.entryPrice) * pos.quantity
                            : (pos.entryPrice - ltp) * pos.quantity)
                          : pos.pnl;
                        const pnlPct = pos.entryPrice > 0
                          ? ((pnl / (pos.entryPrice * pos.quantity)) * 100).toFixed(2)
                          : '0.00';

                        return (
                          <tr key={pos.id} className="hover:bg-surface-container-low transition-colors group">
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="font-bold text-on-surface text-sm">
                                  {pos.displayName || pos.symbol}
                                </span>
                                <span className="text-[10px] text-on-surface-variant">
                                  {pos.instrumentType} &middot; {pos.side}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-5 text-right font-medium text-sm">{pos.quantity}</td>
                            <td className="px-4 py-5 text-right font-medium text-sm font-mono">
                              ₹{pos.entryPrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-5 text-right font-bold text-sm font-mono">
                              ₹{ltp.toFixed(2)}
                            </td>
                            <td className="px-4 py-5 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-bold text-sm ${pnl >= 0 ? 'text-primary' : 'text-error'}`}>
                                  {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                                </span>
                                <span className={`text-[10px] ${pnl >= 0 ? 'text-primary/80' : 'text-error/80'}`}>
                                  {pnl >= 0 ? '+' : ''}{pnlPct}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-5 text-right">
                              {pos.isOpen ? (
                                <div className="flex flex-col items-end gap-1 text-[11px] font-medium">
                                  {pos.stopLoss && (
                                    <span className="bg-error-container text-on-error-container px-1.5 py-0.5 rounded">
                                      SL: ₹{pos.stopLoss.toFixed(2)}
                                    </span>
                                  )}
                                  {pos.targetPrice && (
                                    <span className="bg-primary-container text-on-primary-fixed px-1.5 py-0.5 rounded">
                                      T1: ₹{pos.targetPrice.toFixed(2)}
                                    </span>
                                  )}
                                  {!pos.stopLoss && !pos.targetPrice && (
                                    <span className="text-on-surface-variant/50">—</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-on-surface-variant">
                                  {pos.exitReason ?? 'Closed'}
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-5 text-right">
                              {pos.isOpen && (
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Link
                                    href="/trade"
                                    className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-primary"
                                    title="Modify in terminal"
                                  >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                  </Link>
                                  <button
                                    onClick={() => handleClose(pos.id, pos.symbol)}
                                    disabled={closing === pos.id}
                                    className="p-1.5 hover:bg-error-container rounded transition-colors text-error disabled:opacity-50"
                                    title="Close Position"
                                  >
                                    <span className="material-symbols-outlined text-lg">
                                      {closing === pos.id ? 'hourglass_empty' : 'close'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Risk Metrics Sidebar */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              {/* Risk Metrics */}
              <div className="bg-surface-container-lowest rounded-xl p-7 flex flex-col border-l-4 border-primary flex-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-5">
                  Precision Risk Metrics
                </span>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
                  Your exposure is monitored in real-time. Auto-stops are calculated based on
                  position size and account equity.
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center py-2 border-b border-surface-container-highest">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Margin Used</span>
                    <span className="text-sm font-bold text-on-surface">{formatINR(usedMargin)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-surface-container-highest">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Available Cash</span>
                    <span className="text-sm font-bold text-on-surface">{formatINR(availCash)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-surface-container-highest">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Realized P&L</span>
                    <span className={`text-sm font-bold ${realizedPnl >= 0 ? 'text-green-600' : 'text-error'}`}>
                      {realizedPnl >= 0 ? '+' : ''}{formatINR(realizedPnl)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Max Single Loss</span>
                    <span className="text-sm font-bold text-error">
                      {maxDrawdown > 0 ? `-${formatINR(maxDrawdown)}` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SahaAI Signal card */}
              <div className="bg-on-background text-white p-7 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="material-symbols-outlined text-primary-container mb-3 block text-2xl">
                    auto_awesome
                  </span>
                  <h4 className="font-bold text-lg mb-2">SahaAI Signal</h4>
                  <p className="text-xs text-surface-dim leading-relaxed">
                    {openPositions.length > 0
                      ? `Monitoring ${openPositions.length} open position${openPositions.length > 1 ? 's' : ''}. Win rate: ${winRate}% across ${trades.length} trades.`
                      : 'No active positions. Place a trade from the terminal to receive live signals.'}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-primary-container h-full rounded-full transition-all duration-500"
                      style={{ width: `${winRate}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold whitespace-nowrap">{winRate}% Win Rate</span>
                </div>
                <Link
                  href="/signal-log"
                  className="mt-5 text-[10px] font-bold uppercase tracking-widest text-primary-container flex items-center gap-1"
                >
                  <div className="w-1 h-1 bg-primary-container rounded-full" />
                  View Signal Log
                </Link>
              </div>
            </div>
          </div>

          {/* ── Risk detail strip ───────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t-2 border-surface-container-highest pt-10">
            <div>
              <h3 className="text-xl font-bold tracking-tight mb-3">Risk Overview</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Position sizing and stop losses are critical to capital preservation. Review each
                position regularly.
              </p>
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-4">
              <div className="bg-surface-container-low p-5 rounded-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Open Positions</p>
                <p className="text-2xl font-black text-on-background">{openPositions.length}</p>
              </div>
              <div className="bg-surface-container-low p-5 rounded-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Total Trades</p>
                <p className="text-2xl font-black text-on-background">{trades.length}</p>
              </div>
              <div className="bg-surface-container-low p-5 rounded-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Win Rate</p>
                <p className="text-2xl font-black text-on-background">{winRate}%</p>
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* FAB */}
      <div className="fixed bottom-8 right-8 z-50">
        <Link
          href="/trade"
          className="w-14 h-14 bg-primary-container text-on-primary-fixed rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          title="Open Trading Terminal"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            bolt
          </span>
        </Link>
      </div>

      <ToastContainer />
    </ProtectedRoute>
  );
}
