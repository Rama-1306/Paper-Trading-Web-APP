import axios from 'axios';

export interface MarginResult {
  totalMargin: number;
  spanMargin: number;
  exposureMargin: number;
  hedgeBenefit: number;
  source: 'fyers' | 'fallback';
}

export interface MarginPosition {
  symbol: string;
  qty: number;
  side: number;
  productType?: string;
}

const MARGIN_PER_LOT: Record<string, number> = {
  'BANKNIFTY': 55000,
  'NIFTY': 85000,
  'FINNIFTY': 38000,
  'MIDCPNIFTY': 26000,
  'CRUDEOIL': 90000,
  'CRUDEOILM': 28000,
  'NATURALGAS': 65000,
  'NATGAS': 65000,
  'NATGASMINI': 16000,
  'GOLD': 190000,
  'GOLDM': 19000,
  'GOLDPETAL': 6000,
  'GOLDTEN': 19000,
  'GOLDGUINEA': 6000,
  'SILVER': 120000,
  'SILVERM': 28000,
  'SILVERMIC': 9000,
  'COPPER': 38000,
  'ZINC': 55000,
  'LEAD': 35000,
  'ALUMINIUM': 48000,
  'NICKEL': 65000,
  'MENTHAOIL': 30000,
  'CPO': 12000,
};

const LOT_SIZES: Record<string, number> = {
  'BANKNIFTY': 30,
  'NIFTY': 75,
  'FINNIFTY': 65,
  'MIDCPNIFTY': 120,
  'CRUDEOIL': 100,
  'CRUDEOILM': 10,
  'NATURALGAS': 1250,
  'GOLD': 100,
  'GOLDM': 10,
  'GOLDPETAL': 100,
  'SILVER': 30,
  'SILVERM': 5,
  'SILVERMIC': 1,
  'COPPER': 2500,
  'ZINC': 5000,
  'LEAD': 5000,
  'ALUMINIUM': 5000,
  'NICKEL': 1500,
};

const OPTION_SELL_MARGIN_PER_LOT: Record<string, number> = {
  'BANKNIFTY': 48000,
  'NIFTY': 75000,
  'FINNIFTY': 32000,
  'MIDCPNIFTY': 22000,
};

function extractUnderlying(symbol: string): string {
  const clean = symbol.replace(/^(NSE:|MCX:|BSE:)/, '');

  for (const key of Object.keys(MARGIN_PER_LOT).sort((a, b) => b.length - a.length)) {
    if (clean.toUpperCase().startsWith(key.toUpperCase())) {
      return key;
    }
  }

  return clean.replace(/\d.*/, '');
}

function getLotSize(underlying: string): number {
  return LOT_SIZES[underlying.toUpperCase()] || 1;
}

function isOptionSymbol(symbol: string): boolean {
  const clean = symbol.replace(/^(NSE:|MCX:|BSE:)/, '');
  return /\d+(CE|PE)$/i.test(clean);
}

function isOptionSell(symbol: string, side: number): boolean {
  return isOptionSymbol(symbol) && side === -1;
}

export function calculateFallbackMargin(positions: MarginPosition[]): MarginResult {
  let totalMargin = 0;

  const optionSells: MarginPosition[] = [];
  const optionBuys: MarginPosition[] = [];

  for (const pos of positions) {
    const underlying = extractUnderlying(pos.symbol);
    const lotSize = getLotSize(underlying);
    const lots = Math.max(1, Math.round(Math.abs(pos.qty) / lotSize));

    if (isOptionSymbol(pos.symbol)) {
      if (pos.side === -1) {
        optionSells.push(pos);
        const marginPerLot = OPTION_SELL_MARGIN_PER_LOT[underlying.toUpperCase()] || MARGIN_PER_LOT[underlying.toUpperCase()] || 25000;
        totalMargin += marginPerLot * lots;
      } else {
        optionBuys.push(pos);
      }
    } else {
      const marginPerLot = MARGIN_PER_LOT[underlying.toUpperCase()] || 25000;
      totalMargin += marginPerLot * lots;
    }
  }

  let hedgeBenefit = 0;

  if (optionSells.length > 0 && optionBuys.length > 0) {
    for (const sell of optionSells) {
      const sellUnderlying = extractUnderlying(sell.symbol);
      const sellLotSize = getLotSize(sellUnderlying);
      const sellLots = Math.max(1, Math.round(Math.abs(sell.qty) / sellLotSize));

      const matchingBuy = optionBuys.find(buy => {
        const buyUnderlying = extractUnderlying(buy.symbol);
        return buyUnderlying.toUpperCase() === sellUnderlying.toUpperCase();
      });

      if (matchingBuy) {
        const buyLotSize = getLotSize(extractUnderlying(matchingBuy.symbol));
        const buyLots = Math.max(1, Math.round(Math.abs(matchingBuy.qty) / buyLotSize));
        const hedgedLots = Math.min(sellLots, buyLots);
        const marginPerLot = OPTION_SELL_MARGIN_PER_LOT[sellUnderlying.toUpperCase()] || MARGIN_PER_LOT[sellUnderlying.toUpperCase()] || 25000;
        hedgeBenefit += marginPerLot * hedgedLots * 0.7;
      }
    }

    totalMargin = Math.max(0, totalMargin - hedgeBenefit);
  }

  return {
    totalMargin,
    spanMargin: totalMargin * 0.7,
    exposureMargin: totalMargin * 0.3,
    hedgeBenefit,
    source: 'fallback',
  };
}

export async function calculateFyersMargin(
  positions: MarginPosition[],
  token: string,
  appId: string
): Promise<MarginResult | null> {
  try {
    const data = positions.map(p => ({
      symbol: p.symbol,
      qty: Math.abs(p.qty),
      side: p.side,
      type: 2,
      productType: p.productType || 'INTRADAY',
      limitPrice: 0,
      stopPrice: 0,
    }));

    const response = await axios.post(
      'https://api-t1.fyers.in/api/v3/span-margin',
      { data },
      {
        headers: {
          'Authorization': `${appId}:${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    if (response.data?.s === 'ok' && response.data?.d) {
      const d = response.data.d;
      return {
        totalMargin: d.total || d.totalMargin || 0,
        spanMargin: d.span || d.spanMargin || 0,
        exposureMargin: d.exposure || d.exposureMargin || 0,
        hedgeBenefit: d.hedgeBenefit || d.spreadBenefit || 0,
        source: 'fyers',
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function getMarginRequired(
  positions: MarginPosition[],
  token?: string | null,
  appId?: string | null
): Promise<MarginResult> {
  if (token && appId) {
    const fyersResult = await calculateFyersMargin(positions, token, appId);
    if (fyersResult && fyersResult.totalMargin > 0) {
      return fyersResult;
    }
  }

  return calculateFallbackMargin(positions);
}

export function getLotSizeForSymbol(symbol: string): number {
  const underlying = extractUnderlying(symbol);
  return getLotSize(underlying);
}

export function getMarginPerLot(symbol: string): number {
  const underlying = extractUnderlying(symbol);

  if (isOptionSymbol(symbol)) {
    return OPTION_SELL_MARGIN_PER_LOT[underlying.toUpperCase()] || 25000;
  }

  return MARGIN_PER_LOT[underlying.toUpperCase()] || 25000;
}

export function getQuickMargin(symbol: string, qty: number, side: number): number {
  const underlying = extractUnderlying(symbol);
  const lotSize = getLotSize(underlying);
  const lots = Math.max(1, Math.round(Math.abs(qty) / lotSize));

  if (isOptionSymbol(symbol) && side === 1) {
    return 0;
  }

  if (isOptionSell(symbol, side)) {
    const marginPerLot = OPTION_SELL_MARGIN_PER_LOT[underlying.toUpperCase()] || 25000;
    return marginPerLot * lots;
  }

  const marginPerLot = MARGIN_PER_LOT[underlying.toUpperCase()] || 25000;
  return marginPerLot * lots;
}
