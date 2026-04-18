'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const initSocket = useMarketStore(s => s.initSocket);
  const ticks = useMarketStore(s => s.ticks);
  const account = useTradingStore(s => s.account);
  const positions = useTradingStore(s => s.positions);
  const trades = useTradingStore(s => s.trades);
  const orders = useTradingStore(s => s.orders);
  const [watchlistItems, setWatchlistItems] = useState<Array<{id: string, symbol: string, displayName: string}>>([]);

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
    fetch('/api/watchlists')
      .then(r => r.json())
      .then((lists: Array<{items: Array<{id: string, symbol: string, displayName: string}>}>) => {
        const items = Array.isArray(lists) ? lists.flatMap(l => l.items) : [];
        setWatchlistItems(items);
        if (items.length) {
          useMarketStore.getState().subscribePositionSymbols(items.map(i => i.symbol));
        }
      })
      .catch(() => {});
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

  // Trades calendar — P&L per day (IST)
  const tradePnlByDay: Record<string, number> = {};
  trades.forEach(t => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(t.exitTime));
    tradePnlByDay[day] = (tradePnlByDay[day] ?? 0) + t.pnl;
  });
  const calNow = new Date();
  const calYear = calNow.getFullYear();
  const calMonth = calNow.getMonth();
  const calMonthName = calNow.toLocaleString('en-IN', { month: 'long' });
  const calFirstDow = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // Recent trades (last 5)
  const recentTrades = [...trades].sort(
    (a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
  ).slice(0, 5);

  // Pending orders count
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-surface font-sans">
        <TopNav />

        <div className="flex">
          <SideNav />

          {/* Main content — centered with max-width */}
          <main className="flex-1 md:ml-20 p-4 md:p-6 lg:p-8 pb-20 md:pb-8 transition-all duration-300">
            <div className="space-y-4">

              {/* ── Hero Header ──────────────────────────────── */}
              <header className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/sahaai-favicon.png"
                      alt="SAHAAI"
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                      priority
                    />
                    {session?.user?.name && (
                      <p className="text-sm font-semibold text-on-surface-variant">
                        Welcome, {session.user.name}
                      </p>
                    )}
                  </div>
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

                {/* Col 1 – Account Summary + Trades Calendar */}
                <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col md:flex-row shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)]">

                  {/* Gray box – Net Liquidity + 4 stats + Buying Power */}
                  <div className="md:w-5/12 bg-surface-container-high p-6 flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mb-1">
                        Net Liquidity
                      </p>
                      <h2 className="text-2xl font-black tracking-tight text-on-background">
                        {formatINR(netLiquidity)}
                      </h2>
                      <p className={`text-xs font-bold mt-0.5 ${unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {unrealizedPnl >= 0 ? '+' : ''}{formatINR(unrealizedPnl)} unrealized
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-on-surface-variant">Margin Used</p>
                        <p className="text-sm font-bold text-on-background">{formatINR(usedMargin)}</p>
                        <p className="text-[10px] text-on-surface-variant">{marginPct}% of capital</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-on-surface-variant">{"Day's P&L"}</p>
                        <p className={`text-sm font-bold ${dayPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {dayPnl >= 0 ? '+' : ''}{formatINR(dayPnl)}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">Realized + unrealized</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-on-surface-variant">Open Profit</p>
                        <p className={`text-sm font-bold ${unrealizedPnl >= 0 ? 'text-primary' : 'text-red-600'}`}>
                          {unrealizedPnl >= 0 ? '+' : ''}{formatINR(unrealizedPnl)}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">Unrealized gains</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-on-surface-variant">Cash Balance</p>
                        <p className="text-sm font-bold text-on-background">{formatINR(balance)}</p>
                        <p className="text-[10px] text-on-surface-variant">Settled funds</p>
                      </div>
                    </div>

                    <div className="mt-auto space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-on-surface-variant uppercase">Buying Power</span>
                        <span className="text-xs font-bold">{formatINR(buyingPower)}</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, bpPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* White box – Trades Calendar */}
                  <div className="md:w-7/12 p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Trades Calendar</h3>
                      <span className="text-[10px] font-bold text-on-surface-variant">{calMonthName} {calYear}</span>
                    </div>

                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                        <div key={d} className="text-[9px] font-bold text-on-surface-variant py-1">{d}</div>
                      ))}

                      {/* Empty cells before first day */}
                      {Array.from({ length: calFirstDow }).map((_, i) => (
                        <div key={`e${i}`} />
                      ))}

                      {/* Day cells */}
                      {Array.from({ length: calDaysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const mm = String(calMonth + 1).padStart(2, '0');
                        const dd = String(day).padStart(2, '0');
                        const dateStr = `${calYear}-${mm}-${dd}`;
                        const pnl = tradePnlByDay[dateStr];
                        const hasTraded = pnl !== undefined;
                        const isToday = day === calNow.getDate();

                        return (
                          <button
                            key={day}
                            onClick={() => hasTraded && router.push('/trades')}
                            title={hasTraded ? `${formatINR(pnl)}` : undefined}
                            className={`
                              aspect-square flex items-center justify-center rounded text-[10px] font-bold transition-all
                              ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}
                              ${hasTraded
                                ? pnl >= 0
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer'
                                : 'text-on-surface-variant cursor-default'
                              }
                            `}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-auto">
                      <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
                        <span className="w-2.5 h-2.5 rounded bg-green-100 inline-block" /> Profit
                      </span>
                      <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
                        <span className="w-2.5 h-2.5 rounded bg-red-100 inline-block" /> Loss
                      </span>
                    </div>
                  </div>
                </section>

                {/* Col 2 – Recent Activity */}
                <aside className="col-span-12 lg:col-span-3 bg-surface-container-low rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Recent Activity</h3>
                    <Link href="/positions" className="text-[10px] font-bold text-primary underline">View All</Link>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2">
                    {recentTrades.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">No recent trades</p>
                    ) : (
                      recentTrades.map(t => (
                        <div
                          key={t.id}
                          className={`p-3 bg-surface-container-lowest rounded-xl border-l-4 ${t.pnl >= 0 ? 'border-green-500' : 'border-red-500'}`}
                        >
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">
                            {t.side} Order Filled
                          </p>
                          <p className="text-xs font-bold text-on-surface leading-tight">
                            {t.displayName} @ ₹{t.exitPrice.toFixed(2)}
                          </p>
                          <div className="flex justify-between items-end mt-1.5">
                            <span className="text-[10px] text-on-surface-variant italic">
                              {new Date(t.exitTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`text-[10px] font-black ${t.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {t.pnl >= 0 ? '+' : ''}{formatINR(t.pnl)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <Link
                    href="/trade"
                    className="block w-full py-3 text-center bg-primary-container text-on-primary-fixed font-bold text-xs rounded-lg hover:brightness-95 transition-all"
                  >
                    Open Trading Terminal
                  </Link>
                </aside>

                {/* Col 3 – Watchlist with LTP */}
                <aside className="col-span-12 lg:col-span-3 bg-surface-container-low rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Watchlist</h3>
                    <Link href="/watchlist" className="text-[10px] font-bold text-primary underline">Manage</Link>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2">
                    {watchlistItems.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">No watchlist items. Add symbols from the Watchlist page.</p>
                    ) : (
                      watchlistItems.map(item => {
                        const ltp = ticks[item.symbol]?.ltp;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-3 py-2.5 bg-surface-container-lowest rounded-lg"
                          >
                            <span className="text-xs font-bold text-on-surface truncate max-w-[55%]">{item.displayName}</span>
                            <span className="text-xs font-mono font-bold text-on-background">
                              {ltp !== undefined ? `₹${ltp.toFixed(2)}` : '—'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
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
