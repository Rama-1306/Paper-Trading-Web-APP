// ═══════════════════════════════════════════════════════════════
// Formatting Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Format number as Indian Rupees (₹)
 * Example: 123456.78 → "₹1,23,456.78"
 */
export function formatINR(value: number, decimals = 2): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  const parts = absValue.toFixed(decimals).split('.');
  let intPart = parts[0];
  const decPart = parts[1];
  
  // Indian number formatting: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = grouped + ',' + last3;
  }
  
  const formatted = decimals > 0 ? `₹${intPart}.${decPart}` : `₹${intPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format number with sign and color class
 * Returns { text: "+₹1,234.50", className: "profit" | "loss" | "neutral" }
 */
export function formatPnL(value: number): { text: string; className: string } {
  const formatted = formatINR(Math.abs(value));
  if (value > 0) return { text: `+${formatted}`, className: 'profit' };
  if (value < 0) return { text: `-${formatted}`, className: 'loss' };
  return { text: formatted, className: 'neutral' };
}

/**
 * Format percentage
 * Example: 2.345 → "+2.35%"
 */
export function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with K/L/Cr suffixes (Indian system)
 * Example: 1500000 → "15.00L"
 */
export function formatCompact(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 10000000) return `${sign}${(absValue / 10000000).toFixed(2)}Cr`;
  if (absValue >= 100000) return `${sign}${(absValue / 100000).toFixed(2)}L`;
  if (absValue >= 1000) return `${sign}${(absValue / 1000).toFixed(2)}K`;
  return `${sign}${absValue.toFixed(2)}`;
}

/**
 * Format quantity with lot info
 * Example: (30, 15) → "30 (2 lots)"
 */
export function formatQuantity(qty: number, lotSize: number): string {
  const lots = Math.floor(qty / lotSize);
  return `${qty} (${lots} lot${lots !== 1 ? 's' : ''})`;
}

/**
 * Format timestamp to IST time string
 */
export function formatTime(timestamp: number | string | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format timestamp to IST date + time string
 */
export function formatDateTime(timestamp: number | string | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Get human-readable instrument name from symbol
 * Example: "NSE:BANKNIFTY25MAR55000CE" → "BN 55000 CE"
 */
export function formatSymbol(symbol: string): string {
  // Remove exchange prefix
  const clean = symbol.replace(/^NSE:/, '');
  
  // Try to extract strike and type for options
  const optionMatch = clean.match(/BANKNIFTY\d{2}[A-Z]{3}(\d+)(CE|PE)/);
  if (optionMatch) {
    return `BN ${optionMatch[1]} ${optionMatch[2]}`;
  }
  
  // Futures
  if (clean.includes('FUT')) {
    return 'BN FUT';
  }
  
  // Index
  if (clean.includes('INDEX')) {
    return 'BANK NIFTY';
  }
  
  return clean;
}
