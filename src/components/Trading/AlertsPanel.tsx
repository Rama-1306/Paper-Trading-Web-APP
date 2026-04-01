'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDateTime } from '@/lib/utils/formatters';
import { parseSymbolDisplay } from '@/lib/utils/symbols';
import {
  useAlertStore,
  type AlertKind,
  type LtpCondition,
  type RepeatDuration,
} from '@/stores/alertStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';

type SearchResult = {
  value: string;
  label: string;
};

const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  POSITION_FILLED: 'Position Filled',
  TARGET_HIT: 'Target Hit',
  SL_TRIGGER: 'SL Trigger',
  LTP_TRIGGER: 'LTP Trigger',
};

const SOUND_ROWS: AlertKind[] = [
  'POSITION_FILLED',
  'TARGET_HIT',
  'SL_TRIGGER',
  'LTP_TRIGGER',
];

export function AlertsPanel() {
  const eventSettings = useAlertStore((s) => s.eventSettings);
  const ltpAlerts = useAlertStore((s) => s.ltpAlerts);
  const alertHistory = useAlertStore((s) => s.alertHistory);
  const customSounds = useAlertStore((s) => s.customSounds);
  const repeatDurations = useAlertStore((s) => s.repeatDurations);
  const desktopOnlyMode = useAlertStore((s) => s.desktopOnlyMode);
  const notificationPermission = useAlertStore((s) => s.notificationPermission);
  const setEventAlertEnabled = useAlertStore((s) => s.setEventAlertEnabled);
  const addLtpAlert = useAlertStore((s) => s.addLtpAlert);
  const toggleLtpAlertEnabled = useAlertStore((s) => s.toggleLtpAlertEnabled);
  const resetLtpAlert = useAlertStore((s) => s.resetLtpAlert);
  const removeLtpAlert = useAlertStore((s) => s.removeLtpAlert);
  const setRepeatDuration = useAlertStore((s) => s.setRepeatDuration);
  const setCustomSoundForKind = useAlertStore((s) => s.setCustomSoundForKind);
  const playAlertSound = useAlertStore((s) => s.playAlertSound);
  const setDesktopOnlyMode = useAlertStore((s) => s.setDesktopOnlyMode);
  const requestDesktopPermission = useAlertStore((s) => s.requestDesktopPermission);
  const syncNotificationPermission = useAlertStore((s) => s.syncNotificationPermission);
  const clearAlertHistory = useAlertStore((s) => s.clearAlertHistory);

  const subscribeSymbols = useMarketStore((s) => s.subscribePositionSymbols);
  const ticks = useMarketStore((s) => s.ticks);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const toggleSound = useUIStore((s) => s.toggleSound);
  const addNotification = useUIStore((s) => s.addNotification);

  const [symbolInput, setSymbolInput] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [condition, setCondition] = useState<LtpCondition>('ABOVE');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [soundErrors, setSoundErrors] = useState<Partial<Record<AlertKind, string>>>({});
  const [loadingSoundKind, setLoadingSoundKind] = useState<AlertKind | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    syncNotificationPermission();
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [syncNotificationPermission]);

  const handleSearchInput = (value: string) => {
    setSymbolInput(value.toUpperCase());
    setSearchResults([]);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const query = value.trim();
    if (query.length < 2) return;

    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}&type=all&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults((data.results || []).map((r: any) => ({ value: r.value, label: r.label })));
        }
      } catch {
        // ignore search errors
      }
      setSearchLoading(false);
    }, 250);
  };

  const handleAddLtpAlert = () => {
    const symbol = symbolInput.trim().toUpperCase();
    const target = Number(triggerPrice);

    const result = addLtpAlert({
      symbol,
      displayName: parseSymbolDisplay(symbol) || symbol,
      condition,
      targetPrice: target,
    });

    if (!result.ok) {
      addNotification({
        type: 'error',
        title: 'Alert Not Added',
        message: result.error || 'Unable to add alert',
      });
      return;
    }

    subscribeSymbols([symbol]);
    addNotification({
      type: 'success',
      title: 'LTP Alert Added',
      message: `${symbol} ${condition === 'ABOVE' ? 'above' : 'below'} ${target.toFixed(2)}`,
    });

    setSymbolInput('');
    setTriggerPrice('');
    setSearchResults([]);
  };

  const handleSoundUploadForKind = async (kind: AlertKind, file: File) => {
    setSoundErrors((prev) => ({ ...prev, [kind]: '' }));

    if (!file.type.startsWith('audio/')) {
      setSoundErrors((prev) => ({ ...prev, [kind]: 'Select a valid audio file.' }));
      return;
    }

    setLoadingSoundKind(kind);
    const objectUrl = URL.createObjectURL(file);

    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.src = objectUrl;
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => reject(new Error('Invalid audio'));
      });

      if (!Number.isFinite(duration) || duration <= 0 || duration > 60) {
        URL.revokeObjectURL(objectUrl);
        setSoundErrors((prev) => ({ ...prev, [kind]: 'Custom sound should be within 1 minute.' }));
        return;
      }

      setCustomSoundForKind(kind, {
        name: file.name,
        mimeType: file.type || 'audio/*',
        durationSeconds: duration,
        objectUrl,
      });

      addNotification({
        type: 'success',
        title: 'Custom Sound Saved',
        message: `${ALERT_KIND_LABELS[kind]}: ${file.name} (${Math.round(duration)}s)`,
      });
    } catch {
      URL.revokeObjectURL(objectUrl);
      setSoundErrors((prev) => ({ ...prev, [kind]: 'Could not load audio metadata. Try another file.' }));
    } finally {
      setLoadingSoundKind(null);
    }
  };

  const requestDesktopAccess = async () => {
    const permission = await requestDesktopPermission();
    if (permission === 'granted') {
      addNotification({ type: 'success', title: 'Desktop Notifications Enabled', message: 'Browser permission granted.' });
      return;
    }
    if (permission === 'denied') {
      addNotification({ type: 'error', title: 'Desktop Notifications Blocked', message: 'Allow notifications in browser settings.' });
      return;
    }
    addNotification({ type: 'warning', title: 'Desktop Notifications Unavailable', message: 'Notifications are not supported in this browser.' });
  };

  return (
    <div style={{ padding: '12px', display: 'grid', gap: '12px' }}>
      <div className="panel" style={{ padding: '10px' }}>
        <div className="panel-header" style={{ marginBottom: '8px' }}>
          <span className="panel-title">Event Alerts</span>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={eventSettings.positionFilled}
              onChange={(e) => setEventAlertEnabled('positionFilled', e.target.checked)}
            />
            Position Filled
          </label>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={eventSettings.targetHit}
              onChange={(e) => setEventAlertEnabled('targetHit', e.target.checked)}
            />
            Target Hit
          </label>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={eventSettings.slTrigger}
              onChange={(e) => setEventAlertEnabled('slTrigger', e.target.checked)}
            />
            SL Trigger
          </label>
        </div>
      </div>

      <div className="panel" style={{ padding: '10px' }}>
        <div className="panel-header" style={{ marginBottom: '8px' }}>
          <span className="panel-title">Notification Mode</span>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={desktopOnlyMode}
              onChange={(e) => setDesktopOnlyMode(e.target.checked)}
            />
            Desktop notification only (silent)
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Permission: {notificationPermission}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={requestDesktopAccess}>
              Enable Desktop Notifications
            </button>
          </div>

          {!desktopOnlyMode && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input type="checkbox" checked={soundEnabled} onChange={toggleSound} />
              Enable Alert Sounds
            </label>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: '10px' }}>
        <div className="panel-header" style={{ marginBottom: '8px' }}>
          <span className="panel-title">Sound Profile (Per Alert)</span>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Upload custom sound for each alert type (audio/*, within 1 minute).
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          {SOUND_ROWS.map((kind) => {
            const current = customSounds[kind];
            const repeat = repeatDurations[kind];
            return (
              <div key={kind} style={{ border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '8px', display: 'grid', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{ALERT_KIND_LABELS[kind]}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Repeat:</label>
                    <select
                      className="input"
                      style={{ height: '28px', padding: '2px 8px', fontSize: '11px' }}
                      value={repeat}
                      onChange={(e) => setRepeatDuration(kind, Number(e.target.value) as RepeatDuration)}
                    >
                      <option value={0}>No Repeat</option>
                      <option value={30}>30 sec</option>
                      <option value={60}>1 min</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={loadingSoundKind === kind}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSoundUploadForKind(kind, file);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => playAlertSound(kind)}>
                    Test
                  </button>
                  {current && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setCustomSoundForKind(kind, null)}>
                      Remove
                    </button>
                  )}
                </div>

                {current && (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {current.name} ({Math.round(current.durationSeconds)}s)
                  </span>
                )}
                {soundErrors[kind] && (
                  <span style={{ fontSize: '11px', color: 'var(--color-loss)' }}>{soundErrors[kind]}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ padding: '10px' }}>
        <div className="panel-header" style={{ marginBottom: '8px' }}>
          <span className="panel-title">LTP Trigger Alerts</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '6px', marginBottom: '10px' }}>
          <input
            className="input"
            placeholder="Symbol (e.g. NSE:BANKNIFTY26APR51500CE)"
            value={symbolInput}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
          <select className="input" value={condition} onChange={(e) => setCondition(e.target.value as LtpCondition)}>
            <option value="ABOVE">Above</option>
            <option value="BELOW">Below</option>
          </select>
          <input
            className="input"
            type="number"
            placeholder="Price"
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
            step="0.05"
          />
          <button className="btn btn-primary btn-sm" onClick={handleAddLtpAlert}>Add</button>
        </div>

        {searchLoading && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Searching symbols...</div>
        )}

        {searchResults.length > 0 && (
          <div style={{ maxHeight: '140px', overflow: 'auto', border: '1px solid var(--border-primary)', borderRadius: '4px', marginBottom: '10px' }}>
            {searchResults.map((result) => (
              <button
                key={result.value}
                onClick={() => {
                  setSymbolInput(result.value);
                  setSearchResults([]);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                {result.label}
                <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{result.value}</div>
              </button>
            ))}
          </div>
        )}

        {ltpAlerts.length === 0 ? (
          <div className="empty-state" style={{ padding: '12px 0' }}>
            <div className="empty-state-text">No LTP alerts added</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Condition</th>
                <th className="right">Target</th>
                <th className="right">LTP</th>
                <th>Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ltpAlerts.map((alert) => {
                const ltp = ticks[alert.symbol]?.ltp;
                return (
                  <tr key={alert.id}>
                    <td>{alert.displayName || alert.symbol}</td>
                    <td>{alert.condition}</td>
                    <td className="right">{alert.targetPrice.toFixed(2)}</td>
                    <td className="right">{Number.isFinite(ltp) ? ltp.toFixed(2) : '—'}</td>
                    <td style={{ fontSize: '11px' }}>
                      {alert.isTriggered ? (
                        <span style={{ color: 'var(--color-profit)' }}>TRIGGERED</span>
                      ) : alert.isEnabled ? (
                        <span style={{ color: 'var(--color-info)' }}>ACTIVE</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>PAUSED</span>
                      )}
                    </td>
                    <td className="center">
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleLtpAlertEnabled(alert.id)}>
                          {alert.isEnabled ? 'Pause' : 'Resume'}
                        </button>
                        {alert.isTriggered && (
                          <button className="btn btn-ghost btn-sm" onClick={() => resetLtpAlert(alert.id)}>
                            Reset
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => removeLtpAlert(alert.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ padding: '10px' }}>
        <div className="panel-header" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span className="panel-title">Alert History</span>
          <button className="btn btn-ghost btn-sm" onClick={clearAlertHistory}>Clear</button>
        </div>

        {alertHistory.length === 0 ? (
          <div className="empty-state" style={{ padding: '12px 0' }}>
            <div className="empty-state-text">No alerts triggered yet</div>
          </div>
        ) : (
          <div style={{ maxHeight: '260px', overflow: 'auto', display: 'grid', gap: '6px' }}>
            {alertHistory.slice(0, 100).map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  padding: '8px',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.title}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatDateTime(item.timestamp)}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>{item.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

