// ═══════════════════════════════════════════════════════════════
// Market Data Types
// ═══════════════════════════════════════════════════════════════

export interface Tick {
  symbol: string;
  ltp: number;         // Last Traded Price
  open: number;
  high: number;
  low: number;
  close: number;       // Previous close
  volume: number;
  oi?: number;         // Open Interest (for F&O)
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export interface Candle {
  time: number;        // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface OptionData {
  symbol: string;
  strikePrice: number;
  expiry: string;
  type: 'CE' | 'PE';
  ltp: number;
  change: number;
  changePercent: number;
  volume: number;
  oi: number;
  oiChange: number;
  bid: number;
  ask: number;
  iv?: number;         // Implied Volatility
  // Greeks (optional, calculated)
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionChainStrike {
  strikePrice: number;
  ce?: OptionData;
  pe?: OptionData;
}

export interface OptionChain {
  underlying: string;
  spotPrice: number;
  expiry: string;
  strikes: OptionChainStrike[];
  atmStrike: number;
  updatedAt: number;
}

export type InstrumentType = 'INDEX' | 'FUTURES' | 'CE' | 'PE';

export interface Instrument {
  symbol: string;
  displayName: string;
  type: InstrumentType;
  exchange: string;
  lotSize: number;
  strikePrice?: number;
  expiry?: string;
}

export type Timeframe = '1' | '3' | '5' | '15' | '30' | '60';

export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: string;
  nextClose?: string;
  session: 'PRE' | 'OPEN' | 'CLOSED' | 'POST';
}
