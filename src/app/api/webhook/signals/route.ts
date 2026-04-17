/**
 * GET /api/webhook/signals
 * SAHAAI Signal Flow — Step D: Signal Log API
 *
 * Returns recent webhook signals with linked order P&L for the Signal Log page.
 * Ordered by most recent first, limit 100.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const signals = await prisma.webhookSignal.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    // For signals that have an order_id, fetch the linked position PnL
    const orderIds = signals
      .map((s) => s.order_id)
      .filter((id): id is string => id !== null && id !== undefined);

    let pnlMap: Record<string, number | null> = {};

    if (orderIds.length > 0) {
      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, positionId: true },
      });

      const positionIds = orders
        .map((o) => o.positionId)
        .filter((id): id is string => id !== null && id !== undefined);

      let positionPnlMap: Record<string, number> = {};

      if (positionIds.length > 0) {
        const positions = await prisma.position.findMany({
          where: { id: { in: positionIds } },
          select: { id: true, pnl: true, isOpen: true, currentPrice: true, entryPrice: true, quantity: true, side: true },
        });
        positionPnlMap = Object.fromEntries(positions.map((p) => {
          if (p.isOpen && p.currentPrice && p.entryPrice && p.currentPrice !== 0) {
            const multiplier = p.side === 'BUY' ? 1 : -1;
            return [p.id, multiplier * (p.currentPrice - p.entryPrice) * p.quantity];
          }
          return [p.id, p.pnl];
        }));
      }

      pnlMap = Object.fromEntries(
        orders.map((o) => [
          o.id,
          o.positionId != null ? (positionPnlMap[o.positionId] ?? null) : null,
        ])
      );
    }

    const result = signals.map((s) => ({
      id:            s.id,
      created_at:    s.created_at.toISOString(),
      action:        s.action,
      symbol:        s.symbol,
      exchange:      s.exchange,
      signal_type:   s.signal_type,
      score:         s.score,
      source:        s.source,
      candle_high:   s.candle_high,
      candle_low:    s.candle_low,
      close:         s.close,
      entry:         s.entry,
      sl:            s.sl,
      t1:            s.t1,
      t2:            s.t2,
      t3:            s.t3,
      timeframe:     s.timeframe,
      bot_notified:  s.bot_notified,
      order_created: s.order_created,
      order_id:      s.order_id,
      pnl:           s.order_id != null ? (pnlMap[s.order_id] ?? null) : null,
    }));

    return NextResponse.json({ signals: result });
  } catch (error) {
    console.error('[SignalLog] Failed to fetch signals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
