export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type PositionSide = 'BUY' | 'SELL';

export interface OrderRequest {
  symbol: string;
  displayName: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  stopLoss?: number;
  targetPrice?: number;
  trailingSL?: boolean;
  trailingDistance?: number;
}

export interface OrderResponse {
  id: string;
  symbol: string;
  displayName: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  status: OrderStatus;
  filledPrice?: number;
  rejectedReason?: string;
  positionId?: string;
  createdAt: string;
  filledAt?: string;
}

export interface PositionData {
  id: string;
  symbol: string;
  displayName: string;
  instrumentType: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number | null;
  targetPrice: number | null;
  trailingSL: boolean;
  trailingDistance: number | null;
  exitReason: string | null;
  isOpen: boolean;
  createdAt: string;
}

export interface TradeData {
  id: string;
  symbol: string;
  displayName: string;
  side: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  exitReason: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  entryTime: string;
  exitTime: string;
}

export interface AccountData {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  usedMargin: number;
  availableMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  positions: PositionData[];
  openOrdersCount: number;
}

export interface AccountSummary {
  balance: number;
  initialBalance: number;
  usedMargin: number;
  availableMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalPnlPercent: number;
  todayPnl: number;
  winRate: number;
  totalTrades: number;
}
