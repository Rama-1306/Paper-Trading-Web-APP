'use client';

import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { formatINR } from '@/lib/utils/formatters';
import { ORDER_TYPES } from '@/lib/utils/constants';
import { parseSymbolDisplay, getCurrentFuturesSymbol } from '@/lib/utils/symbols';
import { getQuickMargin } from '@/lib/utils/margins';
import { MarketDepth } from '@/components/Trading/MarketDepth';
import { calculateCharges } from '@/lib/utils/charges';
import type { OrderType } from '@/types/trading';
interface OrderPanelProps {
  onOrderPlaced?: () => void;
  isMobile?: boolean;
}

export function OrderPanel({ onOrderPlaced, isMobile = false }: OrderPanelProps = {}) {
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [price, setPrice] = useState<string>('');
  const [triggerPrice, setTriggerPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [showBracket, setShowBracket] = useState(false);
  const [trailingSL, setTrailingSL] = useState(false);
  const [trailingDistance, setTrailingDistance] = useState<string>('');
  const [showCharges, setShowCharges] = useState(false);
  // Mobile-only: order form is collapsed by default, opened with +/− toggle
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);

  const orderSide = useTradingStore((s) => s.orderSide);
  const orderQuantity = useTradingStore((s) => s.orderQuantity);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setOrderSide = useTradingStore((s) => s.setOrderSide);
  const setOrderQuantity = useTradingStore((s) => s.setOrderQuantity);
  const account = useTradingStore((s) => s.account);
  const positions = useTradingStore((s) => s.positions);
  const trades = useTradingStore((s) => s.trades);
  const addNotification = useUIStore((s) => s.addNotification);

  const ticks = useMarketStore((s) => s.ticks);
  const activeLotSize = useMarketStore((s) => s.activeLotSize);
  const activeSymbol = useMarketStore((s) => s.activeSymbol);

  const lotSize = activeLotSize || 30;

  // Use selectedSymbol if set; fall back to activeSymbol (from chart) so price always reflects the instrument shown
  const sym = selectedSymbol || activeSymbol || getCurrentFuturesSymbol();
  const currentTick = ticks[sym] ?? null;
  const currentPrice = currentTick?.ltp ?? 0;
  const priceChange = currentTick?.change ?? 0;
  const priceChangePct = currentTick?.changePercent ?? 0;

  const lots = Math.floor(orderQuantity / lotSize);
  const orderValue = currentPrice * orderQuantity;

  const sideNum = orderSide === 'BUY' ? 1 : -1;
  const marginRequired = getQuickMargin(sym, orderQuantity, sideNum);
  const isOptionBuy = /\d+(CE|PE)$/i.test(sym.replace(/^(NSE:|MCX:|BSE:)/, '')) && orderSide === 'BUY';
  const premiumCost = isOptionBuy ? currentPrice * orderQuantity : 0;
  const charges = currentPrice > 0 ? calculateCharges(sym, orderQuantity, currentPrice, orderSide) : null;

  const handleSubmit = async () => {
    if (orderQuantity < lotSize) {
      addNotification({ type: 'error', title: 'Invalid Quantity', message: `Minimum order quantity is ${lotSize} (1 lot)` });
      return;
    }

    if (orderQuantity % lotSize !== 0) {
      addNotification({ type: 'error', title: 'Invalid Quantity', message: `Quantity must be in multiples of ${lotSize}` });
      return;
    }

    if (orderType === 'MARKET' && currentPrice <= 0) {
      addNotification({ type: 'error', title: 'No Market Price', message: 'Cannot place market order — live price not available. Connect to Fyers first.' });
      return;
    }

    if ((orderType === 'LIMIT' || orderType === 'SL') && !price) {
      addNotification({ type: 'error', title: 'Price Required', message: 'Please enter a limit price' });
      return;
    }

    if ((orderType === 'SL' || orderType === 'SL-M') && !triggerPrice) {
      addNotification({ type: 'error', title: 'Trigger Required', message: 'Please enter a trigger price' });
      return;
    }


    if (stopLoss && currentPrice > 0) {
      const sl = parseFloat(stopLoss);
      if (orderSide === 'BUY' && sl >= currentPrice) {
        addNotification({ type: 'error', title: 'Invalid SL', message: 'Stop loss must be below current price for BUY' });
        return;
      }
      if (orderSide === 'SELL' && sl <= currentPrice) {
        addNotification({ type: 'error', title: 'Invalid SL', message: 'Stop loss must be above current price for SELL' });
        return;
      }
    }

    if (targetPrice && currentPrice > 0) {
      const tp = parseFloat(targetPrice);
      if (orderSide === 'BUY' && tp <= currentPrice) {
        addNotification({ type: 'error', title: 'Invalid Target', message: 'Target must be above current price for BUY' });
        return;
      }
      if (orderSide === 'SELL' && tp >= currentPrice) {
        addNotification({ type: 'error', title: 'Invalid Target', message: 'Target must be below current price for SELL' });
        return;
      }
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          displayName: parseSymbolDisplay(sym),
          side: orderSide,
          orderType,
          quantity: orderQuantity,
          price: orderType === 'MARKET' ? currentPrice : (price ? parseFloat(price) : undefined),
          currentLtp: currentPrice > 0 ? currentPrice : undefined,
          triggerPrice: triggerPrice ? parseFloat(triggerPrice) : undefined,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
          trailingSL,
          trailingDistance: trailingDistance ? parseFloat(trailingDistance) : undefined,
        }),
      });

      if (res.ok) {
        const orderLabel = orderType === 'MARKET' ? `Market @ ${currentPrice.toFixed(2)}` : `${orderType} @ ₹${price}`;
        let extras = '';
        if (stopLoss) extras += ` | SL: ${stopLoss}`;
        if (targetPrice) extras += ` | T: ${targetPrice}`;
        if (trailingSL) extras += ' | TSL';

        addNotification({
          type: 'success',
          title: 'Order Placed',
          message: `${orderSide} ${lots} lot${lots > 1 ? 's' : ''} ${orderLabel}${extras}`,
        });

        useTradingStore.getState().fetchAccount();
        useTradingStore.getState().fetchPositions().then(() => {
          const positions = useTradingStore.getState().positions;
          const openSymbols = positions.filter(p => p.isOpen).map(p => p.symbol);
          if (openSymbols.length > 0) {
            useMarketStore.getState().subscribePositionSymbols(openSymbols);
          }
        });
        useTradingStore.getState().fetchOrders();
        useTradingStore.getState().fetchTrades();

        setPrice('');
        setTriggerPrice('');
        setStopLoss('');
        setTargetPrice('');
        setTrailingSL(false);
        setTrailingDistance('');
        setOrderPanelOpen(false); // auto-collapse on mobile after order placed

        if (onOrderPlaced) onOrderPlaced();
      } else {
        const data = await res.json();
        addNotification({ type: 'error', title: 'Order Rejected', message: data.error || 'Failed to place order' });
      }
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to connect to server' });
    }
  };

  if (isMobile) {
    const balance = account?.balance ?? 1000000;
    const unrealizedPnl = positions
      .filter(p => p.isOpen)
      .reduce((sum, pos) => {
        const ltp = ticks[pos.symbol]?.ltp ?? pos.currentPrice;
        const pnl = pos.side === 'BUY'
          ? (ltp - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - ltp) * pos.quantity;
        return sum + pnl;
      }, 0);
    const todayISTStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const todayRealizedPnl = trades.reduce((sum, t) => {
      const exitDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(t.exitTime));
      return exitDay === todayISTStr ? sum + t.pnl : sum;
    }, 0);
    const dayPnl = todayRealizedPnl + unrealizedPnl;

    return (
      <div style={{ background: 'var(--bg-panel)', borderTop: '1px solid var(--border-primary)' }}>

        {/* ── Collapsed header — always visible ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            gap: '8px',
            cursor: 'pointer',
          }}
          onClick={() => setOrderPanelOpen(o => !o)}
        >
          {/* Left: instrument + price */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {parseSymbolDisplay(sym)}
            </div>
            {currentPrice > 0 && (
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: priceChange >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                {currentPrice.toFixed(2)}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)</span>
              </div>
            )}
          </div>

          {/* Right: balance/pnl + toggle button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>{formatINR(balance)}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: dayPnl >= 0 ? '#4caf50' : '#f44336', fontFamily: 'var(--font-mono)' }}>
                {dayPnl >= 0 ? '+' : ''}{formatINR(dayPnl)}
              </div>
            </div>
            <button
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '1.5px solid var(--border-primary)',
                background: orderPanelOpen ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.06)',
                color: orderPanelOpen ? '#9ab4ff' : 'var(--text-muted)',
                fontSize: '18px',
                lineHeight: 1,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label={orderPanelOpen ? 'Collapse order form' : 'Open order form'}
            >
              {orderPanelOpen ? '−' : '+'}
            </button>
          </div>
        </div>

        {/* ── Expanded order form ── */}
        {orderPanelOpen && (
        <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-primary)' }}>

        {/* ROW 2: Qty & Side Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--bg-input)', flexShrink: 0 }}>
            <button style={{ padding: '6px 12px', color: 'var(--text-muted)', border: 'none', background: 'transparent' }} onClick={() => setOrderQuantity(Math.max(lotSize, orderQuantity - lotSize))}>−</button>
            <input type="number" value={orderQuantity} onChange={(e) => setOrderQuantity(parseInt(e.target.value) || lotSize)} step={lotSize} min={lotSize} style={{ width: '50px', textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
            <button style={{ padding: '6px 12px', color: 'var(--text-muted)', border: 'none', background: 'transparent' }} onClick={() => setOrderQuantity(orderQuantity + lotSize)}>+</button>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-primary)', flex: 1 }}>
            <button 
              onClick={() => setOrderSide('BUY')} 
              style={{ flex: 1, padding: '8px', border: 'none', fontWeight: 700, fontSize: '12px', background: orderSide === 'BUY' ? 'rgba(0, 204, 0, 0.2)' : 'transparent', color: orderSide === 'BUY' ? '#00cc00' : 'var(--text-muted)', transition: 'all 0.15s' }}
            >BUY</button>
            <button 
              onClick={() => setOrderSide('SELL')} 
              style={{ flex: 1, padding: '8px', border: 'none', fontWeight: 700, fontSize: '12px', background: orderSide === 'SELL' ? 'rgba(204, 0, 0, 0.2)' : 'transparent', color: orderSide === 'SELL' ? '#cc0000' : 'var(--text-muted)', transition: 'all 0.15s' }}
            >SELL</button>
          </div>
        </div>

        {/* ROW 2: M/L switch and Price Input */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flex: 1, background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
            <button 
              onClick={() => setOrderType('MARKET')} 
              style={{ flex: 1, padding: '8px', border: 'none', fontSize: '12px', background: orderType === 'MARKET' ? 'var(--color-accent-subtle)' : 'transparent', color: orderType === 'MARKET' ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >M (Market)</button>
            <button 
              onClick={() => setOrderType('LIMIT')} 
              style={{ flex: 1, padding: '8px', border: 'none', fontSize: '12px', background: orderType === 'LIMIT' ? 'var(--color-accent-subtle)' : 'transparent', color: orderType === 'LIMIT' ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >L (Limit)</button>
          </div>
          
          {(orderType === 'LIMIT' || orderType === 'SL') && (
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : 'Price'}
              step="0.05"
              style={{ flex: 1, padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
            />
          )}
        </div>

        {/* ROW 3: Advanced Settings */}
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: '4px' }}>
          <button
            onClick={() => setShowBracket(!showBracket)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', color: showBracket ? 'var(--color-primary)' : 'var(--text-muted)', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>{showBracket ? '▾ Advanced Settings (SL / Target / SL-M)' : '▸ Advanced Settings (SL / Target / SL-M)'}</span>
          </button>
          
          {showBracket && (
            <div style={{ padding: '10px', borderTop: '1px solid var(--border-primary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SL {orderSide === 'BUY' ? '(below)' : '(above)'}</label>
                <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '6px', background: 'var(--bg-panel)', border: '1px solid var(--border-primary)', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Target {orderSide === 'BUY' ? '(above)' : '(below)'}</label>
                <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '6px', background: 'var(--bg-panel)', border: '1px solid var(--border-primary)', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }} />
              </div>
              
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={orderType === 'SL-M'} onChange={(e) => setOrderType(e.target.checked ? 'SL-M' : 'MARKET')} />
                  Place as SL-M Order
                </label>
                {(orderType === 'SL-M' || orderType === 'SL') && (
                  <input type="number" value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} placeholder="Trigger Price" style={{ width: '100px', padding: '4px 6px', background: 'var(--bg-panel)', border: '1px solid var(--border-primary)', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ROW 4: Margin & Submit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--border-primary)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: '2', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Req. Margin / Premium</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#ffeb3b', fontWeight: 'bold' }}>{formatINR(isOptionBuy ? premiumCost : marginRequired)}</span>
            </div>
            {charges && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Approx. Charges</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary, #aaa)' }}>~{formatINR(charges.total)}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={handleSubmit}
            style={{ flex: '1', maxWidth: '33%', padding: '12px 4px', borderRadius: '4px', border: 'none', background: orderSide === 'BUY' ? 'var(--color-profit)' : 'var(--color-loss)', color: '#fff', fontWeight: 'bold', fontSize: '13px', textAlign: 'center' }}
          >
             {orderSide} {lots}
          </button>
        </div>

        </div> /* end expanded form */
        )} {/* end orderPanelOpen */}

      </div>
    );
  }

  return (
    <div className="panel" style={{ height: '100%', overflow: 'auto' }}>
      <div className="panel-header">
        <span className="panel-title">Place Order</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
          Lot: {lotSize}
        </span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            className={`btn btn-lg ${orderSide === 'BUY' ? 'btn-buy' : 'btn-ghost'}`}
            onClick={() => setOrderSide('BUY')}
          >
            BUY
          </button>
          <button
            className={`btn btn-lg ${orderSide === 'SELL' ? 'btn-sell' : 'btn-ghost'}`}
            onClick={() => setOrderSide('SELL')}
          >
            SELL
          </button>
        </div>

        <div className="input-group">
          <label className="input-label">Instrument</label>
          <div style={{
            padding: '8px 12px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
              {parseSymbolDisplay(sym)}
            </span>
            {currentPrice > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)' }}>
                  {currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: priceChange >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                }}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Order Type</label>
          <select
            className="input"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
          >
            {ORDER_TYPES.map((ot) => (
              <option key={ot.value} value={ot.value}>{ot.label}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">Quantity ({lots} lot{lots !== 1 ? 's' : ''})</label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setOrderQuantity(Math.max(lotSize, orderQuantity - lotSize))}
            >
              −
            </button>
            <input
              className="input"
              type="number"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(parseInt(e.target.value) || lotSize)}
              min={lotSize}
              step={lotSize}
              style={{ flex: 1, textAlign: 'center' }}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setOrderQuantity(orderQuantity + lotSize)}
            >
              +
            </button>
          </div>
        </div>

        {(orderType === 'LIMIT' || orderType === 'SL') && (
          <div className="input-group">
            <label className="input-label">Price</label>
            <input
              className="input"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
              step="0.05"
            />
          </div>
        )}

        {(orderType === 'LIMIT' || orderType === 'SL') && (
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Market Depth</span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Click price to auto-fill</span>
            </label>
            <MarketDepth
              symbol={sym}
              onPriceSelect={(p) => setPrice(p.toFixed(2))}
            />
          </div>
        )}

        {(orderType === 'SL' || orderType === 'SL-M') && (
          <div className="input-group">
            <label className="input-label">Trigger Price</label>
            <input
              className="input"
              type="number"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
              placeholder="Stop Loss trigger price"
              step="0.05"
            />
          </div>
        )}

        {orderType === 'MARKET' && (
          <div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowBracket(!showBracket)}
              style={{
                width: '100%',
                fontSize: '11px',
                padding: '6px',
                borderStyle: 'dashed',
                color: showBracket ? 'var(--color-primary)' : 'var(--text-muted)',
              }}
            >
              {showBracket ? '▾ Hide SL / Target' : '▸ Add SL / Target'}
            </button>
          </div>
        )}

        {(showBracket && orderType === 'MARKET') && (
          <div style={{
            padding: '10px',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '11px' }}>
                Stop Loss {orderSide === 'BUY' ? '(below entry)' : '(above entry)'}
              </label>
              <input
                className="input"
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={currentPrice > 0
                  ? (orderSide === 'BUY'
                    ? (currentPrice * 0.99).toFixed(2)
                    : (currentPrice * 1.01).toFixed(2))
                  : '0.00'}
                step="0.05"
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '11px' }}>
                Target Price {orderSide === 'BUY' ? '(above entry)' : '(below entry)'}
              </label>
              <input
                className="input"
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder={currentPrice > 0
                  ? (orderSide === 'BUY'
                    ? (currentPrice * 1.02).toFixed(2)
                    : (currentPrice * 0.98).toFixed(2))
                  : '0.00'}
                step="0.05"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={trailingSL}
                  onChange={(e) => setTrailingSL(e.target.checked)}
                  style={{ width: '14px', height: '14px' }}
                />
                Trailing SL
              </label>
              {trailingSL && (
                <input
                  className="input"
                  type="number"
                  value={trailingDistance}
                  onChange={(e) => setTrailingDistance(e.target.value)}
                  placeholder="Distance"
                  step="0.5"
                  style={{ width: '80px', padding: '4px 6px', fontSize: '11px' }}
                />
              )}
            </div>
          </div>
        )}

        <div style={{
          padding: '10px',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isOptionBuy ? 'Premium Cost' : 'Margin Req.'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#ffeb3b', fontWeight: 600 }}>
              {formatINR(isOptionBuy ? premiumCost : marginRequired)}
            </span>
          </div>
          {!isOptionBuy && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Contract Value</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>
                {formatINR(orderValue)}
              </span>
            </div>
          )}
          {charges && (
            <div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setShowCharges(!showCharges)}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  {showCharges ? '▾' : '▸'} Est. Charges
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>
                  ~{formatINR(charges.total)}
                </span>
              </div>
              {showCharges && (
                <div style={{
                  marginTop: '4px',
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '4px',
                  fontSize: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}>
                  {[
                    { label: 'Brokerage', val: charges.brokerage },
                    { label: 'STT', val: charges.stt },
                    { label: 'Exchange', val: charges.exchangeCharges },
                    { label: 'GST (18%)', val: charges.gst },
                    { label: 'SEBI', val: charges.sebiCharges },
                    { label: 'Stamp Duty', val: charges.stampDuty },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary, #aaa)' }}>
                        ₹{val.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Balance</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {formatINR(account?.balance ?? 1000000)}
            </span>
          </div>
        </div>

        <button
          className={`btn btn-lg btn-block ${orderSide === 'BUY' ? 'btn-buy' : 'btn-sell'}`}
          onClick={handleSubmit}
        >
          {orderSide === 'BUY' ? '🟢' : '🔴'} {orderSide} {lots} LOT{lots > 1 ? 'S' : ''}
        </button>
      </div>
    </div>
  );
}
