'use client';

import { useState, useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore } from '@/stores/marketStore';
import { formatDateTime, formatPnL } from '@/lib/utils/formatters';
import { useUIStore } from '@/stores/uiStore';
import { getLotSizeForSymbol } from '@/lib/utils/margins';

export function PositionList({ compact = false }: { compact?: boolean }) {
  const positions = useTradingStore((s) => s.positions);
  const trades = useTradingStore((s) => s.trades);
  const ticks = useMarketStore((s) => s.ticks);
  const addNotification = useUIStore((s) => s.addNotification);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [modifyQtyInput, setModifyQtyInput] = useState('');
  const [tslEnabled, setTslEnabled] = useState(false);
  const [tslDistance, setTslDistance] = useState('');
  const [exitQtyId, setExitQtyId] = useState<string | null>(null);
  const [exitQtyInput, setExitQtyInput] = useState('');
  const [expandedClosedTradeId, setExpandedClosedTradeId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleClosePosition = async (positionId: string, symbol: string, partialQty?: number) => {
    try {
      const tick = ticks[symbol];
      const exitPrice = tick ? tick.ltp : undefined;

      const res = await fetch('/api/positions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId,
          exitPrice,
          exitQuantity: partialQty || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isPartialExit) {
          addNotification({
            type: 'info',
            title: 'Partial Exit',
            message: `Exited ${data.exitQuantity} qty | Remaining: ${data.remainingQuantity} qty | P&L: ${data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}`,
          });
        }
        useTradingStore.getState().fetchPositions();
        useTradingStore.getState().fetchAccount();
        useTradingStore.getState().fetchTrades();
        useTradingStore.getState().fetchOrders();
        setExitQtyId(null);
        setExitQtyInput('');
      }
    } catch (err) {
      console.error('Failed to close position:', err);
    }
  };
  const toggleClosedTradeDetails = (tradeId: string) => {
    setExpandedClosedTradeId((current) => (current === tradeId ? null : tradeId));
  };
  const getExitStepSize = (symbol: string, quantity: number) => {
    const inferredLotSize = Math.max(1, getLotSizeForSymbol(symbol));
    return quantity % inferredLotSize === 0 ? inferredLotSize : 1;
  };

  const startEditing = (pos: any) => {
    setEditingId(pos.id);
    setSlInput(pos.stopLoss ? pos.stopLoss.toString() : '');
    setTpInput(pos.targetPrice ? pos.targetPrice.toString() : '');
    setModifyQtyInput(String(pos.quantity));
    setTslEnabled(pos.trailingSL || false);
    setTslDistance(pos.trailingDistance ? pos.trailingDistance.toString() : '');
  };

  const handleModify = async (positionId: string, posQty: number) => {
    try {
      const modQty = modifyQtyInput ? parseInt(modifyQtyInput) : posQty;
      const res = await fetch('/api/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId,
          stopLoss: slInput ? parseFloat(slInput) : null,
          targetPrice: tpInput ? parseFloat(tpInput) : null,
          targetQty: modQty < posQty ? modQty : null,
          trailingSL: tslEnabled,
          trailingDistance: tslDistance ? parseFloat(tslDistance) : null,
        }),
      });

      if (res.ok) {
        addNotification({ type: 'success', title: 'Position Modified', message: 'SL/Target updated successfully' });
        useTradingStore.getState().fetchPositions();
        setEditingId(null);
      } else {
        const data = await res.json();
        addNotification({ type: 'error', title: 'Modification Failed', message: data.error || 'Failed to modify position' });
      }
    } catch (err) {
      console.error('Failed to modify position:', err);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to connect to server' });
    }
  };

  const openPositions = positions.filter(p => p.isOpen);

  // Show today's closed positions (IST calendar day, reset at 11:55 PM IST)
  const IST_TIME_ZONE = 'Asia/Kolkata';
  const RESET_MINUTES_IST = 23 * 60 + 55;
  const getISTDateKey = (value: string | Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: IST_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));

  const getISTHourMinute = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(value);

    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
    return { hour, minute };
  };

  const now = new Date();
  const { hour: currentHourIST, minute: currentMinuteIST } = getISTHourMinute(now);
  const isBeforeReset = currentHourIST * 60 + currentMinuteIST < RESET_MINUTES_IST;
  const todayISTKey = getISTDateKey(now);

  const todayClosedTrades = isBeforeReset
    ? trades
        .filter((t) => getISTDateKey(t.exitTime) === todayISTKey)
        .sort(
          (a, b) =>
            new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
        )
    : [];

  const openUnrealizedPnl = openPositions.reduce((sum, pos) => {
    const ltp = ticks[pos.symbol]?.ltp ?? pos.currentPrice;
    return sum + (pos.side === 'BUY'
      ? (ltp - pos.entryPrice) * pos.quantity
      : (pos.entryPrice - ltp) * pos.quantity);
  }, 0);
  const todayClosedPnl = todayClosedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const dayPnl = openUnrealizedPnl + todayClosedPnl;
  const dayPnlInfo = formatPnL(dayPnl);

  if (openPositions.length === 0 && todayClosedTrades.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-text">No open positions</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Place an order to open a position
        </div>
      </div>
    );
  }

  // ── Compact 2-row card layout (used in sidebar) ──────────────────────────
  if (compact) {
    return (
      <div style={{ overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {openPositions.map((pos) => {
            const liveLtp = ticks[pos.symbol]?.ltp;
            const currentPrice = liveLtp ?? pos.currentPrice;
            const livePnl = pos.side === 'BUY'
              ? (currentPrice - pos.entryPrice) * pos.quantity
              : (pos.entryPrice - currentPrice) * pos.quantity;
            const pnlInfo = formatPnL(livePnl);
            const isEditing = editingId === pos.id;
            const isExitQtyMode = exitQtyId === pos.id;
            const lotSize = getExitStepSize(pos.symbol, pos.quantity);
            const canPartialExit = pos.quantity > 1;

            return (
              <div key={pos.id} style={{
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-primary)',
                padding: '6px 10px',
              }}>
                {/* Row 1: Name | Side | Qty */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pos.displayName || pos.symbol}
                  </span>
                  {pos.trailingSL && (
                    <span style={{ fontSize: '9px', color: '#ff9800' }} title="Trailing SL">TSL</span>
                  )}
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
                    {pos.instrumentType}
                  </span>
                  <span className={pos.side === 'BUY' ? 'buy-side' : 'sell-side'} style={{ fontSize: '11px', fontWeight: 700 }}>
                    {pos.side}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {pos.quantity}
                  </span>
                </div>

                {/* Row 2: Entry → LTP | P&L */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEditing || isExitQtyMode ? '4px' : '0' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {pos.entryPrice.toFixed(2)}
                    <span style={{ margin: '0 3px', color: 'var(--text-muted)' }}>→</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{currentPrice.toFixed(2)}</span>
                  </span>
                  <span className={pnlInfo.className} style={{ fontWeight: 700, fontSize: '12px' }}>
                    {pnlInfo.text}
                  </span>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div style={{ marginTop: '5px', borderTop: '1px solid var(--border-primary)', paddingTop: '5px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
                      <input
                        className="input"
                        type="number"
                        value={slInput}
                        onChange={(e) => setSlInput(e.target.value)}
                        placeholder="SL"
                        style={{ width: '72px', padding: '2px 4px', fontSize: '11px' }}
                        step="0.05"
                      />
                      <input
                        className="input"
                        type="number"
                        value={tpInput}
                        onChange={(e) => setTpInput(e.target.value)}
                        placeholder="Target"
                        style={{ width: '72px', padding: '2px 4px', fontSize: '11px' }}
                        step="0.05"
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Qty:</span>
                        <input
                          className="input"
                          type="number"
                          value={modifyQtyInput}
                          onChange={(e) => setModifyQtyInput(e.target.value)}
                          min={lotSize}
                          max={pos.quantity}
                          step={lotSize}
                          style={{ width: '55px', padding: '2px 4px', fontSize: '11px' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input type="checkbox" checked={tslEnabled} onChange={(e) => setTslEnabled(e.target.checked)} style={{ width: '12px', height: '12px' }} />
                        TSL
                      </label>
                      {tslEnabled && (
                        <input
                          className="input"
                          type="number"
                          value={tslDistance}
                          onChange={(e) => setTslDistance(e.target.value)}
                          placeholder="Dist"
                          style={{ width: '50px', padding: '2px 4px', fontSize: '10px' }}
                          step="0.5"
                        />
                      )}
                      <button className="btn btn-primary btn-sm" onClick={() => handleModify(pos.id, pos.quantity)} style={{ padding: '2px 8px', fontSize: '10px' }}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} style={{ padding: '2px 6px', fontSize: '10px' }}>X</button>
                    </div>
                  </div>
                )}

                {/* Partial exit form */}
                {isExitQtyMode && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '5px', borderTop: '1px solid var(--border-primary)', paddingTop: '5px' }}>
                    <input
                      className="input"
                      type="number"
                      value={exitQtyInput}
                      onChange={(e) => setExitQtyInput(e.target.value)}
                      placeholder="Qty"
                      min={lotSize}
                      max={pos.quantity}
                      step={lotSize}
                      style={{ width: '60px', padding: '2px 4px', fontSize: '11px' }}
                    />
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      const qty = parseInt(exitQtyInput);
                      if (qty > 0 && qty <= pos.quantity && qty % lotSize === 0) {
                        handleClosePosition(pos.id, pos.symbol, qty);
                      } else {
                        addNotification({ type: 'error', title: 'Invalid Qty', message: `Must be a multiple of ${lotSize}${lotSize > 1 ? ' (1 lot)' : ''}` });
                      }
                    }} style={{ padding: '2px 8px', fontSize: '10px' }}>Go</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setExitQtyId(null); setExitQtyInput(''); }} style={{ padding: '2px 6px', fontSize: '10px' }}>X</button>
                  </div>
                )}

                {/* Action buttons (only when not in edit/exit mode) */}
                {!isEditing && !isExitQtyMode && (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: 'auto', alignSelf: 'center' }}>
                      {pos.stopLoss ? <span style={{ color: '#ef5350' }}>SL {pos.stopLoss.toFixed(2)}</span> : ''}
                      {pos.stopLoss && pos.targetPrice ? ' · ' : ''}
                      {pos.targetPrice ? <span style={{ color: '#66bb6a' }}>Tgt {pos.targetPrice.toFixed(2)}{pos.targetQty && pos.targetQty < pos.quantity ? ` (${pos.targetQty})` : ''}</span> : ''}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEditing(pos)} style={{ padding: '2px 6px', fontSize: '10px' }} title="Modify SL/Target">Modify</button>
                    {canPartialExit && (
                      <button className="btn btn-ghost btn-sm" onClick={() => { setExitQtyId(pos.id); setExitQtyInput(String(lotSize)); }} style={{ padding: '2px 6px', fontSize: '10px', color: '#ff9800' }} title={lotSize > 1 ? `Partial exit (min 1 lot = ${lotSize})` : 'Partial exit'}>Partial</button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleClosePosition(pos.id, pos.symbol)} title={pos.side === 'BUY' ? 'Sell to close' : 'Buy to cover'}>
                      {pos.side === 'BUY' ? 'Sell' : 'Buy'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {todayClosedTrades.length > 0 && (
          <>
            <div style={{
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.03)',
              borderTop: '1px solid var(--border-primary)',
              borderBottom: '1px solid var(--border-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Closed Today
            </div>
            {todayClosedTrades.map((trade) => {
              const pnlInfo = formatPnL(trade.pnl);
              const isExpanded = expandedClosedTradeId === trade.id;
              return (
                <div key={trade.id} style={{
                  background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-primary)',
                  padding: '5px 10px',
                  opacity: 0.65,
                  cursor: 'pointer',
                }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleClosedTradeDetails(trade.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleClosedTradeDetails(trade.id);
                      }
                    }}
                    title="Click to view entry/exit details"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {trade.displayName || trade.symbol}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{trade.side}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{trade.quantity}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                        <span style={{ marginLeft: '6px', fontSize: '9px' }}>{trade.exitReason || 'MANUAL'}</span>
                      </span>
                      <span className={pnlInfo.className} style={{ fontWeight: 700, fontSize: '11px' }}>
                        {pnlInfo.text}
                      </span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{
                      marginTop: '6px',
                      paddingTop: '6px',
                      borderTop: '1px dashed var(--border-primary)',
                      display: 'grid',
                      gap: '3px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span>Entry</span>
                        <span>{trade.entryPrice.toFixed(2)} · {formatDateTime(trade.entryTime)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span>Exit</span>
                        <span>{trade.exitPrice.toFixed(2)} · {formatDateTime(trade.exitTime)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span>Reason</span>
                        <span>{trade.exitReason || 'MANUAL'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  // ── Full layout (used in main area Positions tab) ────────────────────────
  return (
    <div style={{ overflow: 'auto', height: '100%' }}>

      {/* ── Day P&L Summary Banner ── */}
      {(openPositions.length > 0 || todayClosedTrades.length > 0) && (
        <div style={{
          padding: '6px 14px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Day P&L
          </span>
          <span className={dayPnlInfo.className} style={{ fontSize: '15px', fontWeight: 700 }}>
            {dayPnlInfo.text}
          </span>
        </div>
      )}

      {/* ── Mobile card layout for open positions ── */}
      {isMobile && openPositions.map((pos) => {
        const liveLtp = ticks[pos.symbol]?.ltp;
        const currentPrice = liveLtp ?? pos.currentPrice;
        const livePnl = pos.side === 'BUY'
          ? (currentPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - currentPrice) * pos.quantity;
        const pnlInfo = formatPnL(livePnl);
        const isEditing = editingId === pos.id;
        const isExitQtyMode = exitQtyId === pos.id;
        const lotSize = getExitStepSize(pos.symbol, pos.quantity);
        const canPartialExit = pos.quantity > 1;
        return (
          <div key={pos.id} style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', padding: '10px 12px' }}>
            {/* Row 1: Name | badges | Side | Qty */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-bright)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pos.displayName || pos.symbol}
              </span>
              {pos.trailingSL && <span style={{ fontSize: '9px', color: '#ff9800' }}>TSL</span>}
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>{pos.instrumentType}</span>
              <span className={pos.side === 'BUY' ? 'buy-side' : 'sell-side'} style={{ fontSize: '13px', fontWeight: 700 }}>{pos.side}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{pos.quantity}</span>
            </div>
            {/* Row 2: Entry → LTP | P&L */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {pos.entryPrice.toFixed(2)}
                <span style={{ margin: '0 5px', color: 'var(--text-muted)' }}>→</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentPrice.toFixed(2)}</span>
              </span>
              <span className={pnlInfo.className} style={{ fontWeight: 700, fontSize: '17px' }}>{pnlInfo.text}</span>
            </div>
            {/* Edit form */}
            {isEditing && (
              <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '6px', marginTop: '2px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                  <input className="input" type="number" value={slInput} onChange={(e) => setSlInput(e.target.value)} placeholder="SL" style={{ width: '80px', padding: '4px 6px', fontSize: '12px' }} step="0.05" />
                  <input className="input" type="number" value={tpInput} onChange={(e) => setTpInput(e.target.value)} placeholder="Target" style={{ width: '80px', padding: '4px 6px', fontSize: '12px' }} step="0.05" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qty:</span>
                    <input className="input" type="number" value={modifyQtyInput} onChange={(e) => setModifyQtyInput(e.target.value)} min={lotSize} max={pos.quantity} step={lotSize} style={{ width: '65px', padding: '4px 6px', fontSize: '12px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <input type="checkbox" checked={tslEnabled} onChange={(e) => setTslEnabled(e.target.checked)} style={{ width: '13px', height: '13px' }} />
                    TSL
                  </label>
                  {tslEnabled && <input className="input" type="number" value={tslDistance} onChange={(e) => setTslDistance(e.target.value)} placeholder="Dist" style={{ width: '60px', padding: '4px 6px', fontSize: '11px' }} step="0.5" />}
                  <button className="btn btn-primary btn-sm" onClick={() => handleModify(pos.id, pos.quantity)} style={{ padding: '4px 12px', fontSize: '12px' }}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} style={{ padding: '4px 10px', fontSize: '12px' }}>✕</button>
                </div>
              </div>
            )}
            {/* Partial exit form */}
            {isExitQtyMode && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid var(--border-primary)', paddingTop: '6px', marginTop: '2px' }}>
                <input className="input" type="number" value={exitQtyInput} onChange={(e) => setExitQtyInput(e.target.value)} placeholder="Qty" min={lotSize} max={pos.quantity} step={lotSize} style={{ flex: 1, padding: '4px 6px', fontSize: '12px' }} />
                <button className="btn btn-danger btn-sm" onClick={() => {
                  const qty = parseInt(exitQtyInput);
                  if (qty > 0 && qty <= pos.quantity && qty % lotSize === 0) {
                    handleClosePosition(pos.id, pos.symbol, qty);
                  } else {
                    addNotification({ type: 'error', title: 'Invalid Qty', message: `Must be multiple of ${lotSize}` });
                  }
                }} style={{ padding: '4px 12px', fontSize: '12px' }}>Exit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setExitQtyId(null); setExitQtyInput(''); }} style={{ padding: '4px 10px', fontSize: '12px' }}>✕</button>
              </div>
            )}
            {/* Row 3: SL/Target + Actions */}
            {!isEditing && !isExitQtyMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>
                  {pos.stopLoss ? <span style={{ color: '#ef5350' }}>SL {pos.stopLoss.toFixed(2)}</span> : ''}
                  {pos.stopLoss && pos.targetPrice ? ' · ' : ''}
                  {pos.targetPrice ? <span style={{ color: '#66bb6a' }}>Tgt {pos.targetPrice.toFixed(2)}{pos.targetQty && pos.targetQty < pos.quantity ? ` (${pos.targetQty})` : ''}</span> : ''}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => startEditing(pos)} style={{ padding: '4px 10px', fontSize: '11px' }}>Modify</button>
                {canPartialExit && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setExitQtyId(pos.id); setExitQtyInput(String(lotSize)); }} style={{ padding: '4px 10px', fontSize: '11px', color: '#ff9800' }}>Partial</button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => handleClosePosition(pos.id, pos.symbol)} style={{ padding: '4px 12px', fontSize: '12px' }}>
                  {pos.side === 'BUY' ? 'Sell' : 'Buy'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Desktop table layout for open positions ── */}
      {!isMobile && <table className="data-table">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Side</th>
            <th className="right">Qty</th>
            <th className="right">Entry</th>
            <th className="right">LTP</th>
            <th className="right">P&L</th>
            <th className="right">SL</th>
            <th className="right">Target</th>
            <th className="center">Action</th>
          </tr>
        </thead>
        <tbody>
          {openPositions.map((pos) => {
            const liveLtp = ticks[pos.symbol]?.ltp;
            const currentPrice = liveLtp ?? pos.currentPrice;
            const livePnl = pos.side === 'BUY'
              ? (currentPrice - pos.entryPrice) * pos.quantity
              : (pos.entryPrice - currentPrice) * pos.quantity;
            const pnlInfo = formatPnL(livePnl);
            const isEditing = editingId === pos.id;
            const isExitQtyMode = exitQtyId === pos.id;
            const lotSize = getExitStepSize(pos.symbol, pos.quantity);
            const canPartialExit = pos.quantity > 1;

            return (
              <tr key={pos.id}>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {pos.displayName || pos.symbol}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    {pos.instrumentType}
                  </span>
                  {pos.trailingSL && (
                    <span style={{ fontSize: '9px', color: '#ff9800', marginLeft: '4px' }} title="Trailing SL active">
                      TSL
                    </span>
                  )}
                </td>
                <td>
                  <span className={pos.side === 'BUY' ? 'buy-side' : 'sell-side'} style={{ fontWeight: 600 }}>
                    {pos.side}
                  </span>
                </td>
                <td className="right" style={{ fontWeight: 600 }}>{pos.quantity}</td>
                <td className="right">{pos.entryPrice.toFixed(2)}</td>
                <td className="right">{currentPrice.toFixed(2)}</td>
                <td className={`right ${pnlInfo.className}`} style={{ fontWeight: 600 }}>
                  {pnlInfo.text}
                </td>

                <td className="right">
                  {isEditing ? (
                    <input
                      className="input"
                      type="number"
                      value={slInput}
                      onChange={(e) => setSlInput(e.target.value)}
                      placeholder="SL"
                      style={{ width: '70px', padding: '2px 4px', fontSize: '11px' }}
                      step="0.05"
                    />
                  ) : (
                    <span style={{ color: pos.stopLoss ? '#ef5350' : 'var(--text-muted)', fontSize: '12px' }}>
                      {pos.stopLoss ? pos.stopLoss.toFixed(2) : '—'}
                    </span>
                  )}
                </td>

                <td className="right">
                  {isEditing ? (
                    <input
                      className="input"
                      type="number"
                      value={tpInput}
                      onChange={(e) => setTpInput(e.target.value)}
                      placeholder="Target"
                      style={{ width: '70px', padding: '2px 4px', fontSize: '11px' }}
                      step="0.05"
                    />
                  ) : (
                    <span style={{ color: pos.targetPrice ? '#66bb6a' : 'var(--text-muted)', fontSize: '12px' }}>
                      {pos.targetPrice
                        ? `${pos.targetPrice.toFixed(2)}${pos.targetQty && pos.targetQty < pos.quantity ? ` (${pos.targetQty})` : ''}`
                        : '—'}
                    </span>
                  )}
                </td>

                <td className="center" style={{ whiteSpace: 'nowrap' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Qty:</span>
                        <input
                          className="input"
                          type="number"
                          value={modifyQtyInput}
                          onChange={(e) => setModifyQtyInput(e.target.value)}
                          min={lotSize}
                          max={pos.quantity}
                          step={lotSize}
                          style={{ width: '55px', padding: '2px 4px', fontSize: '11px' }}
                          title={`Target/SL qty (max ${pos.quantity})`}
                        />
                      </div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input
                          type="checkbox"
                          checked={tslEnabled}
                          onChange={(e) => setTslEnabled(e.target.checked)}
                          style={{ width: '12px', height: '12px' }}
                        />
                        TSL
                      </label>
                      {tslEnabled && (
                        <input
                          className="input"
                          type="number"
                          value={tslDistance}
                          onChange={(e) => setTslDistance(e.target.value)}
                          placeholder="Dist"
                          style={{ width: '50px', padding: '2px 4px', fontSize: '10px' }}
                          step="0.5"
                        />
                      )}
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleModify(pos.id, pos.quantity)}
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingId(null)}
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                      >
                        X
                      </button>
                    </div>
                  ) : isExitQtyMode ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        className="input"
                        type="number"
                        value={exitQtyInput}
                        onChange={(e) => setExitQtyInput(e.target.value)}
                        placeholder="Qty"
                        min={lotSize}
                        max={pos.quantity}
                        step={lotSize}
                        style={{ width: '55px', padding: '2px 4px', fontSize: '11px' }}
                      />
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          const qty = parseInt(exitQtyInput);
                          if (qty > 0 && qty <= pos.quantity && qty % lotSize === 0) {
                            handleClosePosition(pos.id, pos.symbol, qty);
                          } else {
                            addNotification({ type: 'error', title: 'Invalid Qty', message: `Must be a multiple of ${lotSize}${lotSize > 1 ? ' (1 lot)' : ''}` });
                          }
                        }}
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                      >
                        Go
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setExitQtyId(null); setExitQtyInput(''); }}
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEditing(pos)}
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        title="Modify SL/Target"
                      >
                        Modify
                      </button>
                      {canPartialExit && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setExitQtyId(pos.id);
                            setExitQtyInput(String(lotSize));
                          }}
                          style={{ padding: '2px 6px', fontSize: '10px', color: '#ff9800' }}
                          title={lotSize > 1 ? `Partial exit (min 1 lot = ${lotSize})` : 'Partial exit'}
                        >
                          Partial
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleClosePosition(pos.id, pos.symbol)}
                        title={pos.side === 'BUY' ? 'Sell to close position' : 'Buy to cover position'}
                      >
                        {pos.side === 'BUY' ? 'Sell' : 'Buy'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>}

      {todayClosedTrades.length > 0 && (
        <>
          <div style={{
            padding: '4px 10px',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.03)',
            borderTop: '1px solid var(--border-primary)',
            borderBottom: '1px solid var(--border-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Closed Today
          </div>

          {/* Mobile: card layout for closed trades — font sizes match open position cards */}
          {isMobile && todayClosedTrades.map((trade) => {
            const pnlInfo = formatPnL(trade.pnl);
            const isExpanded = expandedClosedTradeId === trade.id;
            return (
              <div key={trade.id} style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', padding: '10px 12px', opacity: 0.7, cursor: 'pointer' }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleClosedTradeDetails(trade.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleClosedTradeDetails(trade.id); } }}
                >
                  {/* Row 1: symbol | side | qty | chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-bright)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {trade.displayName || trade.symbol}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700 }}>{trade.side}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{trade.quantity}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '2px' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  {/* Row 2: entry → exit | P&L */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {trade.entryPrice.toFixed(2)}
                      <span style={{ margin: '0 5px' }}>→</span>
                      {trade.exitPrice.toFixed(2)}
                      <span style={{ marginLeft: '8px', fontSize: '11px' }}>{trade.exitReason || 'MANUAL'}</span>
                    </span>
                    <span className={pnlInfo.className} style={{ fontWeight: 700, fontSize: '16px' }}>{pnlInfo.text}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-primary)', display: 'grid', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Entry</span><span style={{ color: 'var(--text-primary)' }}>{trade.entryPrice.toFixed(2)} · {formatDateTime(trade.entryTime)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Exit</span><span style={{ color: 'var(--text-primary)' }}>{trade.exitPrice.toFixed(2)} · {formatDateTime(trade.exitTime)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Reason</span><span style={{ color: 'var(--text-primary)' }}>{trade.exitReason || 'MANUAL'}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Desktop: table layout for closed trades */}
          {!isMobile && <table className="data-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Side</th>
                <th className="right">Qty</th>
                <th className="right">Entry</th>
                <th className="right">Exit</th>
                <th className="right">P&L</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {todayClosedTrades.map((trade) => {
                const pnlInfo = formatPnL(trade.pnl);
                const isExpanded = expandedClosedTradeId === trade.id;
                return [
                  <tr
                    key={`${trade.id}-summary`}
                    style={{ opacity: 0.7, cursor: 'pointer' }}
                    onClick={() => toggleClosedTradeDetails(trade.id)}
                    title="Click to expand entry and exit details"
                  >
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        {trade.displayName || trade.symbol}
                      </span>
                      <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </td>
                    <td><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{trade.side}</span></td>
                    <td className="right" style={{ color: 'var(--text-muted)' }}>{trade.quantity}</td>
                    <td className="right" style={{ color: 'var(--text-muted)' }}>{trade.entryPrice.toFixed(2)}</td>
                    <td className="right" style={{ color: 'var(--text-muted)' }}>{trade.exitPrice.toFixed(2)}</td>
                    <td className={`right ${pnlInfo.className}`} style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{pnlInfo.text}</td>
                    <td style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{trade.exitReason || 'MANUAL'}</td>
                  </tr>,
                  isExpanded ? (
                    <tr key={`${trade.id}-details`} style={{ opacity: 0.9 }}>
                      <td colSpan={7} style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'grid', gap: '4px', padding: '6px 2px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Entry</span><span>{trade.entryPrice.toFixed(2)} · {formatDateTime(trade.entryTime)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Exit</span><span>{trade.exitPrice.toFixed(2)} · {formatDateTime(trade.exitTime)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Reason</span><span>{trade.exitReason || 'MANUAL'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>}
        </>
      )}
    </div>
  );
}
