'use client';

import { useState, useRef, useEffect } from 'react';
import { TradeData } from '@/types/trading';
import { formatINR, formatPnL, formatDateTime } from '@/lib/utils/formatters';
import { useUIStore } from '@/stores/uiStore';
import { useTradingStore } from '@/stores/tradingStore';

interface TradeDetailModalProps {
  trade: TradeData;
  onClose: () => void;
}

export function TradeDetailModal({ trade, onClose }: TradeDetailModalProps) {
  const [notes, setNotes] = useState(trade.notes || '');
  const [screenshotUrl, setScreenshotUrl] = useState(trade.screenshotUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addNotification = useUIStore((s) => s.addNotification);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const pnlInfo = formatPnL(trade.pnl);
  const pnlPerUnit = trade.side === 'BUY'
    ? trade.exitPrice - trade.entryPrice
    : trade.entryPrice - trade.exitPrice;
  const pnlPercent = trade.entryPrice > 0 ? (pnlPerUnit / trade.entryPrice) * 100 : 0;
  const duration = new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime();
  const durationMin = Math.floor(duration / 60000);
  const durationHrs = Math.floor(durationMin / 60);
  const durationStr = durationHrs > 0
    ? `${durationHrs}h ${durationMin % 60}m`
    : `${durationMin}m`;

  const exitLabel = trade.exitReason === 'SL_HIT' ? 'Stop Loss Hit' :
    trade.exitReason === 'TARGET_HIT' ? 'Target Hit' :
    trade.exitReason === 'MANUAL' ? 'Manual Exit' : trade.exitReason || 'Manual Exit';
  const exitColor = trade.exitReason === 'SL_HIT' ? '#ef5350' :
    trade.exitReason === 'TARGET_HIT' ? '#66bb6a' : 'var(--text-muted)';

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/trades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId: trade.id, notes }),
      });
      if (res.ok) {
        addNotification({ type: 'success', title: 'Notes Saved', message: 'Trade notes updated' });
        useTradingStore.getState().fetchTrades();
        setHasChanges(false);
      }
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to save notes' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addNotification({ type: 'error', title: 'File Too Large', message: 'Maximum 5MB allowed' });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      formData.append('tradeId', trade.id);

      const res = await fetch('/api/trades/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setScreenshotUrl(data.screenshotUrl);
        addNotification({ type: 'success', title: 'Screenshot Uploaded', message: 'Chart screenshot saved' });
        useTradingStore.getState().fetchTrades();
      } else {
        const data = await res.json();
        addNotification({ type: 'error', title: 'Upload Failed', message: data.error || 'Failed to upload' });
      }
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveScreenshot = async () => {
    try {
      const res = await fetch('/api/trades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId: trade.id, screenshotUrl: null }),
      });
      if (res.ok) {
        setScreenshotUrl('');
        addNotification({ type: 'success', title: 'Removed', message: 'Screenshot removed' });
        useTradingStore.getState().fetchTrades();
      }
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to remove screenshot' });
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-secondary, #1a1d29)',
        border: '1px solid var(--border-color, #2a2d3a)',
        borderRadius: '12px',
        width: '560px', maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #2a2d3a)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {trade.displayName || trade.symbol}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Trade ID: {trade.id.slice(0, 12)}...
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '20px', cursor: 'pointer', padding: '4px 8px',
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '1px', background: 'var(--border-color, #2a2d3a)',
            borderRadius: '8px', overflow: 'hidden', marginBottom: '16px',
          }}>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Side</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: trade.side === 'BUY' ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                {trade.side}
              </div>
            </div>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Quantity</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{trade.quantity}</div>
            </div>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Entry Price</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(trade.entryPrice)}</div>
            </div>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Exit Price</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(trade.exitPrice)}</div>
            </div>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Entry Time</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateTime(trade.entryTime)}</div>
            </div>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Exit Time</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateTime(trade.exitTime)}</div>
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1px', background: 'var(--border-color, #2a2d3a)',
            borderRadius: '8px', overflow: 'hidden', marginBottom: '16px',
          }}>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>P&L</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }} className={pnlInfo.className}>{pnlInfo.text}</div>
              <div style={{ fontSize: '11px', color: pnlPercent >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', marginTop: '2px' }}>
                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
              </div>
            </div>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Duration</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{durationStr}</div>
            </div>
            <div style={{ background: 'var(--bg-primary, #0f1117)', padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Exit Type</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: exitColor }}>{exitLabel}</div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '8px',
            }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Notes
              </label>
              {hasChanges && (
                <button
                  onClick={handleSaveNotes}
                  disabled={isSaving}
                  style={{
                    padding: '4px 12px', fontSize: '11px', fontWeight: 600,
                    background: 'var(--color-primary, #2962ff)', color: '#fff',
                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Notes'}
                </button>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setHasChanges(true); }}
              placeholder="Add your trade notes, observations, strategy used..."
              style={{
                width: '100%', minHeight: '80px', padding: '10px 12px',
                background: 'var(--bg-primary, #0f1117)',
                border: '1px solid var(--border-color, #2a2d3a)',
                borderRadius: '6px', color: 'var(--text-primary)',
                fontSize: '13px', lineHeight: '1.5', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
              Chart Screenshot
            </label>

            {screenshotUrl ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={screenshotUrl}
                  alt="Trade screenshot"
                  style={{
                    width: '100%', borderRadius: '6px',
                    border: '1px solid var(--border-color, #2a2d3a)',
                    maxHeight: '300px', objectFit: 'contain',
                    background: 'var(--bg-primary, #0f1117)',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    style={{
                      padding: '6px 12px', fontSize: '11px', fontWeight: 600,
                      background: 'var(--bg-tertiary, #252836)',
                      border: '1px solid var(--border-color, #2a2d3a)',
                      borderRadius: '4px', color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Replace
                  </button>
                  <button
                    onClick={handleRemoveScreenshot}
                    style={{
                      padding: '6px 12px', fontSize: '11px', fontWeight: 600,
                      background: 'transparent',
                      border: '1px solid #ef5350',
                      borderRadius: '4px', color: '#ef5350',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color, #2a2d3a)',
                  borderRadius: '8px', padding: '24px',
                  textAlign: 'center', cursor: isUploading ? 'wait' : 'pointer',
                  background: 'var(--bg-primary, #0f1117)',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}>
                  {isUploading ? '...' : '+'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {isUploading ? 'Uploading...' : 'Click to upload chart screenshot'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  PNG, JPG, WebP (max 5MB)
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadScreenshot}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
