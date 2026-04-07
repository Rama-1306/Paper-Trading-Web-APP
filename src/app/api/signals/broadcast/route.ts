/**
 * POST /api/signals/broadcast
 * SAHAAI Algo Bot — Signal Broadcaster (Phase 2B, Step 11)
 *
 * Called by SAHAAI's signal-generation logic whenever a new trade signal fires.
 *
 * What happens:
 *   1. Receives the signal JSON
 *   2. Finds all bots in bot_status that pinged within the last 5 minutes (ONLINE)
 *   3. POSTs the signal to each bot's /signal endpoint simultaneously
 *   4. Returns a summary showing which bots received the signal
 *
 * Each bot then validates the signal against its own local risk rules
 * and places its own order. SAHAAI never touches user funds directly.
 *
 * Signal JSON format:
 * {
 *   "action":       "BUY",
 *   "symbol":       "BANKNIFTY25JAN48000CE",
 *   "signal_type":  "CCC_BULL",
 *   "score":        4,
 *   "timestamp":    "2025-01-20T11:00:00",
 *   "trigger_high": 210.0,   (optional — for candle SL)
 *   "trigger_low":  190.0,   (optional — for candle SL)
 *   "swing_high":   215.0,   (optional — for swing SL)
 *   "swing_low":    185.0    (optional — for swing SL)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Bots that haven't pinged in 5 minutes are treated as offline
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

// Max wait time for each bot to respond
const BOT_TIMEOUT_MS = 10_000;

type BotResult = {
  user_id:     string;
  bot_url:     string;
  http_status?: number;
  response?:   unknown;
  error?:      string;
};

export async function POST(req: NextRequest) {
  try {
    const signal = await req.json();

    if (!signal?.action || !signal?.symbol) {
      return NextResponse.json(
        { message: "Invalid signal: 'action' and 'symbol' are required" },
        { status: 400 }
      );
    }

    // Only bots that are online (last_ping within 5 min) and have a public URL
    const cutoffTime = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const activeBots = await prisma.botStatus.findMany({
      where: {
        status:   { not: 'halted' },
        last_ping: { gte: cutoffTime },
        bot_url:  { not: '' },
      },
      select: { user_id: true, bot_url: true, mode: true },
    });

    if (activeBots.length === 0) {
      console.log('Signal broadcast: no active bots found');
      return NextResponse.json({
        message:       'Signal received — no active bots to notify',
        bots_notified: 0,
        results:       [],
      });
    }

    console.log(
      `Broadcasting to ${activeBots.length} bot(s): ` +
      `${signal.action} ${signal.symbol} score=${signal.score}`
    );

    // POST to every active bot in parallel
    const settled = await Promise.allSettled(
      activeBots.map(async (bot): Promise<BotResult> => {
        const endpoint = `${bot.bot_url.replace(/\/$/, '')}/signal`;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS);

          const response = await fetch(endpoint, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(signal),
            signal:  controller.signal,
          });

          clearTimeout(timer);

          let responseBody: unknown = null;
          try { responseBody = await response.json(); } catch { /* ignore */ }

          return {
            user_id:     bot.user_id,
            bot_url:     endpoint,
            http_status: response.status,
            response:    responseBody,
          };
        } catch (err: unknown) {
          return {
            user_id: bot.user_id,
            bot_url: endpoint,
            error:   err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    const results: BotResult[] = settled.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { user_id: 'unknown', bot_url: '', error: String(r.reason) }
    );

    const accepted = results.filter((r) => !r.error && r.http_status === 200).length;
    const failed   = results.length - accepted;

    console.log(`Broadcast done: ${accepted} accepted, ${failed} failed`);

    return NextResponse.json({
      message:       'Signal broadcast complete',
      bots_notified: activeBots.length,
      accepted,
      failed,
      results,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
