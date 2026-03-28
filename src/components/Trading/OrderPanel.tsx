'use client';

import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { formatINR } from '@/lib/utils/formatters';
import { ORDER_TYPES } from '@/lib/utils/constants';
import { parseSymbolDisplay, getCurrentFuturesSymbol } from '@/lib/utils/symbols';
import { getQuickMargin } from '@/lib/utils/margins';
import type { OrderType } from '@/types/trading';

export function OrderPanel() {
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [price, setPrice] = useState<string>('');
  const [triggerPrice, setTriggerPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [showBracket, setShowBracket] = useState(false);
  const [trailingSL, setTrailingSL] = useState(false);
  const [trailingDistance, setTrailingDistance] = useState<string>('');

  const orderSide = useTradingStore((s) => s.orderSide);
  const orderQuantity = useTradingStore((s) => s.orderQuantity);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setOrderSide = useTradingStore((s) => s.setOrderSide);
  const setOrderQuantity = useTradingStore((s) => s.setOrderQuantity);
  const account = useTradingStore((s) => s.account);
  const addNotification = useUIStore((s) => s.addNotification);

  const spotPrice = useMarketStore((s) => s.spotPrice);
  const ticks = useMarketStore((s) => s.ticks);
  const activeLotSize = useMarketStore((s) => s.activeLotSize);

  const lotSize = activeLotSize || 30;

  const currentTick = selectedSymbol ? ticks[selectedSymbol] : null;
  const currentPrice = currentTick?.ltp ?? spotPrice ?? 0;
  const priceChange = currentTick?.change ?? 0;
  const priceChangePct = currentTick?.changePercent ?? 0;

  const lots = Math.floor(orderQuantity / lotSize);
  const orderValue = currentPrice * orderQuantity;

  const sym = selectedSymbol || getCurrentFuturesSymbol();
  const sideNum = orderSide === 'BUY' ? 1 : -1;
  const marginRequired = getQuickMargin(sym, orderQuantity, sideNum);
  const isOptionBuy = /\d+(CE|PE)$/i.test(sym.replace(/^(NSE:|MCX:|BSE:)/, '')) && orderSide === 'BUY';
  const premiumCost = isOptionBuy ? currentPrice * orderQuantity : 0;

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
          symbol: selectedSymbol || getCurrentFuturesSymbol(),
          displayName: parseSymbolDisplay(selectedSymbol || getCurrentFuturesSymbol()),
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
      } else {
        const data = await res.json();
        addNotification({ type: 'error', title: 'Order Rejected', message: data.error || 'Failed to place order' });
      }
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to connect to server' });
    }
  };

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
              {parseSymbolDisplay(selectedSymbol || getCurrentFuturesSymbol())}
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
