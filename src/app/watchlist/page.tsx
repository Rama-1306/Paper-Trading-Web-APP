'use client';

import { useEffect } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { TradingSidebar } from '@/components/common/TradingSidebar';
import { WatchlistPanel } from '@/components/Trading/WatchlistPanel';
import { useMarketStore, registerTickPositionUpdater } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import type { Tick } from '@/types/market';

export default function WatchlistPage() {
  const initSocket = useMarketStore(s => s.initSocket);

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
          <div className="flex flex-1 ml-20 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <WatchlistPanel />
            </div>
            <TradingSidebar />
          </div>
        </div>
        <ToastContainer />
      </div>
    </ProtectedRoute>
  );
}
