'use client';

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { Tick, Candle, OptionChain, MarketStatus, Timeframe } from '@/types/market';
import type { BrokerConnectionStatus } from '@/types/broker';
import { getCurrentFuturesSymbol } from '@/lib/utils/symbols';
import { getLotSizeForSymbol } from '@/lib/utils/margins';

let onTickPositionUpdate: ((ticks: Tick[]) => void) | null = null;
let onServerEvent: ((event: string, data: any) => void) | null = null;

export function registerTickPositionUpdater(fn: (ticks: Tick[]) => void) {
  onTickPositionUpdate = fn;
}

export function registerServerEventHandler(fn: (event: string, data: any) => void) {
  onServerEvent = fn;
}

interface MarketState {
  // Connection
  connectionStatus: BrokerConnectionStatus;
  marketStatus: MarketStatus;
  socket: Socket | null;

  // Live Prices
  ticks: Record<string, Tick>;           // symbol → latest tick
  spotPrice: number;                     // Bank Nifty spot price

  // Chart Data
  activeSymbol: string;                  // Symbol driving the chart
  candles: Candle[];                     // Current chart candles
  timeframe: Timeframe;                  // Selected timeframe
  activeLotSize: number;                 // Lot size for active symbol

  // Option Chain
  optionChain: OptionChain | null;

  // Actions
  initSocket: () => void;
  fetchHistory: () => Promise<void>;
  fetchOptionChain: () => Promise<void>;
  setConnectionStatus: (status: Partial<BrokerConnectionStatus>) => void;
  setMarketStatus: (status: MarketStatus) => void;
  updateTick: (tick: Tick) => void;
  setSpotPrice: (price: number) => void;
  setCandles: (candles: Candle[]) => void;
  addCandle: (candle: Candle) => void;
  updateLastCandle: (candle: Candle) => void;
  setTimeframe: (tf: Timeframe) => void;
  subscribePositionSymbols: (symbols: string[]) => void;
  setActiveSymbol: (symbol: string, lotSize?: number) => void;
  setActiveLotSize: (lotSize: number) => void;
  setOptionChain: (chain: OptionChain) => void;
  reset: () => void;
}

const _defaultSymbol = getCurrentFuturesSymbol();
const _storedSymbol = typeof window !== 'undefined' ? (localStorage.getItem('activeSymbol') || _defaultSymbol) : _defaultSymbol;
const _storedLotSize = typeof window !== 'undefined' ? parseInt(localStorage.getItem('activeLotSize') || '0', 10) || getLotSizeForSymbol(_storedSymbol) : getLotSizeForSymbol(_storedSymbol);

const initialState = {
  connectionStatus: {
    isConnected: false,
    isAuthenticated: false,
    subscribedSymbols: [],
  },
  marketStatus: {
    isOpen: false,
    session: 'CLOSED' as const,
  },
  socket: null,
  ticks: {},
  spotPrice: 0,
  activeSymbol: _storedSymbol,
  candles: [],
  timeframe: '5' as Timeframe,
  activeLotSize: _storedLotSize,
  optionChain: null,
};

export const useMarketStore = create<MarketState>((set, get) => ({
  ...initialState,

  fetchOptionChain: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('fyers_access_token') : null;
    if (!token) return;

    try {
      const res = await fetch(`/api/option-chain?symbol=NSE:NIFTYBANK-INDEX&strikecount=10&token=${token}`);
      const data = await res.json();
      if (data.strikes && data.strikes.length > 0) {
        set({ 
          optionChain: { 
            strikes: data.strikes, 
            underlying: data.underlying, 
            spotPrice: data.spotPrice,
            expiry: data.expiry || '',
            atmStrike: data.atmStrike || 0,
            updatedAt: Date.now()
          },
          ...(data.spotPrice ? { spotPrice: data.spotPrice } : {}),
        });
        console.log(`Option Chain: ${data.strikes.length} strikes, spot=${data.spotPrice}, atm=${data.atmStrike}`);
      }
    } catch (err) {
      console.error('Failed to fetch option chain:', err);
    }
  },

  fetchHistory: async () => {
    const state = get();
    // Always read from localStorage — don't gate on isAuthenticated flag
    const token = typeof window !== 'undefined' ? localStorage.getItem('fyers_access_token') : null;

    if (!token) {
      console.warn('fetchHistory: No Fyers token found in localStorage');
      return;
    }

    try {
      const res = await fetch(`/api/history?symbol=${encodeURIComponent(state.activeSymbol)}&resolution=${state.timeframe}&days=5&token=${token}`);
      const data = await res.json();
      if (res.ok && data.candles && data.candles.length > 0) {
        set({ candles: data.candles, spotPrice: data.candles[data.candles.length - 1].close });
        console.log(`Loaded ${data.candles.length} historical candles for ${state.activeSymbol} on TF ${state.timeframe}`);
      } else {
        console.warn(`No candle data for ${state.activeSymbol}: ${data.error || 'empty response'}`);
        set({ candles: [] });
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      set({ candles: [] });
    }
  },

  initSocket: () => {
    const { socket, connectionStatus } = get();
    if (socket) return; // Already initialized

    const token = typeof window !== 'undefined' ? localStorage.getItem('fyers_access_token') : null;
    if (!token) return;

    set({ connectionStatus: { ...connectionStatus, isAuthenticated: true } });

    const newSocket: Socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002', {
  auth: { token },
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['polling', 'websocket'],
});
    
    set({ socket: newSocket });

    newSocket.on('connect', () => {
      console.log('Connected to Market Data Server');
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, isConnected: true },
        marketStatus: { isOpen: true, session: 'OPEN' }
      }));

      // Auto-subscribe to the active symbol
      newSocket.emit('subscribe', [get().activeSymbol]);

      // Fetch historical candles for the chart
      get().fetchHistory();

      // Fetch the real option chain on connect
      get().fetchOptionChain();
    });

    newSocket.on('authenticated', () => {
      console.log('Fyers WebSocket Authenticated');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from Market Data Server');
      set((state) => ({ 
        connectionStatus: { ...state.connectionStatus, isConnected: false },
        marketStatus: { isOpen: false, session: 'CLOSED' }
      }));
    });

    newSocket.on('ticks', (newTicks: Tick[]) => {
      set((state) => {
        const nextTicks = { ...state.ticks };
        const nextCandles = [...state.candles];
        let newSpot = state.spotPrice;

        newTicks.forEach(tick => {
          nextTicks[tick.symbol] = tick;
          if (tick.symbol === state.activeSymbol) {
            newSpot = tick.ltp;
            
            if (nextCandles.length > 0) {
              const last = { ...nextCandles[nextCandles.length - 1] };
              last.close = tick.ltp;
              last.high = Math.max(last.high, tick.ltp);
              last.low = Math.min(last.low, tick.ltp);
              nextCandles[nextCandles.length - 1] = last;
            }
          }
        });

        return { ticks: nextTicks, spotPrice: newSpot, candles: nextCandles };
      });

      if (onTickPositionUpdate) {
        onTickPositionUpdate(newTicks);
      }
    });

    newSocket.on('position_closed', (data: any) => {
      if (onServerEvent) onServerEvent('position_closed', data);
    });

    newSocket.on('order_filled', (data: any) => {
      if (onServerEvent) onServerEvent('order_filled', data);
    });

    newSocket.on('sl_updated', (data: any) => {
      if (onServerEvent) onServerEvent('sl_updated', data);
    });

    set({ socket: newSocket });
  },

  setConnectionStatus: (status) => set((s) => ({ connectionStatus: { ...s.connectionStatus, ...status } })),
  setMarketStatus: (status) => set({ marketStatus: status }),

  updateTick: (tick) =>
    set((state) => ({
      ticks: { ...state.ticks, [tick.symbol]: tick },
    })),

  setSpotPrice: (price) => set({ spotPrice: price }),

  setCandles: (candles) => set({ candles }),

  addCandle: (candle) =>
    set((state) => ({ candles: [...state.candles, candle] })),

  updateLastCandle: (candle) =>
    set((state) => {
      const updated = [...state.candles];
      if (updated.length > 0) {
        updated[updated.length - 1] = candle;
      } else {
        updated.push(candle);
      }
      return { candles: updated };
    }),

  setTimeframe: (tf) => {
    set({ timeframe: tf });
    get().fetchHistory();
  },
  subscribePositionSymbols: (symbols: string[]) => {
    const { socket } = get();
    if (!socket || !socket.connected) return;
    const unique = [...new Set(symbols)].filter(s => s);
    if (unique.length > 0) {
      socket.emit('subscribe', unique);
    }
  },
  setActiveSymbol: (sym, lotSize) => {
    const { socket, activeSymbol } = get();
    if (socket && socket.connected) {
      socket.emit('unsubscribe', [activeSymbol]);
      socket.emit('subscribe', [sym]);
    }
    const resolvedLotSize = (lotSize && lotSize > 0) ? lotSize : getLotSizeForSymbol(sym);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeSymbol', sym);
      localStorage.setItem('activeLotSize', String(resolvedLotSize));
    }
    set({ activeSymbol: sym, candles: [], activeLotSize: resolvedLotSize } as any);
    // Reset order quantity to 1 lot of the new symbol
    try {
      const { useTradingStore } = require('@/stores/tradingStore');
      useTradingStore.getState().setOrderQuantity(resolvedLotSize);
    } catch {}
    get().fetchHistory();
  },
  setActiveLotSize: (lotSize) => set({ activeLotSize: lotSize }),
  setOptionChain: (chain) => set({ optionChain: chain }),
  reset: () => {
    const { socket } = get();
    if (socket) socket.disconnect();
    set(initialState);
  },
}));
