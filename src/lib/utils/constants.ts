// ═══════════════════════════════════════════════════════════════
// Constants for BANK NIFTY Paper Trading
// ═══════════════════════════════════════════════════════════════

// Bank Nifty Configuration
export const BANK_NIFTY = {
  INDEX_SYMBOL: 'NSE:NIFTYBANK-INDEX',
  LOT_SIZE: 30,
  TICK_SIZE: 0.05,
  STRIKE_GAP: 100,          // Gap between option strikes
  STRIKES_AROUND_ATM: 15,   // Number of strikes above & below ATM to show
  EXCHANGE: 'NSE',
  UNDERLYING: 'BANKNIFTY',
} as const;

// Market Timings (IST)
export const MARKET_TIMINGS = {
  PRE_OPEN_START: { hour: 9, minute: 0 },
  MARKET_OPEN: { hour: 9, minute: 15 },
  MARKET_CLOSE: { hour: 15, minute: 30 },
  POST_CLOSE_END: { hour: 16, minute: 0 },
} as const;

// Trading Days (0 = Sunday, 6 = Saturday)
export const TRADING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

// Default Paper Trading Config
export const DEFAULT_CONFIG = {
  STARTING_CAPITAL: 1000000,    // ₹10,00,000
  FUTURES_MARGIN_PERCENT: 15,   // 15% margin for futures
  MAX_ORDER_VALUE: 5000000,     // Max ₹50L per order
  MAX_POSITIONS: 10,            // Max 10 simultaneous positions
} as const;

// Timeframe Options
export const TIMEFRAMES = [
  { label: '1m', value: '1', seconds: 60 },
  { label: '3m', value: '3', seconds: 180 },
  { label: '5m', value: '5', seconds: 300 },
  { label: '15m', value: '15', seconds: 900 },
  { label: '30m', value: '30', seconds: 1800 },
  { label: '1h', value: '60', seconds: 3600 },
] as const;

// Order Types
export const ORDER_TYPES = [
  { label: 'Market', value: 'MARKET' },
  { label: 'Limit', value: 'LIMIT' },
  { label: 'Stop Loss', value: 'SL' },
  { label: 'SL-Market', value: 'SL-M' },
] as const;

// WebSocket Events
export const WS_EVENTS = {
  // Client → Server
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  PLACE_ORDER: 'place_order',
  CANCEL_ORDER: 'cancel_order',
  CLOSE_POSITION: 'close_position',

  // Server → Client
  TICK: 'tick',
  CANDLE: 'candle',
  OPTION_CHAIN: 'option_chain',
  ORDER_UPDATE: 'order_update',
  POSITION_UPDATE: 'position_update',
  ACCOUNT_UPDATE: 'account_update',
  CONNECTION_STATUS: 'connection_status',
  MARKET_STATUS: 'market_status',
  ERROR: 'error',
} as const;
