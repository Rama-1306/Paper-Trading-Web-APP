'use client';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { TradingChart } from '@/components/Chart/TradingChart';
import { ChartControls } from '@/components/Chart/ChartControls';
import { TradingSidebar } from '@/components/common/TradingSidebar';
import { ToastContainer } from '@/components/common/ToastContainer';
import { PullToRefresh } from '@/components/common/PullToRefresh';
import { InstrumentSearch } from '@/components/Trading/InstrumentSearch';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useMarketStore, registerTickPositionUpdater, registerServerEventHandler } from '@/stores/marketStore';
import { useAlertStore } from '@/stores/alertStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { useCCCEngine } from '@/hooks/useCCCEngine';
import type { Tick } from '@/types/market';

const MOBILE_NAV = [
  { href: '/trade',     label: 'Chart',    icon: '📊' },
  { href: '/positions', label: 'Pos',      icon: '📈' },
  { href: '/orders',    label: 'Orders',   icon: '📋' },
  { href: '/trades',    label: 'Trades',   icon: '🔄' },
  { href: '/watchlist', label: 'Watch',    icon: '👁' },
  { href: '/alerts',    label: 'Alerts',   icon: '🔔' },
];

export default function ChartPage() {
  const [cccEngineEnabled, setCCCEngineEnabled] = useState(false);
  useCCCEngine(cccEngineEnabled);

  const initSocket = useMarketStore(s => s.initSocket);
  const reconnectSocket = useMarketStore(s => s.reconnectSocket);
  const isSocketConnected = useMarketStore(s => s.connectionStatus.isConnected);

  useEffect(() => {
    registerServerEventHandler((event: string, data: Record<string, unknown>) => {
      const alertStore = useAlertStore.getState();
      const addNotification = useUIStore.getState().addNotification;
      const currentAccountId = ((useTradingStore.getState().account as unknown) as Record<string, unknown>)?.id as string | undefined;

      if (data?.accountId && (!currentAccountId || data.accountId !== currentAccountId)) {
        return;
      }

      if (event === 'position_closed') {
        alertStore.handlePositionClosed(data);
        const pnl = data.pnl as number;
        if (data.exitReason !== 'SL_HIT' && data.exitReason !== 'TARGET_HIT') {
          const pnlStr = pnl >= 0 ? `+₹${pnl.toFixed(2)}` : `-₹${Math.abs(pnl).toFixed(2)}`;
          addNotification({
            type: pnl >= 0 ? 'success' : 'error',
            title: (data.exitReason as string) || 'Position Closed',
            message: `${data.displayName} ${data.side} closed @ ${(data.exitPrice as number).toFixed(2)} | P&L: ${pnlStr}`,
          });
        }
        useTradingStore.getState().fetchPositions();
        useTradingStore.getState().fetchAccount();
        useTradingStore.getState().fetchOrders();
        useTradingStore.getState().fetchTrades();
      }

      if (event === 'order_filled') {
        alertStore.handleOrderFilled(data);
        useTradingStore.getState().fetchPositions().then(() => {
          const positions = useTradingStore.getState().positions;
          const openSymbols = positions.filter(p => p.isOpen).map(p => p.symbol);
          if (openSymbols.length > 0) {
            useMarketStore.getState().subscribePositionSymbols(openSymbols);
          }
        });
        useTradingStore.getState().fetchAccount();
        useTradingStore.getState().fetchOrders();
        useTradingStore.getState().fetchTrades();
      }

      if (event === 'sl_updated') {
        useTradingStore.getState().fetchPositions();
      }
    });

    registerTickPositionUpdater((ticks: Tick[]) => {
      const tradingState = useTradingStore.getState();
      const positions = tradingState.positions;
      if (positions.length === 0) {
        useAlertStore.getState().processTicks(ticks);
        return;
      }
      const tickMap: Record<string, number> = {};
      ticks.forEach(t => { tickMap[t.symbol] = t.ltp; });
      let updated = false;
      const updatedPositions = positions.map((pos) => {
        if (pos.isOpen && tickMap[pos.symbol] !== undefined) {
          const ltp = tickMap[pos.symbol];
          const pnl = pos.side === 'BUY'
            ? (ltp - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - ltp) * pos.quantity;
          updated = true;
          return { ...pos, currentPrice: ltp, pnl };
        }
        return pos;
      });
      if (updated) tradingState.setPositions(updatedPositions);
      useAlertStore.getState().processTicks(ticks);
    });

    useTradingStore.getState().fetchAccount();
    useTradingStore.getState().fetchPositions().then(() => {
      const positions = useTradingStore.getState().positions;
      const openSymbols = positions.filter(p => p.isOpen).map(p => p.symbol);
      if (openSymbols.length > 0) {
        useMarketStore.getState().subscribePositionSymbols(openSymbols);
      }
    });
    useTradingStore.getState().fetchOrders();
    useTradingStore.getState().fetchTrades();
    initSocket();
  }, [initSocket]);

  useEffect(() => {
    if (!isSocketConnected) return;
    useTradingStore.getState().fetchAccount();
    useTradingStore.getState().fetchPositions().then(() => {
      const positions = useTradingStore.getState().positions;
      const openSymbols = positions.filter(p => p.isOpen).map(p => p.symbol);
      const alertSymbols = useAlertStore.getState().getActiveAlertSymbols();
      const allSymbols = [...new Set([...openSymbols, ...alertSymbols])];
      if (allSymbols.length > 0) {
        useMarketStore.getState().subscribePositionSymbols(allSymbols);
      }
    });
    useTradingStore.getState().fetchOrders();
    useTradingStore.getState().fetchTrades();
  }, [isSocketConnected]);

  const handleRefresh = useCallback(async () => {
    reconnectSocket();
    await Promise.all([
      useTradingStore.getState().fetchAccount(),
      useTradingStore.getState().fetchPositions().then(() => {
        const positions = useTradingStore.getState().positions;
        const openSymbols = positions.filter(p => p.isOpen).map(p => p.symbol);
        if (openSymbols.length > 0) {
          useMarketStore.getState().subscribePositionSymbols(openSymbols);
        }
      }),
      useTradingStore.getState().fetchOrders(),
      useTradingStore.getState().fetchTrades(),
    ]);
  }, [reconnectSocket]);

  return (
    <ProtectedRoute>
      <PullToRefresh onRefresh={handleRefresh} />
      <div className="h-screen bg-surface font-sans flex flex-col overflow-hidden">
        <TopNav />

        <div className="flex flex-1 overflow-hidden">
          <SideNav />

          {/* Chart area + right sidebar */}
          <div className="flex flex-1 ml-20 overflow-hidden">

            {/* ── Chart column ── */}
            <div className="flex flex-col flex-1 overflow-hidden">

              {/* Instrument search bar */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-surface-container-highest shrink-0 bg-surface-container-lowest">
                <div className="flex-1 min-w-0">
                  <InstrumentSearch />
                </div>
                {/* CCC Engine toggle */}
                <button
                  onClick={() => setCCCEngineEnabled(v => !v)}
                  title={cccEngineEnabled ? 'CCC Engine ON — click to disable' : 'CCC Engine OFF — click to enable'}
                  className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shrink-0 ${
                    cccEngineEnabled
                      ? 'bg-primary-container text-on-primary-fixed'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cccEngineEnabled ? 'bg-on-primary-fixed animate-pulse' : 'bg-surface-dim'}`} />
                  CCC
                </button>
              </div>

              {/* Chart controls (timeframe, indicators) */}
              <ChartControls />

              {/* Chart fills remaining height */}
              <div className="flex-1 overflow-hidden">
                <TradingChart />
              </div>
            </div>

            {/* ── Right sidebar (Place Order / Positions) ── */}
            <TradingSidebar />
          </div>
        </div>

        <ToastContainer />

        {/* ── Mobile bottom navigation ── */}
        <nav className="mobile-bottom-nav">
          {MOBILE_NAV.map(item => (
            <Link key={item.href} href={item.href} className="mobile-nav-tab">
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </ProtectedRoute>
  );
}
