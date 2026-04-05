// ═══════════════════════════════════════════════════════════════
// Broker (Fyers) API Types
// ═══════════════════════════════════════════════════════════════

export interface FyersAuthConfig {
  appId: string;
  secretKey: string;
  redirectUri: string;
}

export interface FyersTokenResponse {
  s: string;          // "ok" or "error"
  code: number;
  message: string;
  access_token: string;
}

export interface FyersTick {
  symbol: string;
  fyToken: string;
  ltp: number;
  open_price: number;
  high_price: number;
  low_price: number;
  prev_close_price: number;
  vol_traded_today: number;
  oi?: number;
  tot_buy_qty: number;
  tot_sell_qty: number;
  bid_price: number;
  ask_price: number;
  ch: number;          // change
  chp: number;         // change percentage
  tt: number;          // timestamp
  cmd?: {              // candle data
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    t: number;
  };
}

export interface FyersQuote {
  n: string;           // symbol
  s: string;           // status
  v: {
    lp: number;        // last price
    open: number;
    high: number;
    low: number;
    close: number;     // prev close
    volume: number;
    ch: number;
    chp: number;
    ask: number;
    bid: number;
    spread: number;
    tt: number;
  };
}

export interface FyersHistoryResponse {
  s: string;
  candles: number[][]; // [timestamp, open, high, low, close, volume]
}

export interface FyersOptionChainResponse {
  s: string;
  data: {
    expiryData: Array<{
      date: string;
      expiry: number;
    }>;
    optionsChain: Array<{
      symbol: string;
      strikePrice: number;
      option_type: string; // "CE" | "PE"
      ltp: number;
      openInterest: number;
      volume: number;
      iv: number;
      bid: number;
      ask: number;
      change: number;
      changePer: number;
    }>;
  };
}

export type WebSocketDataMode = 'liteMode' | 'fullMode';

export interface BrokerConnectionStatus {
  isConnected: boolean;   // Socket.IO connection to WS server is up
  isFeedLive: boolean;    // Fyers data socket is actually streaming ticks
  isAuthenticated: boolean;
  lastTickTime?: number;
  subscribedSymbols: string[];
  error?: string;
}
