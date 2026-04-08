'use client';

/**
 * SignalSourcePanel — Dashboard settings for dual signal sources.
 *
 * Shows two toggle rows:
 *   • CCC Engine  (internal — fires on confirmed closed candle)
 *   • Webhook     (external — TradingView or any POST to /api/webhook/signal)
 *
 * Reads current state from /api/signals/settings and persists changes via PATCH.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';

interface Settings {
  ccc_engine_enabled: boolean;
  webhook_enabled: boolean;
}

interface SignalSourcePanelProps {
  /** Called when CCC engine toggle changes, so parent can start/stop the hook */
  onCCCEngineChange?: (enabled: boolean) => void;
}

export function SignalSourcePanel({ onCCCEngineChange }: SignalSourcePanelProps) {
  const [settings, setSettings] = useState<Settings>({
    ccc_engine_enabled: true,
    webhook_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<'ccc_engine' | 'webhook' | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/signals/settings')
      .then(r => r.json())
      .then((data: Settings) => {
        setSettings(data);
        onCCCEngineChange?.(data.ccc_engine_enabled);
      })
      .catch(() => setError('Could not load signal settings'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(key: 'ccc_engine_enabled' | 'webhook_enabled') {
    const source = key === 'ccc_engine_enabled' ? 'ccc_engine' : 'webhook';
    const newVal = !settings[key];
    setSaving(source);
    setError(null);
    try {
      const res = await fetch('/api/signals/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [key]: newVal }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json() as Settings;
      setSettings(updated);
      if (key === 'ccc_engine_enabled') onCCCEngineChange?.(updated.ccc_engine_enabled);
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={panel}>
      {/* Header */}
      <div style={header}>
        <span style={title}>Signal Sources</span>
        <Link href="/signal-log" style={logLink}>View Log →</Link>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {loading ? (
        <div style={loadingMsg}>Loading…</div>
      ) : (
        <div style={rows}>
          {/* CCC Engine Row */}
          <SourceRow
            label="CCC Engine"
            description="Fires on confirmed closed candle (internal)"
            badgeLabel="CCC Engine"
            badgeColor="#6366f1"
            enabled={settings.ccc_engine_enabled}
            saving={saving === 'ccc_engine'}
            onToggle={() => toggle('ccc_engine_enabled')}
          />

          {/* Webhook Row */}
          <SourceRow
            label="Webhook"
            description="Accepts POST /api/webhook/signal (TradingView)"
            badgeLabel="Webhook"
            badgeColor="#22c55e"
            enabled={settings.webhook_enabled}
            saving={saving === 'webhook'}
            onToggle={() => toggle('webhook_enabled')}
          />
        </div>
      )}

      <div style={footer}>
        <span style={footerNote}>
          Both sources route through Signal Router → Bot → Paper Order
        </span>
      </div>
    </div>
  );
}

/* ── Sub-component ── */

function SourceRow({
  label,
  description,
  badgeLabel,
  badgeColor,
  enabled,
  saving,
  onToggle,
}: {
  label: string;
  description: string;
  badgeLabel: string;
  badgeColor: string;
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={row}>
      <div style={rowLeft}>
        <span
          style={{
            ...badge,
            background: `${badgeColor}18`,
            color:  badgeColor,
            border: `1px solid ${badgeColor}40`,
          }}
        >
          {badgeLabel}
        </span>
        <div>
          <div style={rowLabel}>{label}</div>
          <div style={rowDesc}>{description}</div>
        </div>
      </div>
      <button
        style={toggleBtn(enabled, saving)}
        onClick={onToggle}
        disabled={saving}
        title={enabled ? 'Disable this source' : 'Enable this source'}
      >
        {saving ? '…' : enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

/* ── Styles ── */

const panel: CSSProperties = {
  background:   '#0f1420',
  borderRadius: 10,
  border:       '1px solid rgba(255,255,255,0.07)',
  padding:      '14px 16px',
  fontFamily:   'Inter, sans-serif',
};

const header: CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'center',
  marginBottom:   12,
};

const title: CSSProperties = {
  fontSize:   13,
  fontWeight: 700,
  color:      '#e8eaed',
};

const logLink: CSSProperties = {
  fontSize:       11,
  color:          '#6366f1',
  textDecoration: 'none',
};

const errorBox: CSSProperties = {
  background:   'rgba(255,23,68,0.08)',
  border:       '1px solid rgba(255,23,68,0.25)',
  borderRadius: 5,
  color:        '#ff6b6b',
  fontSize:     11,
  padding:      '6px 10px',
  marginBottom: 8,
};

const loadingMsg: CSSProperties = {
  color:    '#555a65',
  fontSize: 12,
  padding:  '8px 0',
};

const rows: CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           8,
};

const row: CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'center',
  padding:        '10px 12px',
  background:     'rgba(255,255,255,0.03)',
  borderRadius:   7,
  border:         '1px solid rgba(255,255,255,0.05)',
};

const rowLeft: CSSProperties = {
  display: 'flex',
  gap:     10,
  alignItems: 'center',
};

const badge: CSSProperties = {
  fontSize:     10,
  fontWeight:   700,
  padding:      '3px 7px',
  borderRadius: 4,
  whiteSpace:   'nowrap',
};

const rowLabel: CSSProperties = {
  fontSize:   12,
  fontWeight: 600,
  color:      '#e8eaed',
};

const rowDesc: CSSProperties = {
  fontSize:  10,
  color:     '#555a65',
  marginTop: 2,
};

const footer: CSSProperties = {
  marginTop:  10,
  paddingTop: 10,
  borderTop:  '1px solid rgba(255,255,255,0.05)',
};

const footerNote: CSSProperties = {
  fontSize: 10,
  color:    '#3a3f4a',
};

function toggleBtn(enabled: boolean, saving: boolean): CSSProperties {
  return {
    padding:      '5px 14px',
    borderRadius: 5,
    border:       'none',
    fontSize:     11,
    fontWeight:   700,
    cursor:       saving ? 'wait' : 'pointer',
    opacity:      saving ? 0.6 : 1,
    transition:   'background 0.15s, color 0.15s',
    background:   enabled ? 'rgba(34,197,94,0.15)'  : 'rgba(255,255,255,0.05)',
    color:        enabled ? '#22c55e'                : '#555a65',
    outline:      enabled ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
  };
}
