'use client';

import { useState, useEffect, useCallback } from 'react';

interface DepthLevel {
  price: number;
  qty: number;
  orders: number;
}

interface DepthData {
  bids: DepthLevel[];
  asks: DepthLevel[];
  totalBuyQty: number;
  totalSellQty: number;
}

interface MarketDepthProps {
  symbol: string;
  onPriceSelect?: (price: number) => void;
}

export function MarketDepth({ symbol, onPriceSelect }: MarketDepthProps) {
  const [depth, setDepth] = useState<DepthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDepth = useCallback(async () => {
    if (!symbol) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('fyers_access_token') : null;
    if (!token) {
      setError('Connect Fyers to view market depth');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market-depth?symbol=${encodeURIComponent(symbol)}&token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setDepth(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Depth unavailable');
      }
    } catch {
      setError('Failed to fetch depth');
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchDepth();
    const interval = setInterval(fetchDepth, 3000);
    return () => clearInterval(interval);
  }, [fetchDepth]);

  const maxQty = depth
    ? Math.max(...depth.bids.map(b => b.qty), ...depth.asks.map(a => a.qty), 1)
    : 1;

  return (
    <div style={{
      background: 'var(--bg-input)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      fontSize: '11px',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ padding: '4px 8px', color: 'var(--color-buy)', fontWeight: 700, fontSize: '10px', textAlign: 'center' }}>
          BID ({depth ? depth.totalBuyQty.toLocaleString('en-IN') : '—'})
        </div>
        <div style={{ padding: '4px 8px', color: 'var(--color-sell)', fontWeight: 700, fontSize: '10px', textAlign: 'center' }}>
          ASK ({depth ? depth.totalSellQty.toLocaleString('en-IN') : '—'})
        </div>
      </div>

      {loading && !depth && (
        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      )}
      {error && !depth && (
        <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>{error}</div>
      )}

      {depth && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Bids column */}
          <div style={{ borderRight: '1px solid var(--border-primary)' }}>
            {depth.bids.map((bid, i) => (
              <div
                key={i}
                onClick={() => onPriceSelect?.(bid.price)}
                style={{
                  padding: '3px 8px',
                  cursor: onPriceSelect ? 'pointer' : 'default',
                  position: 'relative',
                  borderBottom: i < depth.bids.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                }}
                title={onPriceSelect ? `Set limit price to ${bid.price}` : undefined}
                onMouseEnter={e => { if (onPriceSelect) (e.currentTarget as HTMLElement).style.background = 'rgba(41,121,255,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(bid.qty / maxQty) * 100}%`,
                  background: 'rgba(41, 121, 255, 0.08)',
                  pointerEvents: 'none',
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                  <span style={{ color: 'var(--color-buy)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {bid.price.toFixed(2)}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{bid.qty.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Asks column */}
          <div>
            {depth.asks.map((ask, i) => (
              <div
                key={i}
                onClick={() => onPriceSelect?.(ask.price)}
                style={{
                  padding: '3px 8px',
                  cursor: onPriceSelect ? 'pointer' : 'default',
                  position: 'relative',
                  borderBottom: i < depth.asks.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                }}
                title={onPriceSelect ? `Set limit price to ${ask.price}` : undefined}
                onMouseEnter={e => { if (onPriceSelect) (e.currentTarget as HTMLElement).style.background = 'rgba(255,109,0,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(ask.qty / maxQty) * 100}%`,
                  background: 'rgba(255, 109, 0, 0.08)',
                  pointerEvents: 'none',
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                  <span style={{ color: 'var(--color-sell)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {ask.price.toFixed(2)}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{ask.qty.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        padding: '3px 8px',
        borderTop: '1px solid var(--border-primary)',
        textAlign: 'center',
        fontSize: '9px',
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Click price to set limit</span>
        <span style={{ cursor: 'pointer', color: 'var(--color-accent)' }} onClick={fetchDepth}>↻ Refresh</span>
      </div>
    </div>
  );
}
