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
import Link from 'next/link';
import { useMarketStore, registerTickPositionUpdater, registerServerEventHandler } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import type { Tick } from '@/types/market';

type ActiveView = 'chart' | 'positions' | 'orders' | 'trades' | 'option-chain' | 'watchlist';

const NAV_ITEMS: { id: ActiveView; label: string }[] = [
  { id: 'chart',        label: 'Chart'    },
  { id: 'positions',    label: 'Pos'      },
  { id: 'orders',       label: 'Orders'   },
  { id: 'trades',       label: 'Trades'   },
  { id: 'option-chain', label: 'Chain'    },
  { id: 'watchlist',    label: 'Watch'    },
];

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('chart');
  const [sidebarTab, setSidebarTab] = useState<'order' | 'positions'>('order');
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
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

  // ── Sidebar horizontal resize ──────────────────────────────
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsSidebarDragging(true);
  }, []);

  useEffect(() => {
    if (!isSidebarDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      setSidebarWidth(Math.min(600, Math.max(240, newWidth)));
    };

    const handleMouseUp = () => setIsSidebarDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isSidebarDragging]);

  return (
    <ProtectedRoute>
      <div className="app-container">
        <Header />

        <main className="main-content" ref={mainRef}>
          {/* ── Left Vertical Navigation ── */}
          <div className="left-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`left-nav-tab ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
                title={item.id.charAt(0).toUpperCase() + item.id.slice(1).replace('-', ' ')}
              >
                {item.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <Link
              href="/backtester"
              className="left-nav-tab"
              title="CCC Indicator Backtester"
              style={{ textDecoration: 'none', color: '#58a6ff' }}
            >
              Back
            </Link>
          </div>

          {/* ── Main Area ── */}
          <div className="main-area">
            {activeView === 'chart' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ChartControls />
                <TradingChart />
              </div>
            )}
            {activeView === 'positions' && (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <PositionList />
              </div>
            )}
            {activeView === 'orders' && (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <TradeHistory type="orders" />
              </div>
            )}
            {activeView === 'trades' && (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <TradeHistory type="trades" />
              </div>
            )}
            {activeView === 'option-chain' && (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <OptionChainTable />
              </div>
            )}
            {activeView === 'watchlist' && (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <WatchlistPanel />
              </div>
            )}
          </div>

          {/* ── Sidebar Resize Handle ── */}
          <div
            className={`sidebar-resize-handle${isSidebarDragging ? ' dragging' : ''}`}
            onMouseDown={handleSidebarDragStart}
            title="Drag to resize sidebar"
          >
            <div className="sidebar-resize-grip" />
          </div>

          {/* ── Right Sidebar ── */}
          <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
            {/* Sidebar tab switcher */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderBottom: '1px solid var(--border-primary)',
              flexShrink: 0,
            }}>
              <button
                onClick={() => setSidebarTab('order')}
                style={{
                  padding: '8px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: sidebarTab === 'order' ? '2px solid var(--color-accent)' : '2px solid transparent',
                  color: sidebarTab === 'order' ? 'var(--color-accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
              >
                Place Order
              </button>
              <button
                onClick={() => setSidebarTab('positions')}
                style={{
                  padding: '8px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: sidebarTab === 'positions' ? '2px solid var(--color-accent)' : '2px solid transparent',
                  color: sidebarTab === 'positions' ? 'var(--color-accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
              >
                Positions
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {sidebarTab === 'order' ? <OrderPanel /> : <PositionList compact />}
            </div>
          </div>
        </main>

        <StatusBar />
        <ToastContainer />
      </div>
    </ProtectedRoute>
  );
}
