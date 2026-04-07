/**
 * POST /api/webhook/signal
 * SAHAAI Signal Flow — Step A: TradingView Webhook Receiver
 *
 * TradingView Pine Script fires a POST to this URL when an alert triggers.
 * This endpoint:
 *   1. Validates the payload (required: action, symbol, exchange, score)
 *   2. Saves the signal to the WebhookSignal table (audit log)
 *   3. Calls /api/signals/broadcast to notify all active bots
 *   4. Updates bot_notified flag in the DB based on broadcast result
 *   5. Returns { status: 'received', signal_id: '...' }
 *
 * Expected JSON from TradingView:
 * {
 *   "action":      "BUY",
 *   "symbol":      "BANKNIFTY",
 *   "exchange":    "NSE",
 *   "signal_type": "CCC_BULL",
 *   "score":       4,
 *   "candle_high": 48250.0,
 *   "candle_low":  47980.0,
 *   "close":       48100.0,
 *   "timestamp":   "2025-01-20T11:00:00"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse and validate payload ────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON in request body' },
        { status: 400 }
      );
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

    // Required fields check
    if (!action || !symbol || !exchange || score === undefined || score === null) {
      return NextResponse.json(
        {
          message: "Missing required fields. Need: action, symbol, exchange, score",
          received: { action, symbol, exchange, score },
        },
        { status: 400 }
      );
    }

    // action must be BUY or SELL
    if (!['BUY', 'SELL'].includes(action.toUpperCase())) {
      return NextResponse.json(
        { message: "action must be 'BUY' or 'SELL'" },
        { status: 400 }
      );
    }

    // exchange must be NSE or MCX
    if (!['NSE', 'MCX'].includes(exchange.toUpperCase())) {
      return NextResponse.json(
        { message: "exchange must be 'NSE' or 'MCX'" },
        { status: 400 }
      );
    }

    console.log(
      `[Webhook] Signal received: ${action.toUpperCase()} ${symbol} (${exchange}) ` +
      `type=${signal_type ?? 'UNKNOWN'} score=${score}`
    );

    // ── 2. Save to WebhookSignal table (audit log) ────────────────────────────
    const savedSignal = await prisma.webhookSignal.create({
      data: {
        action:      action.toUpperCase(),
        symbol:      symbol.toUpperCase(),
        exchange:    exchange.toUpperCase(),
        signal_type: signal_type ?? 'UNKNOWN',
        score:       Number(score),
        candle_high: candle_high != null ? Number(candle_high) : null,
        candle_low:  candle_low  != null ? Number(candle_low)  : null,
        close:       close       != null ? Number(close)       : null,
        source:      'tradingview',
        bot_notified:  false,
        order_created: false,
      },
    });

    console.log(`[Webhook] Saved signal ID: ${savedSignal.id}`);

    // ── 3. Broadcast signal to all active bots ────────────────────────────────
    // Build the internal broadcast URL using the request host
    const host = req.headers.get('host') ?? 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') ?? 'http';
    const broadcastUrl = `${protocol}://${host}/api/signals/broadcast`;

    let botNotified = false;
    let botsAccepted = 0;

    try {
      const broadcastBody = {
        action:      savedSignal.action,
        symbol:      savedSignal.symbol,
        exchange:    savedSignal.exchange,
        signal_type: savedSignal.signal_type,
        score:       savedSignal.score,
        candle_high: savedSignal.candle_high,
        candle_low:  savedSignal.candle_low,
        close:       savedSignal.close,
        signal_id:   savedSignal.id,   // Bot uses this to reference back when placing order
        timestamp:   savedSignal.created_at.toISOString(),
      };

      const broadcastRes = await fetch(broadcastUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(broadcastBody),
      });

      if (broadcastRes.ok) {
        const broadcastData = await broadcastRes.json() as { accepted?: number; bots_notified?: number };
        botsAccepted = broadcastData.accepted ?? 0;
        // Mark as bot_notified if at least one bot accepted
        botNotified = botsAccepted > 0;
      } else {
        console.warn(`[Webhook] Broadcast returned status ${broadcastRes.status}`);
      }
    } catch (broadcastErr) {
      // Broadcast failure must NOT fail the webhook response
      // TradingView will retry if we return an error, causing duplicate signals
      console.error('[Webhook] Broadcast call failed (bot may be offline):', broadcastErr);
    }

    // ── 4. Update bot_notified flag in DB ────────────────────────────────────
    if (botNotified) {
      await prisma.webhookSignal.update({
        where: { id: savedSignal.id },
        data:  { bot_notified: true },
      });
    }

    console.log(
      `[Webhook] Done. signal_id=${savedSignal.id} ` +
      `bot_notified=${botNotified} bots_accepted=${botsAccepted}`
    );

    // ── 5. Return success ─────────────────────────────────────────────────────
    return NextResponse.json(
      {
        status:        'received',
        signal_id:     savedSignal.id,
        bot_notified:  botNotified,
        bots_accepted: botsAccepted,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// TradingView pings the URL to verify it is reachable before saving the alert.
// Returning 200 on GET prevents "webhook URL unreachable" errors in TradingView.
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'SAHAAI webhook receiver' });
}
