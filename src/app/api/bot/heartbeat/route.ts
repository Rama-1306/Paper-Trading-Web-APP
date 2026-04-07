/**
 * POST /api/bot/heartbeat
 * SAHAAI Algo Bot — Heartbeat Receiver (Phase 2B, Step 10)
 *
 * Each user's Python bot POSTs here every 60 seconds to report it is alive.
 * This endpoint upserts a row in bot_status — one row per bot (keyed by user_id).
 *
 * The admin dashboard reads bot_status to show who is online.
 * The signal broadcaster reads bot_status to know where to send trade signals.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      user_id,
      bot_url = '',
      status,
      mode,
      uptime_minutes,
      daily_trades,
      daily_pnl,
      open_positions,
      last_trade_time,
      timestamp,
    } = body;

    if (!user_id) {
      return NextResponse.json(
        { message: 'user_id is required' },
        { status: 400 }
      );
    }

    const lastPing    = timestamp       ? new Date(timestamp)       : new Date();
    const lastTradeAt = last_trade_time ? new Date(last_trade_time) : null;

    await prisma.botStatus.upsert({
      where: { user_id },
      create: {
        user_id,
        bot_url,
        status:         status         ?? 'online',
        mode:           mode           ?? 'paper',
        uptime_minutes: uptime_minutes ?? 0,
        daily_trades:   daily_trades   ?? 0,
        daily_pnl:      daily_pnl      ?? 0.0,
        open_positions: open_positions ?? 0,
        last_trade_time: lastTradeAt,
        last_ping:       lastPing,
      },
      update: {
        bot_url,
        status:         status         ?? 'online',
        mode:           mode           ?? 'paper',
        uptime_minutes: uptime_minutes ?? 0,
        daily_trades:   daily_trades   ?? 0,
        daily_pnl:      daily_pnl      ?? 0.0,
        open_positions: open_positions ?? 0,
        last_trade_time: lastTradeAt,
        last_ping:       lastPing,
      },
    });

    return NextResponse.json({ message: 'Heartbeat received', status: 'ok' });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
