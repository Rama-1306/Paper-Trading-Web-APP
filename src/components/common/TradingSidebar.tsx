'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { OrderPanel } from '@/components/Trading/OrderPanel';
import { PositionList } from '@/components/Trading/PositionList';

const MIN_WIDTH = 260;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 320;

/**
 * Right-side trading sidebar shown on every page except Dashboard.
 * Contains Place Order / Positions tabs with a left-edge drag-to-resize handle.
 */
export function TradingSidebar() {
  const [tab, setTab] = useState<'order' | 'positions'>('order');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
    };
    const onMouseUp = () => { dragging.current = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <aside
      className="hidden md:flex shrink-0 border-l border-surface-container-highest flex-row overflow-hidden bg-surface-container-lowest"
      style={{ width }}
    >
      {/* Drag handle — left edge */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
        title="Drag to resize"
      />

      {/* Panel content */}
      <div className="flex flex-col flex-1 overflow-hidden">
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
      </div>
    </aside>
  );
}
