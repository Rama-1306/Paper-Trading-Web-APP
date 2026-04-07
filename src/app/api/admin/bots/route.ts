/**
 * /api/admin/bots
 * SAHAAI Admin — Bot Monitor API (Phase 2C, Step 12)
 *
 * GET  → returns all bot_status rows (admin only)
 * POST → actions: kill | resume | signal
 *
 * kill:   POSTs /kill to the bot → halts all trading immediately
 * resume: POSTs /resume to the bot → re-enables trading
 * signal: broadcasts a manual signal to all active bots via /api/signals/broadcast
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedAdminContext } from '@/lib/account-context';

const BOT_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// GET — fetch all bot statuses
// ---------------------------------------------------------------------------

export async function GET() {
  const admin = await getAuthenticatedAdminContext();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const bots = await prisma.botStatus.findMany({
      orderBy: { last_ping: 'desc' },
    });

    // Enrich each bot with a computed "is_online" flag
    // (last_ping within 5 minutes = online)
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const enriched = bots.map((bot) => ({
      ...bot,
      is_online: bot.last_ping >= cutoff && bot.status !== 'halted',
    }));

    return NextResponse.json({ bots: enriched });
  } catch (error) {
    console.error('GET /api/admin/bots error:', error);
    return NextResponse.json({ error: 'Failed to fetch bot statuses' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — kill, resume, or manual signal
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const admin = await getAuthenticatedAdminContext();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── Kill switch ──────────────────────────────────────────────────────
    if (action === 'kill') {
      const { user_id } = body;
      if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

      const bot = await prisma.botStatus.findUnique({ where: { user_id } });
      if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });

      // Tell the bot to stop
      let botResponse = 'no bot_url set';
      if (bot.bot_url) {
        try {
          const res = await fetch(`${bot.bot_url.replace(/\/$/, '')}/kill`, {
            method: 'POST',
            signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
          });
          botResponse = res.ok ? 'ok' : `http ${res.status}`;
        } catch (e: unknown) {
          botResponse = e instanceof Error ? e.message : 'unreachable';
        }
      }

      // Mark as halted in DB regardless of whether the bot responded
      await prisma.botStatus.update({
        where: { user_id },
        data: { status: 'halted' },
      });

      console.log(`Admin kill: ${user_id} | bot response: ${botResponse}`);
      return NextResponse.json({ message: `Kill switch activated for ${user_id}`, bot_response: botResponse });
    }

    // ── Resume ───────────────────────────────────────────────────────────
    if (action === 'resume') {
      const { user_id } = body;
      if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

      const bot = await prisma.botStatus.findUnique({ where: { user_id } });
      if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });

      let botResponse = 'no bot_url set';
      if (bot.bot_url) {
        try {
          const res = await fetch(`${bot.bot_url.replace(/\/$/, '')}/resume`, {
            method: 'POST',
            signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
          });
          botResponse = res.ok ? 'ok' : `http ${res.status}`;
        } catch (e: unknown) {
          botResponse = e instanceof Error ? e.message : 'unreachable';
        }
      }

      await prisma.botStatus.update({
        where: { user_id },
        data: { status: 'online' },
      });

      console.log(`Admin resume: ${user_id} | bot response: ${botResponse}`);
      return NextResponse.json({ message: `Trading resumed for ${user_id}`, bot_response: botResponse });
    }

    // ── Manual signal broadcast ───────────────────────────────────────────
    if (action === 'signal') {
      const { signal } = body;
      if (!signal?.action || !signal?.symbol) {
        return NextResponse.json(
          { error: "Signal must include 'action' and 'symbol'" },
          { status: 400 }
        );
      }

      // Re-use the broadcast endpoint internally
      const broadcastRes = await fetch(
        new URL('/api/signals/broadcast', req.url).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signal),
        }
      );
      const broadcastData = await broadcastRes.json();

      console.log(`Admin manual signal: ${signal.action} ${signal.symbol} | result:`, broadcastData);
      return NextResponse.json({ message: 'Manual signal broadcast complete', ...broadcastData });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('POST /api/admin/bots error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
