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
import { AlertsPanel } from '@/components/Trading/AlertsPanel';
import { ToastContainer } from '@/components/common/ToastContainer';
import { PullToRefresh } from '@/components/common/PullToRefresh';
import { InstrumentSearch } from '@/components/Trading/InstrumentSearch';
import { formatINR } from '@/lib/utils/formatters';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useMarketStore, registerTickPositionUpdater, registerServerEventHandler } from '@/stores/marketStore';
import { useAlertStore } from '@/stores/alertStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import type { Tick } from '@/types/market';
type ActiveView = 'chart' | 'positions' | 'orders' | 'trades' | 'option-chain' | 'watchlist' | 'alerts' | 'place-order';

const NAV_ITEMS: { id: ActiveView; label: string }[] = [
  { id: 'chart',        label: 'Chart'    },
  { id: 'positions',    label: 'Pos'      },
  { id: 'orders',       label: 'Orders'   },
  { id: 'trades',       label: 'Trades'   },
  { id: 'option-chain', label: 'Chain'    },
  { id: 'watchlist',    label: 'Watch'    },
  { id: 'alerts',       label: 'Alerts'   },
];

type MobileNavItem =
  | { kind: 'view'; id: ActiveView; label: string; icon: string }
  | { kind: 'link'; href: string; label: string; icon: string };

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { kind: 'view', id: 'place-order',  label: 'Order',   icon: '🏠' },
  { kind: 'view', id: 'positions',    label: 'Pos',      icon: '📈' },
  { kind: 'view', id: 'orders',       label: 'Orders',   icon: '📋' },
  { kind: 'view', id: 'trades',       label: 'Trades',   icon: '🔄' },
  { kind: 'view', id: 'watchlist',    label: 'Watch',    icon: '👁' },
  { kind: 'view', id: 'alerts',       label: 'Alerts',   icon: '🔔' },
  { kind: 'view', id: 'option-chain', label: 'Chain',    icon: '🔗' },
  { kind: 'link', href: '/backtester', label: 'BTest',   icon: '🧪' },
];

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('chart');
  const [sidebarTab, setSidebarTab] = useState<'order' | 'positions'>('order');
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
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

      if (updated) {
        tradingState.setPositions(updatedPositions);
      }
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
    const alertSymbols = useAlertStore.getState().getActiveAlertSymbols();
    if (alertSymbols.length > 0) {
      useMarketStore.getState().subscribePositionSymbols(alertSymbols);
    }
  }, [isSocketConnected]);

  const account = useTradingStore(s => s.account);
  const positions = useTradingStore(s => s.positions);
  const trades = useTradingStore(s => s.trades);
  const ticks = useMarketStore(s => s.ticks);

  const balance = account?.balance ?? 1000000;
  const unrealizedPnl = positions
    .filter(p => p.isOpen)
    .reduce((sum, pos) => {
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
              BackTester
            </Link>
          </div>

          {/* ── Main Area ── */}
          <div className="main-area">
            {activeView === 'chart' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="desktop-only-search" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <InstrumentSearch />
                </div>
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
              <div style={{ height: '100%', overflow: 'hidden' }}>
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
            {activeView === 'alerts' && (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <AlertsPanel />
              </div>
            )}
            {activeView === 'place-order' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flexShrink: 0 }}>
                  <OrderPanel isMobile={true} />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: '4px solid var(--bg-card)' }}>
                  <div style={{
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '1px solid var(--border-primary)'
                  }}>
                    Positions
                  </div>
                  <PositionList compact={true} />
                </div>
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
            {/* Desktop-only Sidebar Stats Summary */}
            <div className="hidden md:flex" style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              gap: '20px',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Balance</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>{formatINR(balance)}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Day P&L</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: dayPnl >= 0 ? '#4caf50' : '#f44336' }}>
                  {dayPnl >= 0 ? '+' : ''}{formatINR(dayPnl)}
                </div>
              </div>
            </div>

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

        {/* ── Mobile Bottom Navigation (hidden on md+) ── */}
        <nav className="mobile-bottom-nav">
          {MOBILE_NAV_ITEMS.map(item =>
            item.kind === 'link' ? (
              <Link
                key={item.href}
                href={item.href}
                className="mobile-nav-tab"
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </Link>
            ) : (
              <button
                key={item.id}
                className={`mobile-nav-tab${activeView === item.id ? ' active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            )
          )}
        </nav>
      </div>
    </ProtectedRoute>
  );
}
