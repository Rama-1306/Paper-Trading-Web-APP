'use client';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Header } from '@/components/common/Header';
import { StatusBar } from '@/components/common/StatusBar';
import { TradingChart } from '@/components/Chart/TradingChart';
import { ChartControls } from '@/components/Chart/ChartControls';
import { OrderPanel } from '@/components/Trading/OrderPanel';
import { PositionList } from '@/components/Trading/PositionList';
import { OptionChainTable } from '@/components/OptionChain/OptionChainTable';
import { TradeHistory } from '@/components/Trading/TradeHistory';
import { WatchlistPanel } from '@/components/Trading/WatchlistPanel';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useMarketStore, registerTickPositionUpdater, registerServerEventHandler } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import type { Tick } from '@/types/market';

type BottomTab = 'positions' | 'orders' | 'trades' | 'option-chain' | 'watchlist';

export default function Dashboard() {
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');
  const [chartHeightPercent, setChartHeightPercent] = useState(65);
  const [chartVisible, setChartVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const initSocket = useMarketStore(s => s.initSocket);

  useEffect(() => {
    registerServerEventHandler((event: string, data: any) => {
      const addNotification = useUIStore.getState().addNotification;

      if (event === 'position_closed') {
        const reason = data.exitReason === 'SL_HIT' ? 'Stop Loss Hit' :
          data.exitReason === 'TARGET_HIT' ? 'Target Hit' : data.exitReason;
        const pnlStr = data.pnl >= 0 ? `+₹${data.pnl.toFixed(2)}` : `-₹${Math.abs(data.pnl).toFixed(2)}`;

        addNotification({
          type: data.pnl >= 0 ? 'success' : 'error',
          title: reason,
          message: `${data.displayName} ${data.side} closed @ ${data.exitPrice.toFixed(2)} | P&L: ${pnlStr}`,
        });

        useTradingStore.getState().fetchPositions();
        useTradingStore.getState().fetchAccount();
        useTradingStore.getState().fetchOrders();
        useTradingStore.getState().fetchTrades();
      }

      if (event === 'order_filled') {
        addNotification({
          type: 'success',
          title: 'Order Filled',
          message: `${data.displayName} ${data.side} ${data.orderType} filled @ ${data.fillPrice.toFixed(2)}`,
        });

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
      if (positions.length === 0) return;

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

      if (updated) {
        tradingState.setPositions(updatedPositions);
      }
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

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalHeight = rect.height;
      const percent = Math.min(85, Math.max(25, (relativeY / totalHeight) * 100));
      setChartHeightPercent(percent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

 return (
    <ProtectedRoute>
    <div className="app-container">
      <Header />

      <main className="main-content" ref={mainRef}>
        <div className="left-column" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {chartVisible && (
            <>
              <div className="chart-area" style={{ height: `${chartHeightPercent}%`, minHeight: '100px' }}>
                <ChartControls onToggleChart={() => setChartVisible(false)} />
                <TradingChart />
              </div>

              <div
                className="resize-handle"
                onMouseDown={handleDragStart}
                style={{
                  height: '6px',
                  cursor: 'row-resize',
                  background: isDragging ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
                  position: 'relative',
                  zIndex: 10,
                  flexShrink: 0,
                  transition: isDragging ? 'none' : 'background 0.2s',
                }}
                onMouseEnter={(e) => { if (!isDragging) (e.target as HTMLElement).style.background = 'rgba(99, 102, 241, 0.3)'; }}
                onMouseLeave={(e) => { if (!isDragging) (e.target as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '40px',
                  height: '3px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.15)',
                }} />
              </div>
            </>
          )}

          <div className="bottom-panel" style={{ flex: 1, minHeight: '60px' }}>
            <div className="tabs">
              {!chartVisible && (
                <button
                  className="chart-toggle-show"
                  onClick={() => setChartVisible(true)}
                  title="Show Chart"
                >
                  Show Chart
                </button>
              )}
              <button 
                className={`tab ${bottomTab === 'positions' ? 'active' : ''}`}
                onClick={() => setBottomTab('positions')}
              >
                Positions
              </button>
              <button 
                className={`tab ${bottomTab === 'orders' ? 'active' : ''}`}
                onClick={() => setBottomTab('orders')}
              >
                Orders
              </button>
              <button 
                className={`tab ${bottomTab === 'trades' ? 'active' : ''}`}
                onClick={() => setBottomTab('trades')}
              >
                Trades
              </button>
              <button 
                className={`tab ${bottomTab === 'option-chain' ? 'active' : ''}`}
                onClick={() => setBottomTab('option-chain')}
              >
                Option Chain
              </button>
              <button 
                className={`tab ${bottomTab === 'watchlist' ? 'active' : ''}`}
                onClick={() => setBottomTab('watchlist')}
              >
                Watchlist
              </button>
            </div>

            <div className="panel-content">
              {bottomTab === 'positions' && <PositionList />}
              {bottomTab === 'orders' && <TradeHistory type="orders" />}
              {bottomTab === 'trades' && <TradeHistory type="trades" />}
              {bottomTab === 'option-chain' && <OptionChainTable />}
              {bottomTab === 'watchlist' && <WatchlistPanel />}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <OrderPanel />
        </div>
      </main>

      <StatusBar />
      <ToastContainer />
    </div>
    </ProtectedRoute>
  );
}
