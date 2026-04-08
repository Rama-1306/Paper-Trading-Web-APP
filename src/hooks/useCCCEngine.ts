'use client';

/**
 * useCCCEngine — SOURCE 1: Internal Signal Engine
 *
 * Monitors live candles from marketStore and fires a signal whenever the CCC
 * indicator detects a signal on a CONFIRMED CLOSED candle.
 *
 * Candle-close detection: minutes % interval === 0 && seconds < 5
 * (runs a 1-second timer; de-bounced per slot so it only fires once per candle)
 */

import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { calculateCCC } from '@/lib/indicators/ccc';

export function useCCCEngine(enabled: boolean) {
  const lastSlotRef  = useRef<string>('');
  const firingRef    = useRef(false);

  // Use refs for stable read inside the interval without re-creating it
  const candlesRef   = useRef(useMarketStore.getState().candles);
  const timeframeRef = useRef(useMarketStore.getState().timeframe);
  const symbolRef    = useRef(useMarketStore.getState().activeSymbol);

  // Keep refs in sync with store
  useEffect(() => {
    const unsub = useMarketStore.subscribe((state) => {
      candlesRef.current   = state.candles;
      timeframeRef.current = state.timeframe;
      symbolRef.current    = state.activeSymbol;
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      const now     = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const tf      = parseInt(timeframeRef.current, 10);

      // Only fire in the first 5 seconds after a candle boundary
      if (minutes % tf !== 0 || seconds >= 5) return;

      const slotKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${minutes}`;
      if (slotKey === lastSlotRef.current) return;
      if (firingRef.current) return;

      lastSlotRef.current = slotKey;
      firingRef.current   = true;

      const candles = candlesRef.current;

      // Need at least 100 candles for reliable CCC calculation
      if (candles.length < 100) {
        console.log('[CCCEngine] Not enough candles yet:', candles.length);
        firingRef.current = false;
        return;
      }

      try {
        const results = calculateCCC(candles);
        if (results.length === 0) { firingRef.current = false; return; }

        // At the boundary moment the last candle in the array is the just-closed candle
        const last = results[results.length - 1];

        if (!last.isSignalCandle) {
          console.log(`[CCCEngine] Candle closed at ${slotKey} — no signal`);
          firingRef.current = false;
          return;
        }

        const action      = last.signalDirection === 'BULL' ? 'BUY' : 'SELL';
        const rawSymbol   = symbolRef.current;
        const exchange    = rawSymbol.startsWith('MCX:') ? 'MCX' : 'NSE';
        // Strip exchange prefix for the symbol field
        const symbol      = rawSymbol.replace(/^(NSE:|MCX:|BSE:)/, '');

        console.log(
          `[CCCEngine] Signal detected at ${slotKey}: ${action} ${symbol} ` +
          `entry=${last.lvlEntry?.toFixed(2)} sl=${last.lvlSL?.toFixed(2)}`
        );

        fetch('/api/signals/ingest', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source:      'ccc_engine',
            action,
            symbol,
            exchange,
            signal_type: action === 'BUY' ? 'CCC_BULL' : 'CCC_BEAR',
            score:       4,
            timeframe:   timeframeRef.current,
            entry:       last.lvlEntry,
            sl:          last.lvlSL,
            t1:          last.lvlT1,
            t2:          last.lvlT2,
            t3:          last.lvlT3,
            candle_high: last.high,
            candle_low:  last.low,
            close:       last.close,
          }),
        })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json() as { signal_id?: string; bot_notified?: boolean };
              console.log(
                `[CCCEngine] Signal routed: id=${data.signal_id} bot_notified=${data.bot_notified}`
              );
            } else {
              const err = await res.json().catch(() => ({})) as { error?: string };
              console.warn('[CCCEngine] Ingest rejected:', res.status, err?.error);
            }
          })
          .catch((err) => console.error('[CCCEngine] Fetch error:', err))
          .finally(() => { firingRef.current = false; });
      } catch (err) {
        console.error('[CCCEngine] CCC calculation error:', err);
        firingRef.current = false;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled]);
}
