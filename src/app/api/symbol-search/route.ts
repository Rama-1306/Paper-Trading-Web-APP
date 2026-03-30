import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const SYMBOL_MASTER_URLS: Record<string, string> = {
  'MCX_COM': 'https://public.fyers.in/sym_details/MCX_COM.csv',
  'NSE_FO': 'https://public.fyers.in/sym_details/NSE_FO.csv',
};

const MCX_LOT_SIZES: Record<string, number> = {
  'CRUDEOIL': 100,
  'CRUDEOILM': 10,
  'NATGAS': 1250,
  'NATGASMINI': 250,
  'GOLD': 100,
  'GOLDM': 10,
  'GOLDGUINEA': 1,
  'GOLDPETAL': 1,
  'GOLDTEN': 10,
  'SILVER': 30,
  'SILVERM': 5,
  'SILVERMIC': 1,
  'COPPER': 2500,
  'ALUMINIUM': 5000,
  'ZINC': 5000,
  'LEAD': 5000,
  'NICKEL': 1500,
  'MENTHAOIL': 360,
  'COTTONCANDY': 25,
  'CPO': 10,
};

const NSE_LOT_SIZES: Record<string, number> = {
  'BANKNIFTY': 30,
  'NIFTY': 75,
  'FINNIFTY': 65,
  'MIDCPNIFTY': 120,
};

function getLotSize(underlying: string, exchange: string): number {
  if (exchange === 'MCX') {
    return MCX_LOT_SIZES[underlying] || 1;
  }
  if (exchange === 'NSE') {
    return NSE_LOT_SIZES[underlying] || 1;
  }
  return 1;
}

interface ParsedSymbol {
  symbol: string;
  description: string;
  lotSize: number;
  expiry: number;
  underlying: string;
  optionType: string;
  exchange: string;
}

let symbolCache: { data: ParsedSymbol[]; timestamp: number } | null = null;
const CACHE_TTL = 4 * 60 * 60 * 1000;

function parseCSVLine(line: string): ParsedSymbol | null {
  const cols = line.split(',');
  if (cols.length < 18) return null;

  const symbolTicker = cols[9] || '';
  const description = cols[1] || '';
  const expiryTs = parseInt(cols[8]) || 0;
  const underlying = cols[13] || '';
  const optionType = cols[16] || '';

  if (!symbolTicker) return null;

  const exchange = symbolTicker.split(':')[0] || '';
  const lotSize = getLotSize(underlying, exchange);

  return {
    symbol: symbolTicker,
    description,
    lotSize,
    expiry: expiryTs,
    underlying,
    optionType,
    exchange,
  };
}

async function fetchAllSymbols(): Promise<ParsedSymbol[]> {
  if (symbolCache && Date.now() - symbolCache.timestamp < CACHE_TTL) {
    return symbolCache.data;
  }

  const allSymbols: ParsedSymbol[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const [key, url] of Object.entries(SYMBOL_MASTER_URLS)) {
    try {
      const res = await axios.get(url, { timeout: 15000 });
      const lines = res.data.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const parsed = parseCSVLine(lines[i]);
        if (!parsed) continue;
        if (parsed.expiry > 0 && parsed.expiry < now) continue;
        allSymbols.push(parsed);
      }
    } catch (err: any) {
      console.error(`Failed to fetch ${key}:`, err.message);
    }
  }

  if (allSymbols.length > 0) {
    symbolCache = { data: allSymbols, timestamp: Date.now() };
  }
  return allSymbols;
}

// Predefined index symbols returned for matching queries
const NSE_INDICES = [
  { value: 'NSE:NIFTYBANK-INDEX', label: 'Bank Nifty Index', group: 'NSE', lotSize: 30, expiry: 0 },
  { value: 'NSE:NIFTY50-INDEX', label: 'Nifty 50 Index', group: 'NSE', lotSize: 75, expiry: 0 },
  { value: 'NSE:FINNIFTY-INDEX', label: 'Fin Nifty Index', group: 'NSE', lotSize: 65, expiry: 0 },
  { value: 'NSE:MIDCPNIFTY-INDEX', label: 'Mid Cap Nifty Index', group: 'NSE', lotSize: 120, expiry: 0 },
  { value: 'BSE:SENSEX-INDEX', label: 'Sensex Index', group: 'BSE', lotSize: 10, expiry: 0 },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get('q') || '').toUpperCase();
    const exchange = searchParams.get('exchange') || '';
    const type = searchParams.get('type') || 'futures';
    const limit = parseInt(searchParams.get('limit') || '30');

    const allSymbols = await fetchAllSymbols();

    let filtered = allSymbols.filter(s => {
      // type=all: no instrument-type filter; type=futures: futures only; type=options: options only
      if (type === 'futures' && s.optionType !== 'XX') return false;
      if (type === 'options' && s.optionType !== 'CE' && s.optionType !== 'PE') return false;
      // type=all: pass through all optionTypes
      if (exchange && s.exchange !== exchange.toUpperCase()) return false;

      if (!query || query.length < 2) {
        if (exchange === 'MCX') {
          const MCX_POPULAR = ['CRUDEOIL', 'CRUDEOILM', 'NATGAS', 'NATGASMINI', 'GOLD', 'GOLDM', 'GOLDGUINEA', 'GOLDPETAL', 'SILVER', 'SILVERM', 'SILVERMIC', 'COPPER'];
          return MCX_POPULAR.some(p => s.underlying === p);
        }
        return false;
      }

      return s.symbol.toUpperCase().includes(query) ||
             s.description.toUpperCase().includes(query) ||
             s.underlying.toUpperCase().includes(query);
    });

    filtered.sort((a, b) => {
      if (a.underlying !== b.underlying) return a.underlying.localeCompare(b.underlying);
      return a.expiry - b.expiry;
    });

    filtered = filtered.slice(0, limit);

    const results = filtered.map(s => ({
      value: s.symbol,
      label: s.description,
      group: s.exchange,
      lotSize: s.lotSize,
      expiry: s.expiry,
    }));

    // Prepend matching NSE index symbols when query is provided
    if (query.length >= 2) {
      const matchingIndices = NSE_INDICES.filter(idx =>
        idx.label.toUpperCase().includes(query) ||
        idx.value.toUpperCase().includes(query)
      );
      results.unshift(...matchingIndices);
    }

    return NextResponse.json({ results, total: results.length });
  } catch (error: any) {
    console.error('Symbol Search Error:', error.message);
    return NextResponse.json({ error: 'Failed to search symbols' }, { status: 500 });
  }
}
