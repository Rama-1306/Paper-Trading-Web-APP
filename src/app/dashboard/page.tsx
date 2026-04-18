'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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

const CAL_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CAL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function PortfolioDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const initSocket = useMarketStore(s => s.initSocket);
  const ticks = useMarketStore(s => s.ticks);
  const account = useTradingStore(s => s.account);
  const positions = useTradingStore(s => s.positions);
  const trades = useTradingStore(s => s.trades);
  const orders = useTradingStore(s => s.orders);
  const [watchlistItems, setWatchlistItems] = useState<Array<{id: string, symbol: string, displayName: string}>>([]);
  const _calToday = new Date();
  const [calYear, setCalYear] = useState(_calToday.getFullYear());
  const [calMonth, setCalMonth] = useState(_calToday.getMonth());
  const prevCalMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextCalMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };

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

  // ── Trades Calendar data ────────────────────────────────────
  const tradePnlByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of trades) {
      const dk = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(t.exitTime));
      map[dk] = (map[dk] ?? 0) + t.pnl;
    }
    return map;
  }, [trades]);

  const calFirstDow = new Date(calYear, calMonth, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calWeeks: (number | null)[][] = [];
  let calWeek: (number | null)[] = Array(calFirstDow).fill(null);
  for (let d = 1; d <= calDaysInMonth; d++) {
    calWeek.push(d);
    if (calWeek.length === 7) { calWeeks.push(calWeek); calWeek = []; }
  }
  if (calWeek.length > 0) { while (calWeek.length < 7) calWeek.push(null); calWeeks.push(calWeek); }

  const todayDashboard = new Date();
  const isCalCurrentMonth = calYear === todayDashboard.getFullYear() && calMonth === todayDashboard.getMonth();

  // Best / worst P&L position for analytics
  const pnlValues = openPositions.map(p => p.pnl);
  const maxDrawdown = pnlValues.length ? Math.min(0, Math.min(...pnlValues)) : 0;
  const winTrades = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? Math.round((winTrades / trades.length) * 100) : 0;

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
          <main className="flex-1 md:ml-20 p-2 md:p-3 lg:p-4 pb-20 md:pb-4 transition-all duration-300">
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

                {/* Col 1 – Account Summary */}
                <section className="col-span-12 lg:col-span-6 bg-surface-container-high rounded-xl overflow-hidden shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)]">

                  {/* Stats */}
                  <div className="p-6 flex flex-col gap-4">
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

                {/* Trades Calendar */}
                <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)]">
                  <div className="px-5 py-3 border-b border-surface-dim/20 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Trades Calendar</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={prevCalMonth}
                        className="w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high text-sm font-bold transition-colors"
                      >‹</button>
                      <span className="text-[11px] font-bold text-on-surface min-w-[110px] text-center">
                        {CAL_MONTH_NAMES[calMonth]} {calYear}
                      </span>
                      <button
                        onClick={nextCalMonth}
                        className="w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high text-sm font-bold transition-colors"
                      >›</button>
                      <Link href="/trades" className="text-[10px] font-bold text-primary underline ml-2">All Trades</Link>
                    </div>
                  </div>
                  <div className="p-3">
                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 mb-1">
                      {CAL_DAY_SHORT.map(d => (
                        <div key={d} className="text-center text-[9px] font-bold uppercase tracking-wide text-on-surface-variant py-1">
                          {d}
                        </div>
                      ))}
                    </div>
                    {/* Calendar weeks */}
                    {calWeeks.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
                        {week.map((d, ci) => {
                          if (!d) return <div key={ci} className="h-12" />;
                          const mo = String(calMonth).padStart(2, '0');
                          const da = String(d).padStart(2, '0');
                          const dk = `${calYear}-${mo}-${da}`;
                          const pnl = tradePnlByDay[dk];
                          const hasTrades = pnl !== undefined;
                          const isToday = isCalCurrentMonth && d === todayDashboard.getDate();
                          const pnlK = hasTrades
                            ? (Math.abs(pnl) >= 1000 ? `${(pnl / 1000).toFixed(1)}k` : pnl.toFixed(0))
                            : null;
                          return (
                            <div
                              key={ci}
                              onClick={() => router.push('/trades')}
                              className={`h-12 flex flex-col items-center justify-center rounded cursor-pointer transition-colors
                                ${hasTrades
                                  ? pnl >= 0
                                    ? 'bg-green-50 hover:bg-green-100'
                                    : 'bg-red-50 hover:bg-red-100'
                                  : 'hover:bg-surface-container-low'}
                                ${isToday ? 'ring-2 ring-primary ring-inset' : ''}
                              `}
                            >
                              <span className={`text-[10px] font-bold leading-none ${isToday ? 'text-primary' : hasTrades ? 'text-on-background' : 'text-on-surface-variant'}`}>
                                {d}
                              </span>
                              {hasTrades && (
                                <span className={`text-[9px] font-bold leading-none mt-0.5 ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {pnl >= 0 ? '+' : '-'}{pnlK}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </section>

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
