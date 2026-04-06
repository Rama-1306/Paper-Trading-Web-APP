'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

const THRESHOLD = 72; // px pull distance to trigger refresh

interface Props {
  onRefresh: () => Promise<void>;
}

/** Returns the nearest scrollable ancestor (or self) of an element. */
function getScrollParent(el: Element | null): HTMLElement | null {
  if (!el || el === document.body) return null;
  const style = window.getComputedStyle(el);
  const oy = style.overflowY;
  if (oy === 'auto' || oy === 'scroll') return el as HTMLElement;
  return getScrollParent(el.parentElement);
}

/**
 * Renders a pull-to-refresh indicator that attaches to the document.
 * Only activates on mobile (touch devices) when the scrollable content
 * under the finger is at scrollTop === 0.
 */
export function PullToRefresh({ onRefresh }: Props) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs to avoid stale closures in event listeners
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const pullYRef = useRef(0);

  const syncPullY = (val: number) => {
    pullYRef.current = val;
    setPullY(val);
  };

  const doRefresh = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      syncPullY(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      const target = e.touches[0].target as Element;
      const scrollEl = getScrollParent(target);
      // Only start pull when the scrollable content is at the very top
      if (scrollEl && scrollEl.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 5) return;

      const target = e.touches[0].target as Element;
      const scrollEl = getScrollParent(target);
      if (scrollEl && scrollEl.scrollTop > 0) return;

      isPullingRef.current = true;
      // Dampen movement so it feels natural (0.45 factor)
      const clamped = Math.min(THRESHOLD * 1.6, dy * 0.45);
      syncPullY(clamped);
      // Prevent the browser's native overscroll/bounce
      e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      if (pullYRef.current >= THRESHOLD) {
        doRefresh();
      } else {
        syncPullY(0);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [doRefresh]);

  const visible = pullY > 0 || refreshing;
  if (!visible) return null;

  const progress = Math.min(1, pullY / THRESHOLD);
  const indicatorH = refreshing ? THRESHOLD : pullY;

  // SVG spinner ring
  const size = 30;
  const strokeW = 2.5;
  const r = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = refreshing ? 0 : circumference * (1 - progress);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: `${indicatorH}px`,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        transition: refreshing ? 'height 0.2s ease' : 'none',
        pointerEvents: 'none',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform: refreshing ? undefined : `rotate(${progress * 270 - 90}deg)`,
          animation: refreshing ? 'spin 0.8s linear infinite' : undefined,
          transition: refreshing ? 'none' : 'transform 0.05s linear',
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent, #6366f1)"
          strokeWidth={strokeW}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: refreshing ? 'none' : 'stroke-dashoffset 0.05s linear' }}
        />
      </svg>
    </div>
  );
}
