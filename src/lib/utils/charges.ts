/**
 * Approximate Indian derivatives trading charges (Fyers broker model).
 * These are estimates — actual charges may vary slightly.
 */

export interface ChargesBreakdown {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  total: number;
}

function isOptionSymbol(symbol: string): boolean {
  return /\d+(CE|PE)$/i.test(symbol.replace(/^(NSE:|MCX:|BSE:)/, ''));
}

function isMCX(symbol: string): boolean {
  return symbol.startsWith('MCX:');
}

/**
 * Calculate approximate charges for a paper trade.
 * @param symbol  Fyers symbol e.g. NSE:BANKNIFTY26MARFUT
 * @param qty     Quantity (total units, not lots)
 * @param price   Fill price per unit
 * @param side    'BUY' | 'SELL'
 */
export function calculateCharges(
  symbol: string,
  qty: number,
  price: number,
  side: 'BUY' | 'SELL'
): ChargesBreakdown {
  const isOption = isOptionSymbol(symbol);
  const mcx = isMCX(symbol);
  const contractValue = price * qty;

  // Brokerage: Fyers flat ₹20 per order (both sides)
  const brokerage = 20;

  // STT (Securities Transaction Tax)
  // Futures: 0.01% on sell side of contract value
  // Options buy: Nil; Options sell: 0.05% of premium value
  let stt = 0;
  if (!isOption && !mcx) {
    if (side === 'SELL') stt = contractValue * 0.0001;
  } else if (isOption) {
    if (side === 'SELL') stt = contractValue * 0.0005;
  }
  // MCX: no STT (CTT instead — ~0.01% for non-agri, omitted for simplicity)

  // Exchange transaction charges
  // NSE F&O Futures: 0.002% of turnover
  // NSE F&O Options: 0.053% of premium turnover
  // MCX: ~0.0026% for futures
  let exchangeCharges = 0;
  if (!isOption && !mcx) {
    exchangeCharges = contractValue * 0.00002;
  } else if (!isOption && mcx) {
    exchangeCharges = contractValue * 0.000026;
  } else if (isOption) {
    exchangeCharges = contractValue * 0.00053;
  }

  // GST: 18% on (brokerage + exchange charges)
  const gst = (brokerage + exchangeCharges) * 0.18;

  // SEBI charges: ₹10 per crore of turnover
  const sebiCharges = contractValue * 0.0000001;

  // Stamp duty (Karnataka base; varies by state)
  // Futures buy: 0.002%; Options buy: 0.003%; Sell side: 0 (buyer pays)
  let stampDuty = 0;
  if (side === 'BUY') {
    const rate = isOption ? 0.00003 : 0.00002;
    stampDuty = Math.min(contractValue * rate, 300);
  }

  const total = brokerage + stt + exchangeCharges + gst + sebiCharges + stampDuty;

  return {
    brokerage,
    stt,
    exchangeCharges,
    gst,
    sebiCharges,
    stampDuty,
    total,
  };
}
