'use client';

import { useState } from 'react';
import { OrderPanel } from '@/components/Trading/OrderPanel';
import { PositionList } from '@/components/Trading/PositionList';

/**
 * Right-side trading sidebar shown on every page except Dashboard.
 * Contains Place Order / Positions tabs.
 */
export function TradingSidebar() {
  const [tab, setTab] = useState<'order' | 'positions'>('order');

  return (
    <aside className="hidden md:flex w-80 shrink-0 border-l border-surface-container-highest flex flex-col overflow-hidden bg-surface-container-lowest">
      {/* Tab bar */}
      <div className="grid grid-cols-2 border-b border-surface-container-highest shrink-0">
        <button
          onClick={() => setTab('order')}
          className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${tab === 'order'
              ? 'bg-primary-container text-on-primary-fixed'
              : 'text-on-surface-variant hover:bg-surface-container'
            }`}
        >
          Place Order
        </button>
        <button
          onClick={() => setTab('positions')}
          className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${tab === 'positions'
              ? 'bg-primary-container text-on-primary-fixed'
              : 'text-on-surface-variant hover:bg-surface-container'
            }`}
        >
          Positions
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === 'order' ? (
          <OrderPanel />
        ) : (
          <PositionList compact />
        )}
      </div>
    </aside>
  );
}
