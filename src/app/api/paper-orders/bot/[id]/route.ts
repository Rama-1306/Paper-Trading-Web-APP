/**
 * PATCH /api/paper-orders/bot/[id]
 * SAHAAI Signal Flow — Step C: Bot Exit Update Receiver
 *
 * Called by the algo bot when a position exits (SL hit, T1/T2/T3 hit, or EOD).
 * This endpoint:
 *   1. Finds the Order by ID
 *   2. Updates the Order status (SL_HIT, T1_HIT, etc.)
 *   3. Finds the linked Position and closes it (sets isOpen=false, records PnL)
 *   4. Creates a Trade record so it appears in trade history
 *   5. Updates account realizedPnl and releases margin
 *   6. Returns { status: 'updated', order_id: '...' }
 *
 * Expected JSON from bot:
 * {
 *   "status":     "SL_HIT",       // SL_HIT | T1_HIT | T2_HIT | T3_HIT | EOD_EXIT | CLOSED
 *   "exit_price": 47980.0,
 *   "pnl":        -3600.0,
 *   "exit_time":  "2025-01-20T11:00:00+05:30"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    if (!orderId) {
      return err('Order ID is required in the URL');
    }

    // ── 1. Parse body ─────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return err('Invalid JSON in request body');
    }

    const { status, exit_price, pnl, exit_time } = body as {
      status?:      string;
      exit_price?:  number;
      pnl?:         number;
      exit_time?:   string;
    };

    if (!status)                        return err('status is required');
    if (exit_price === undefined)       return err('exit_price is required');
    if (pnl === undefined)              return err('pnl is required');

    const validStatuses = ['SL_HIT', 'T1_HIT', 'T2_HIT', 'T3_HIT', 'EOD_EXIT', 'CLOSED', 'NET_OFF'];
    if (!validStatuses.includes(status)) {
      return err(`status must be one of: ${validStatuses.join(', ')}`);
    }

    // ── 2. Find the order ─────────────────────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return err(`Order ${orderId} not found`, 404);
    }

    // ── 3. Update the Order status ────────────────────────────────────────────
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status:      status,
        filledPrice: exit_price,
        filledAt:    exit_time ? new Date(exit_time) : new Date(),
      },
    });

    // ── 4. Close the linked Position ──────────────────────────────────────────
    let closedPosition = null;

    if (order.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: order.positionId },
      });

      if (position && position.isOpen) {
        const exitedQty = order.quantity;

        // Partial exits (T1/T2): if remaining qty > 0, keep position open
        const isFullExit = ['SL_HIT', 'T3_HIT', 'EOD_EXIT', 'CLOSED', 'NET_OFF'].includes(status);

        closedPosition = await prisma.position.update({
          where: { id: position.id },
          data: {
            isOpen:       isFullExit ? false : true,
            currentPrice: exit_price,
            pnl:          { increment: Number(pnl) },
            exitReason:   isFullExit ? status : undefined,
            closedAt:     isFullExit ? (exit_time ? new Date(exit_time) : new Date()) : undefined,
            // Reduce quantity for partial exits
            quantity:     isFullExit ? position.quantity : Math.max(0, position.quantity - exitedQty),
          },
        });

        // ── 5. Create a Trade record (shows in trade history) ─────────────────
        await prisma.trade.create({
          data: {
            accountId:   order.accountId,
            symbol:      order.symbol,
            displayName: order.displayName,
            side:        order.side,
            quantity:    exitedQty,
            entryPrice:  position.entryPrice,
            exitPrice:   exit_price,
            pnl:         Number(pnl),
            exitReason:  status,
            entryTime:   position.createdAt,
            exitTime:    exit_time ? new Date(exit_time) : new Date(),
          },
        });

        // ── 6. Update account balance and margin ──────────────────────────────
        const marginReleased = isFullExit
          ? position.marginUsed
          : (position.marginUsed / position.quantity) * exitedQty;

        await prisma.account.update({
          where: { id: order.accountId },
          data: {
            balance:     { increment: Number(pnl) },
            realizedPnl: { increment: Number(pnl) },
            usedMargin:  { decrement: Math.max(0, marginReleased) },
          },
        });

        if (isFullExit) {
          // Release all margin on full close
          await prisma.position.update({
            where: { id: position.id },
            data:  { marginUsed: 0 },
          });
        }
      }
    }

    console.log(
      `[BotExit] ${status} | order=${orderId} | ` +
      `exit_price=${exit_price} | pnl=${pnl}`
    );

    return NextResponse.json(
      {
        status:     'updated',
        order_id:   orderId,
        exit_status: status,
        position_closed: closedPosition ? !closedPosition.isOpen : false,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[BotExit] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'SAHAAI bot order exit updater' });
}
