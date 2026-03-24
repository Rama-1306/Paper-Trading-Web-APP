'use client';

import { useEffect, useState } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { formatTime } from '@/lib/utils/formatters';

export function StatusBar() {
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const marketStatus = useMarketStore((s) => s.marketStatus);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sessionLabels: Record<string, string> = {
    PRE: '🕐 Pre-Open',
    OPEN: '🟢 Market Open',
    CLOSED: '🔴 Market Closed',
    POST: '🟡 Post-Market',
  };

  return (
    <footer className="status-bar" style={{
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
        <span>
          {connectionStatus.isConnected ? '🟢' : '🔴'}{' '}
          {connectionStatus.isConnected ? 'Live Feed Connected' : 'Disconnected'}
        </span>
        <span>{sessionLabels[marketStatus.session] ?? 'Unknown'}</span>
        <span>Symbols: {connectionStatus.subscribedSymbols.length}</span>
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span>Paper Trading Mode</span>
        <span>{mounted ? formatTime(Date.now()) : '--:--:--'} IST</span>
      </div>
    </footer>
  );
}
