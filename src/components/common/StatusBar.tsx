'use client';

import { useEffect, useState } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { computeMarketStatus } from '@/stores/marketStore';
import { formatTime } from '@/lib/utils/formatters';

export function StatusBar() {
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const nseStatus = computeMarketStatus(false);
  const mcxStatus = computeMarketStatus(true);

  const sessionLabel = (session: string, isOpen: boolean) => {
    if (session === 'PRE') return '🕐 Pre-Open';
    if (session === 'POST') return '🟡 Post-Market';
    return isOpen ? '🟢 Open' : '🔴 Closed';
  };

  const isMCXActive = activeSymbol.startsWith('MCX:');

  const feedLabel = !connectionStatus.isConnected
    ? '🔴 WS Server Down'
    : connectionStatus.isFeedLive
      ? '🟢 Live Feed'
      : '🟡 Feed Down';

  return (
    <footer className="status-bar hidden md:flex" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '28px',
      padding: '0 16px',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-primary)',
      fontSize: '11px',
      color: 'var(--text-muted)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span>{feedLabel}</span>
        <span style={{ fontWeight: isMCXActive ? 400 : 600, color: isMCXActive ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          NSE: {sessionLabel(nseStatus.session, nseStatus.isOpen)}
        </span>
        <span style={{ fontWeight: isMCXActive ? 600 : 400, color: isMCXActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          MCX: {sessionLabel(mcxStatus.session, mcxStatus.isOpen)}
        </span>
        <span>Symbols: {connectionStatus.subscribedSymbols.length}</span>
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span>Paper Trading Mode</span>
        <span>{mounted ? formatTime(Date.now()) : '--:--:--'} IST</span>
      </div>
    </footer>
  );
}
