const MONTH_CODES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function getYY(date: Date): string {
  return String(date.getFullYear()).slice(-2);
}

function getMonthCode(date: Date): string {
  return MONTH_CODES[date.getMonth()];
}

function getNextMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function getCurrentFuturesSymbol(): string {
  const now = new Date();
  return `NSE:BANKNIFTY${getYY(now)}${getMonthCode(now)}FUT`;
}

export function getNextFuturesSymbol(): string {
  const now = new Date();
  const next = getNextMonth(now);
  return `NSE:BANKNIFTY${getYY(next)}${getMonthCode(next)}FUT`;
}

export function getCurrentFuturesLabel(): string {
  const now = new Date();
  return `BN ${getMonthCode(now)} FUT`;
}

export function getNextFuturesLabel(): string {
  const now = new Date();
  const next = getNextMonth(now);
  return `BN ${getMonthCode(next)} FUT`;
}

export interface SymbolItem {
  value: string;
  label: string;
  group: string;
  lotSize?: number;
  expiry?: string;
}

export function getBankNiftySymbols(): SymbolItem[] {
  return [
    { value: getCurrentFuturesSymbol(), label: getCurrentFuturesLabel(), group: 'Bank Nifty', lotSize: 30 },
    { value: getNextFuturesSymbol(), label: getNextFuturesLabel(), group: 'Bank Nifty', lotSize: 30 },
    { value: 'NSE:NIFTYBANK-INDEX', label: 'BN Index (Spot)', group: 'Bank Nifty', lotSize: 30 },
  ];
}

export function getPredefinedSymbols(): SymbolItem[] {
  return getBankNiftySymbols();
}

export function parseSymbolDisplay(symbol: string): string {
  if (!symbol) return '';
  const clean = symbol.replace('NSE:', '').replace('MCX:', '');
  if (clean === 'NIFTYBANK-INDEX') return 'BANKNIFTY SPOT';
  if (clean.endsWith('FUT')) {
    const bnMatch = clean.match(/BANKNIFTY(\d{2})([A-Z]{3})FUT/);
    if (bnMatch) return `BANKNIFTY ${bnMatch[2]} FUT`;
    const mcxMatch = clean.match(/^([A-Z]+?)(\d{2})([A-Z]{3})FUT$/);
    if (mcxMatch) return `${mcxMatch[1]} ${mcxMatch[3]} FUT`;
    return clean;
  }
  const optMatch = clean.match(/BANKNIFTY\d{2}[A-Z\d]+?(\d{5,6})(CE|PE)$/);
  if (optMatch) return `BN ${optMatch[1]} ${optMatch[2]}`;
  return clean;
}
