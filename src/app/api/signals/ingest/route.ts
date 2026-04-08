/**
 * POST /api/signals/ingest
 * Signal Router API — accepts signals from either source, normalizes, saves, broadcasts.
 *
 * Called by:
 *   - CCC Engine hook (source: 'ccc_engine')  — fires on confirmed closed candle
 *   - External webhook (source: 'webhook')     — called by /api/webhook/signal after parsing
 *
 * Body:
 * {
 *   "source":      "ccc_engine" | "webhook",
 *   "action":      "BUY" | "SELL",
 *   "symbol":      "BANKNIFTY",
 *   "exchange":    "NSE",
 *   "signal_type": "CCC_BULL",
 *   "score":       4,
 *   "entry":       48100.0,    // optional
 *   "sl":          47800.0,    // optional
 *   "t1":          48400.0,    // optional
 *   "t2":          48600.0,    // optional
 *   "t3":          48900.0,    // optional
 *   "timeframe":   "5",        // optional
 *   "candle_high": 48250.0,    // optional
 *   "candle_low":  47980.0,    // optional
 *   "close":       48100.0     // optional
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeSignal, SignalDisabledError } from '@/lib/signalRouter';
import type { RouterSignal } from '@/lib/signalRouter';

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { source, action, symbol, exchange, signal_type, score } = body as {
      source?: string;
      action?: string;
      symbol?: string;
      exchange?: string;
      signal_type?: string;
      score?: number;
    };

    // Validate required fields
    if (!source || !['ccc_engine', 'webhook'].includes(source)) {
      return NextResponse.json(
        { error: "source must be 'ccc_engine' or 'webhook'" },
        { status: 400 }
      );
    }
    if (!action || !['BUY', 'SELL'].includes(action.toUpperCase())) {
      return NextResponse.json({ error: "action must be 'BUY' or 'SELL'" }, { status: 400 });
    }
    if (!symbol)   return NextResponse.json({ error: 'symbol is required' },   { status: 400 });
    if (!exchange) return NextResponse.json({ error: 'exchange is required' }, { status: 400 });
    if (score === undefined || score === null) {
      return NextResponse.json({ error: 'score is required' }, { status: 400 });
    }

    const signal: RouterSignal = {
      source:      source as 'ccc_engine' | 'webhook',
      action:      action.toUpperCase() as 'BUY' | 'SELL',
      symbol,
      exchange,
      signal_type: (signal_type as string) ?? 'UNKNOWN',
      score:       Number(score),
      entry:       body.entry       != null ? Number(body.entry)       : undefined,
      sl:          body.sl          != null ? Number(body.sl)          : undefined,
      t1:          body.t1          != null ? Number(body.t1)          : undefined,
      t2:          body.t2          != null ? Number(body.t2)          : undefined,
      t3:          body.t3          != null ? Number(body.t3)          : undefined,
      timeframe:   body.timeframe   != null ? String(body.timeframe)   : undefined,
      candle_high: body.candle_high != null ? Number(body.candle_high) : undefined,
      candle_low:  body.candle_low  != null ? Number(body.candle_low)  : undefined,
      close:       body.close       != null ? Number(body.close)       : undefined,
    };

    const host     = req.headers.get('host') ?? 'localhost:5000';
    const protocol = req.headers.get('x-forwarded-proto') ?? 'http';
    const hostUrl  = `${protocol}://${host}`;

    const result = await routeSignal(signal, hostUrl);

    return NextResponse.json(
      {
        status:        'received',
        signal_id:     result.signal_id,
        bot_notified:  result.bot_notified,
        bots_accepted: result.bots_accepted,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof SignalDisabledError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('[SignalIngest] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'SAHAAI signal ingest router' });
}
