/**
 * Signal Router — shared server-side utility
 *
 * Accepts a normalized signal from either source (CCC Engine or Webhook),
 * checks if that source is enabled, saves to WebhookSignal, broadcasts to bots.
 */

import prisma from '@/lib/db';

export type SignalSource = 'ccc_engine' | 'webhook';

export interface RouterSignal {
  source: SignalSource;
  action: 'BUY' | 'SELL';
  symbol: string;
  exchange: string;
  signal_type: string;
  score: number;
  entry?: number;
  sl?: number;
  t1?: number;
  t2?: number;
  t3?: number;
  timeframe?: string;
  candle_high?: number;
  candle_low?: number;
  close?: number;
}

export interface RouterResult {
  signal_id: string;
  bot_notified: boolean;
  bots_accepted: number;
}

export class SignalDisabledError extends Error {
  constructor(source: SignalSource) {
    super(`Signal source '${source}' is currently disabled`);
    this.name = 'SignalDisabledError';
  }
}

/** Check if a given source is enabled in signal_settings (defaults to true if row missing). */
async function isSourceEnabled(source: SignalSource): Promise<boolean> {
  try {
    const settings = await prisma.signalSettings.findUnique({ where: { id: 1 } });
    if (!settings) return true; // no settings row → default enabled
    return source === 'ccc_engine' ? settings.ccc_engine_enabled : settings.webhook_enabled;
  } catch {
    // Table may not exist yet (pre-migration) — allow signal through
    return true;
  }
}

export async function routeSignal(signal: RouterSignal, hostUrl: string): Promise<RouterResult> {
  // 1. Check source enabled
  const enabled = await isSourceEnabled(signal.source);
  if (!enabled) throw new SignalDisabledError(signal.source);

  // 2. Save to DB
  const saved = await prisma.webhookSignal.create({
    data: {
      action:      signal.action,
      symbol:      signal.symbol.toUpperCase(),
      exchange:    signal.exchange.toUpperCase(),
      signal_type: signal.signal_type,
      score:       signal.score,
      source:      signal.source,
      entry:       signal.entry  ?? null,
      sl:          signal.sl     ?? null,
      t1:          signal.t1     ?? null,
      t2:          signal.t2     ?? null,
      t3:          signal.t3     ?? null,
      timeframe:   signal.timeframe ?? null,
      candle_high: signal.candle_high ?? null,
      candle_low:  signal.candle_low  ?? null,
      close:       signal.close       ?? null,
      bot_notified:  false,
      order_created: false,
    },
  });

  console.log(
    `[SignalRouter] Saved ${signal.source} signal ID=${saved.id} ` +
    `${saved.action} ${saved.symbol} entry=${signal.entry ?? '-'} sl=${signal.sl ?? '-'}`
  );

  // 3. Broadcast to bots
  const broadcastPayload = {
    action:      saved.action,
    symbol:      saved.symbol,
    exchange:    saved.exchange,
    signal_type: saved.signal_type,
    score:       saved.score,
    entry:       saved.entry,
    sl:          saved.sl,
    t1:          saved.t1,
    t2:          saved.t2,
    t3:          saved.t3,
    candle_high: saved.candle_high,
    candle_low:  saved.candle_low,
    close:       saved.close,
    signal_id:   saved.id,
    timestamp:   saved.created_at.toISOString(),
  };

  // 3. Broadcast to bots in background — fire-and-forget so TradingView gets
  //    a fast 200 before the bot responds (avoids "request took too long" timeouts).
  //    Railway is a persistent process so the promise completes after response is sent.
  void (async () => {
    try {
      const broadcastRes = await fetch(`${hostUrl}/api/signals/broadcast`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(broadcastPayload),
      });
      if (broadcastRes.ok) {
        const data = await broadcastRes.json() as { accepted?: number };
        const accepted = data.accepted ?? 0;
        if (accepted > 0) {
          await prisma.webhookSignal.update({
            where: { id: saved.id },
            data:  { bot_notified: true },
          });
          console.log(`[SignalRouter] Bot notified — ${accepted} bot(s) accepted signal ${saved.id}`);
        }
      } else {
        console.warn(`[SignalRouter] Broadcast returned ${broadcastRes.status}`);
      }
    } catch (err) {
      console.error('[SignalRouter] Background broadcast failed:', err);
    }
  })();

  return { signal_id: saved.id, bot_notified: false, bots_accepted: 0 };
}
