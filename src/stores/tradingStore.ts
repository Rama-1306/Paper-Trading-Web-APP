'use client';

import { create } from 'zustand';
import type { OrderResponse, PositionData, TradeData, AccountSummary } from '@/types/trading';
import { getCurrentFuturesSymbol } from '@/lib/utils/symbols';

interface TradingState {
  // Account
  account: AccountSummary | null;

  // Positions
  positions: PositionData[];

  // Orders
  orders: OrderResponse[];
  pendingOrders: OrderResponse[];

  // Trades
  trades: TradeData[];

  // UI State
  selectedSymbol: string;
  orderSide: 'BUY' | 'SELL';
  orderQuantity: number;

  // Actions
  fetchAccount: () => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchTrades: () => Promise<void>;
  setAccount: (account: AccountSummary) => void;
  setPositions: (positions: PositionData[]) => void;
  updatePosition: (position: PositionData) => void;
  removePosition: (id: string) => void;
  setOrders: (orders: OrderResponse[]) => void;
  addOrder: (order: OrderResponse) => void;
  updateOrder: (order: OrderResponse) => void;
  setTrades: (trades: TradeData[]) => void;
  addTrade: (trade: TradeData) => void;
  setSelectedSymbol: (symbol: string) => void;
  setOrderSide: (side: 'BUY' | 'SELL') => void;
  setOrderQuantity: (qty: number) => void;
  reset: () => void;
}

const initialState = {
  account: null,
  positions: [],
  orders: [],
  pendingOrders: [],
  trades: [],
  // On refresh: use whatever activeSymbol was last stored (futures/MCX/index), but
  // fall back to BNF futures if it was an option (options reset on refresh per QA).
  selectedSymbol: (() => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('activeSymbol') || '';
    const isOption = /\d+(CE|PE)$/i.test(stored.replace(/^(NSE:|MCX:|BSE:)/, ''));
    return isOption ? getCurrentFuturesSymbol() : (stored || getCurrentFuturesSymbol());
  })(),
  orderSide: 'BUY' as const,
  orderQuantity: 30,   // 1 lot of Bank Nifty
};

export const useTradingStore = create<TradingState>((set) => ({
  ...initialState,

  fetchAccount: async () => {
    try {
      const res = await fetch('/api/account');
      if (res.ok) {
        const data = await res.json();
        // /api/account returns { account: {...} }
        set({ account: data.account ?? data });
      }
    } catch (error) {
      console.error('Failed to fetch account:', error);
    }
  },

  fetchPositions: async () => {
    try {
      // Fetch all positions (open + closed) so PositionList can show today's closed ones
      const res = await fetch('/api/positions?closed=true');
      if (res.ok) {
        const data = await res.json();
        set({ positions: data });
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  },

  fetchOrders: async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        set({ orders: data, pendingOrders: data.filter((o: any) => o.status === 'PENDING') });
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  },

  fetchTrades: async () => {
    try {
      const res = await fetch('/api/trades');
      if (res.ok) {
        const data = await res.json();
        set({ trades: data });
      }
    } catch (error) {
      console.error('Failed to fetch trades:', error);
    }
  },

  setAccount: (account) => set({ account }),

  setPositions: (positions) => set({ positions }),

  updatePosition: (position) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === position.id ? position : p
      ),
    })),

  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  setOrders: (orders) =>
    set({
      orders,
      pendingOrders: orders.filter((o) => o.status === 'PENDING'),
    }),

  addOrder: (order) =>
    set((state) => {
      const orders = [order, ...state.orders];
      return {
        orders,
        pendingOrders: orders.filter((o) => o.status === 'PENDING'),
      };
    }),

  updateOrder: (order) =>
    set((state) => {
      const orders = state.orders.map((o) =>
        o.id === order.id ? order : o
      );
      return {
        orders,
        pendingOrders: orders.filter((o) => o.status === 'PENDING'),
      };
    }),

  setTrades: (trades) => set({ trades }),

  addTrade: (trade) =>
    set((state) => ({ trades: [trade, ...state.trades] })),

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setOrderSide: (side) => set({ orderSide: side }),
  setOrderQuantity: (qty) => set({ orderQuantity: qty }),
  reset: () => set(initialState),
}));
