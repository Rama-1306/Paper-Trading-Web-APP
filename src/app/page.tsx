'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { MobileBottomNav } from '@/components/common/MobileBottomNav';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore, registerTickPositionUpdater } from '@/stores/marketStore';
import { formatINR } from '@/lib/utils/formatters';
import type { Tick } from '@/types/market';

export default function PortfolioDashboard() {
  const { data: session } = useSession();
  const initSocket = useMarketStore(s => s.initSocket);
  const ticks = useMarketStore(s => s.ticks);
  const account = useTradingStore(s => s.account);
  const positions = useTradingStore(s => s.positions);
  const trades = useTradingStore(s => s.trades);
  const orders = useTradingStore(s => s.orders);

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

  // ── Derived stats ──────────────────────────────────────────
  const balance = account?.balance ?? 0;
  const initial = account?.initialBalance ?? 0;
  const usedMargin = account?.usedMargin ?? 0;
  const realizedPnl = account?.realizedPnl ?? 0;

  const openPositions = positions.filter(p => p.isOpen);

  const unrealizedPnl = openPositions.reduce((sum, pos) => {
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
  const netLiquidity = balance + unrealizedPnl;
  const marginPct = initial > 0 ? ((usedMargin / initial) * 100).toFixed(1) : '0.0';
  const buyingPower = balance - usedMargin;
  const bpPct = initial > 0 ? Math.min(100, (buyingPower / initial) * 100) : 0;

  // Best / worst P&L position for analytics
  const pnlValues = openPositions.map(p => p.pnl);
  const maxDrawdown = pnlValues.length ? Math.min(0, Math.min(...pnlValues)) : 0;
  const winTrades = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? Math.round((winTrades / trades.length) * 100) : 0;

  // Recent trades (last 3)
  const recentTrades = [...trades].sort(
    (a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
  ).slice(0, 3);

  // Pending orders count
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-surface font-sans">
        <TopNav />

        <div className="flex">
          <SideNav />

          {/* Main content — centered with max-width */}
          <main className="flex-1 md:ml-20 p-4 md:p-8 lg:p-12 pb-20 md:pb-12 transition-all duration-300">
            <div className="space-y-8">

              {/* ── Hero Header ──────────────────────────────── */}
              <header className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div className="space-y-2">
                  <Image
                    src="/sahaai-logo.png"
                    alt="SAHAAI"
                    width={160}
                    height={56}
                    className="h-12 w-auto object-contain"
                    priority
                  />
                  {session?.user?.name && (
                    <p className="text-sm font-semibold text-on-surface-variant">
                      Welcome, {session.user.name}
                    </p>
                  )}
                  <h1 className="text-4xl font-extrabold tracking-tighter text-on-background">
                    Portfolio Overview
                  </h1>
                </div>
                <div className="bg-surface-container-low px-4 py-2 rounded-xl flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant">Open Positions</p>
                    <p className="text-xs font-bold flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${openPositions.length > 0 ? 'bg-green-500' : 'bg-surface-dim'}`} />
                      {openPositions.length} Active
                    </p>
                  </div>
                  <div className="w-px h-8 bg-surface-dim" />
                  <div>
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant">Pending Orders</p>
                    <p className="text-xs font-bold">{pendingCount} Pending</p>
                  </div>
                </div>
              </header>

              {/* ── Bento Grid ───────────────────────────────── */}
              <div className="grid grid-cols-12 gap-6">

                {/* Account Summary Card */}
                <section className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col md:flex-row shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)]">
                  {/* Net Liquidity */}
                  <div className="md:w-1/3 bg-surface-container-high p-8 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mb-1">
                        Net Liquidity
                      </p>
                      <h2 className="text-3xl font-black tracking-tight text-on-background">
                        {formatINR(netLiquidity)}
                      </h2>
                      <p className={`text-sm font-bold mt-1 ${unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {unrealizedPnl >= 0 ? '+' : ''}{formatINR(unrealizedPnl)} unrealized
                      </p>
                    </div>
                    <div className="mt-8 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-on-surface-variant">BUYING POWER</span>
                        <span className="text-sm font-bold">{formatINR(buyingPower)}</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, bpPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="md:w-2/3 p-8 grid grid-cols-2 gap-8 content-center">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant">Margin Used</p>
                      <p className="text-xl font-bold text-on-background">{formatINR(usedMargin)}</p>
                      <p className="text-xs text-on-surface-variant">{marginPct}% of capital</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant">{"Day's P&L"}</p>
                      <p className={`text-xl font-bold ${dayPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dayPnl >= 0 ? '+' : ''}{formatINR(dayPnl)}
                      </p>
                      <p className="text-xs text-on-surface-variant">Realized + unrealized</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant">Open Profit</p>
                      <p className={`text-xl font-bold ${unrealizedPnl >= 0 ? 'text-primary' : 'text-red-600'}`}>
                        {unrealizedPnl >= 0 ? '+' : ''}{formatINR(unrealizedPnl)}
                      </p>
                      <p className="text-xs text-on-surface-variant">Unrealized gains</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant">Cash Balance</p>
                      <p className="text-xl font-bold text-on-background">{formatINR(balance)}</p>
                      <p className="text-xs text-on-surface-variant">Settled funds</p>
                    </div>
                  </div>
                </section>

                {/* Recent Activity */}
                <aside className="col-span-12 lg:col-span-4 bg-surface-container-low rounded-xl p-6 space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Recent Activity</h3>
                    <Link href="/positions" className="text-[10px] font-bold text-primary underline">
                      View All
                    </Link>
                  </div>

                  {recentTrades.length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic">No recent trades</p>
                  ) : (
                    <div className="space-y-3">
                      {recentTrades.map(t => (
                        <div
                          key={t.id}
                          className={`p-4 bg-surface-container-lowest rounded-xl border-l-4 ${t.pnl >= 0 ? 'border-green-500' : 'border-red-500'
                            }`}
                        >
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase mb-1">
                            {t.side} Order Filled
                          </p>
                          <p className="text-xs font-bold text-on-surface">
                            {t.displayName} @ ₹{t.exitPrice.toFixed(2)}
                          </p>
                          <div className="flex justify-between items-end mt-2">
                            <span className="text-[10px] text-on-surface-variant italic">
                              {new Date(t.exitTime).toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            <span className={`text-[10px] font-black ${t.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {t.pnl >= 0 ? '+' : ''}{formatINR(t.pnl)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    href="/trade"
                    className="block w-full py-3 text-center bg-primary-container text-on-primary-fixed font-bold text-xs rounded-lg hover:brightness-95 transition-all"
                  >
                    Open Trading Terminal
                  </Link>
                </aside>

                {/* Open Positions Table */}
                <section className="col-span-12 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)]">
                  <div className="bg-surface-container-high px-8 py-4 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Open Positions</h3>
                    <div className="flex gap-4">
                      <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {openPositions.length} Active
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-surface-dim" />
                        {pendingCount} Pending
                      </span>
                      <Link
                        href="/positions"
                        className="text-[10px] font-bold text-primary underline"
                      >
                        Full View
                      </Link>
                    </div>
                  </div>

                  {openPositions.length === 0 ? (
                    <div className="px-8 py-12 text-center text-on-surface-variant text-sm">
                      No open positions. &nbsp;
                      <Link href="/trade" className="text-primary font-bold underline">
                        Start trading
                      </Link>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-on-background">
                            <th className="px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-white">Asset</th>
                            <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-white">Side</th>
                            <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-white text-right">Qty</th>
                            <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-white text-right">Entry</th>
                            <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-white text-right">LTP</th>
                            <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-white text-right">P&L</th>
                            <th className="px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-white text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-dim/30">
                          {openPositions.map(pos => {
                            const ltp = ticks[pos.symbol]?.ltp ?? pos.currentPrice;
                            const pnl = pos.side === 'BUY'
                              ? (ltp - pos.entryPrice) * pos.quantity
                              : (pos.entryPrice - ltp) * pos.quantity;
                            const pnlPct = pos.entryPrice > 0
                              ? ((pnl / (pos.entryPrice * pos.quantity)) * 100).toFixed(2)
                              : '0.00';

                            return (
                              <tr key={pos.id} className="hover:bg-surface-container-low transition-colors group">
                                <td className="px-8 py-5">
                                  <p className="text-xs font-bold text-on-surface">{pos.displayName || pos.symbol}</p>
                                  <p className="text-[10px] text-on-surface-variant">{pos.instrumentType}</p>
                                </td>
                                <td className="px-6 py-5">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${pos.side === 'BUY'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                    }`}>
                                    {pos.side}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-xs font-medium text-right">{pos.quantity}</td>
                                <td className="px-6 py-5 text-xs font-medium text-right font-mono">
                                  ₹{pos.entryPrice.toFixed(2)}
                                </td>
                                <td className="px-6 py-5 text-xs font-bold text-right font-mono">
                                  ₹{ltp.toFixed(2)}
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <p className={`text-xs font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                                  </p>
                                  <p className={`text-[10px] ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {pnl >= 0 ? '+' : ''}{pnlPct}%
                                  </p>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <Link
                                    href="/positions"
                                    className="bg-surface-container-highest px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-primary-container hover:text-on-primary-fixed transition-colors"
                                  >
                                    Manage
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              {/* ── Footer Analytics ─────────────────────────── */}
              <footer className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-8 border-t border-surface-dim/20">
                <div className="bg-surface-container px-6 py-5 rounded-lg">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">Total Return</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-on-background">
                      {initial > 0 ? (((balance - initial + realizedPnl) / initial) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">Since inception</p>
                </div>
                <div className="bg-surface-container px-6 py-5 rounded-lg">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">Win Rate</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-on-background">{winRate}%</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded mb-1 ${winRate >= 60
                      ? 'bg-primary-container text-on-primary-fixed'
                      : 'bg-surface-container-highest text-on-surface-variant'
                      }`}>
                      {winRate >= 60 ? 'OPTIMAL' : winRate >= 45 ? 'AVERAGE' : 'REVIEW'}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">{trades.length} total trades</p>
                </div>
                <div className="bg-surface-container px-6 py-5 rounded-lg">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">Max Open Loss</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-on-background">{formatINR(maxDrawdown)}</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">Worst open position</p>
                </div>
                <div className="bg-surface-container px-6 py-5 rounded-lg">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">Realized P&L</p>
                  <div className="flex items-end gap-2">
                    <span className={`text-2xl font-black ${realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {realizedPnl >= 0 ? '+' : ''}{formatINR(realizedPnl)}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">All-time closed P&L</p>
                </div>
              </footer>

            </div>
          </main>
        </div>

        <ToastContainer />
        <MobileBottomNav />
      </div>
    </ProtectedRoute>
  );
}
