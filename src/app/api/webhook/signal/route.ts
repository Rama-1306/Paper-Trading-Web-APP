/**
 * POST /api/webhook/signal
 * SAHAAI Signal Flow — External Webhook Receiver (SOURCE 2)
 *
 * TradingView Pine Script (or any external tool) fires a POST to this URL.
 * The payload is parsed and forwarded to the Signal Router (/api/signals/ingest)
 * which handles saving, broadcasting, and respecting the webhook enabled/disabled flag.
 *
 * Expected JSON:
 * {
 *   "action":      "BUY",
 *   "symbol":      "BANKNIFTY",
 *   "exchange":    "NSE",
 *   "signal_type": "CCC_BULL",       // optional, defaults to "UNKNOWN"
 *   "score":       4,
 *   "candle_high": 48250.0,           // optional
 *   "candle_low":  47980.0,           // optional
 *   "close":       48100.0,           // optional (used as entry if entry not given)
 *   "entry":       48100.0,           // optional
 *   "sl":          47800.0,           // optional
 *   "t1":          48400.0,           // optional
 *   "t2":          48600.0,           // optional
 *   "t3":          48900.0,           // optional
 *   "timeframe":   "5"                // optional
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
      return NextResponse.json({ message: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { action, symbol, exchange, signal_type, score, candle_high, candle_low, close } = body as {
      action?: string;
      symbol?: string;
      exchange?: string;
      signal_type?: string;
      score?: number;
      candle_high?: number;
      candle_low?: number;
      close?: number;
    };

    // Required fields
    if (!action || !symbol || !exchange || score === undefined || score === null) {
      return NextResponse.json(
        {
          message: 'Missing required fields. Need: action, symbol, exchange, score',
          received: { action, symbol, exchange, score },
        },
        { status: 400 }
      );
    }
    if (!['BUY', 'SELL'].includes(action.toUpperCase())) {
      return NextResponse.json({ message: "action must be 'BUY' or 'SELL'" }, { status: 400 });
    }
    if (!['NSE', 'MCX', 'BSE'].includes(exchange.toUpperCase())) {
      return NextResponse.json({ message: "exchange must be 'NSE', 'MCX', or 'BSE'" }, { status: 400 });
    }

    console.log(
      `[Webhook] Signal received: ${action.toUpperCase()} ${symbol} (${exchange}) ` +
      `type=${signal_type ?? 'UNKNOWN'} score=${score}`
    );

    const signal: RouterSignal = {
      source:      'webhook',
      action:      action.toUpperCase() as 'BUY' | 'SELL',
      symbol,
      exchange,
      signal_type: signal_type ?? 'UNKNOWN',
      score:       Number(score),
      entry:       body.entry       != null ? Number(body.entry)       : (close != null ? Number(close) : undefined),
      sl:          body.sl          != null ? Number(body.sl)          : undefined,
      t1:          body.t1          != null ? Number(body.t1)          : undefined,
      t2:          body.t2          != null ? Number(body.t2)          : undefined,
      t3:          body.t3          != null ? Number(body.t3)          : undefined,
      timeframe:   body.timeframe   != null ? String(body.timeframe)   : undefined,
      candle_high: candle_high != null ? Number(candle_high) : undefined,
      candle_low:  candle_low  != null ? Number(candle_low)  : undefined,
      close:       close       != null ? Number(close)       : undefined,
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
      // Return 200 to TradingView so it doesn't retry — just silently drop it
      return NextResponse.json({ status: 'ignored', reason: err.message }, { status: 200 });
    }
    console.error('[Webhook] Unexpected error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// TradingView pings the URL to verify it is reachable before saving the alert.
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'SAHAAI webhook receiver' });
}
