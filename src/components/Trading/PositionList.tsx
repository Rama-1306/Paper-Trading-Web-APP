'use client';

import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore } from '@/stores/marketStore';
import { formatPnL } from '@/lib/utils/formatters';
import { useUIStore } from '@/stores/uiStore';
import { getLotSizeForSymbol } from '@/lib/utils/margins';

export function PositionList() {
  const positions = useTradingStore((s) => s.positions);
  const ticks = useMarketStore((s) => s.ticks);
  const addNotification = useUIStore((s) => s.addNotification);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [tslEnabled, setTslEnabled] = useState(false);
  const [tslDistance, setTslDistance] = useState('');
  const [exitQtyId, setExitQtyId] = useState<string | null>(null);
  const [exitQtyInput, setExitQtyInput] = useState('');

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
        setExitQtyId(null);
        setExitQtyInput('');
      }
    } catch (err) {
      console.error('Failed to close position:', err);
    }
  };

  const startEditing = (pos: any) => {
    setEditingId(pos.id);
    setSlInput(pos.stopLoss ? pos.stopLoss.toString() : '');
    setTpInput(pos.targetPrice ? pos.targetPrice.toString() : '');
    setTslEnabled(pos.trailingSL || false);
    setTslDistance(pos.trailingDistance ? pos.trailingDistance.toString() : '');
  };

  const handleModify = async (positionId: string) => {
    try {
      const res = await fetch('/api/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId,
          stopLoss: slInput ? parseFloat(slInput) : null,
          targetPrice: tpInput ? parseFloat(tpInput) : null,
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
  const IST_OFFSET_MS = 5.5 * 3600000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const todayIST = new Date(nowIST);
  todayIST.setHours(0, 0, 0, 0);
  const resetTimeIST = new Date(todayIST);
  resetTimeIST.setHours(23, 55, 0, 0);
  const isBeforeReset = nowIST < resetTimeIST;

  const todayClosedPositions = isBeforeReset
    ? positions.filter(p =>
        !p.isOpen &&
        p.closedAt &&
        new Date(new Date(p.closedAt).getTime() + IST_OFFSET_MS) >= todayIST
      )
    : [];

  if (openPositions.length === 0 && todayClosedPositions.length === 0) {
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

  return (
    <div style={{ overflow: 'auto', height: '100%', overflowX: 'auto' }}>
      <table className="data-table">
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
            const lotSize = getLotSizeForSymbol(pos.symbol);

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
                      {pos.targetPrice ? pos.targetPrice.toFixed(2) : '—'}
                    </span>
                  )}
                </td>

                <td className="center" style={{ whiteSpace: 'nowrap' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
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
                        onClick={() => handleModify(pos.id)}
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
                            addNotification({ type: 'error', title: 'Invalid Qty', message: `Must be a multiple of ${lotSize} (1 lot)` });
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
                      {pos.quantity >= lotSize * 2 && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setExitQtyId(pos.id);
                            setExitQtyInput(String(lotSize));
                          }}
                          style={{ padding: '2px 6px', fontSize: '10px', color: '#ff9800' }}
                          title={`Partial exit (min 1 lot = ${lotSize})`}
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
      </table>

      {todayClosedPositions.length > 0 && (
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
          <table className="data-table">
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
              {todayClosedPositions.map((pos) => {
                const pnlInfo = formatPnL(pos.pnl);
                return (
                  <tr key={pos.id} style={{ opacity: 0.7 }}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        {pos.displayName || pos.symbol}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                        {pos.side}
                      </span>
                    </td>
                    <td className="right" style={{ color: 'var(--text-muted)' }}>{pos.quantity}</td>
                    <td className="right" style={{ color: 'var(--text-muted)' }}>{pos.entryPrice.toFixed(2)}</td>
                    <td className="right" style={{ color: 'var(--text-muted)' }}>{pos.currentPrice.toFixed(2)}</td>
                    <td className={`right ${pnlInfo.className}`} style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                      {pnlInfo.text}
                    </td>
                    <td style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {pos.exitReason || 'MANUAL'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
