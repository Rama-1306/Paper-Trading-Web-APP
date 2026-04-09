/**
 * PATCH /api/paper-orders/bot/[id]
 * SAHAAI Signal Flow — Step C: Bot Exit Update Receiver
 *
 * Called by the algo bot when a position exits (SL hit, T1/T2/T3 hit, or EOD).
 * This endpoint:
 *   1. Authenticates via Authorization: Bearer {BOT_SECRET} header
 *   2. Finds the Order by ID
 *   3. Updates the Order status (SL_HIT, T1_HIT, etc.)
 *   4. Finds the linked Position and closes it (sets isOpen=false, records PnL)
 *   5. Creates a Trade record so it appears in trade history
 *   6. Updates account realizedPnl and releases margin
 *   7. Returns { status: 'updated', order_id: '...' }
 *
 * Expected JSON from bot:
 * {
 *   "status":     "SL_HIT",       // SL_HIT | T1_HIT | T2_HIT | T3_HIT | EOD_EXIT | CLOSED
 *   "exit_price": 47980.0,
 *   "pnl":        -3600.0,
 *   "exit_time":  "2025-01-20T11:00:00+05:30"
 * }
 *
 * Auth: set BOT_SECRET env variable in Railway. Bot sends it as:
 *   Authorization: Bearer <BOT_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function authenticateBot(req: NextRequest): boolean {
  const secret = process.env.BOT_SECRET;
  if (!secret) {
    console.warn('[BotExit] BOT_SECRET env variable is not set — authentication skipped');
    return true;
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return token === secret;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────────────────
    if (!authenticateBot(req)) {
      return err('Unauthorized — invalid or missing BOT_SECRET', 401);
    }

    const { id: orderId } = await params;
    if (!orderId) return err('Order ID is required in the URL');

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return err('Invalid JSON in request body');
    }

    const { status, exit_price, pnl, exit_time } = body as {
      status?:     string;
      exit_price?: number;
      pnl?:        number;
      exit_time?:  string;
    };

    if (!status)                  return err('status is required');
    if (exit_price === undefined) return err('exit_price is required');
    if (pnl === undefined)        return err('pnl is required');

    const validStatuses = ['SL_HIT', 'T1_HIT', 'T2_HIT', 'T3_HIT', 'EOD_EXIT', 'CLOSED', 'NET_OFF'];
    if (!validStatuses.includes(status)) {
      return err(`status must be one of: ${validStatuses.join(', ')}`);
    }

    // ── 3. Find the order ─────────────────────────────────────────────────────
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return err(`Order ${orderId} not found`, 404);

    // ── 4. Update the Order status ────────────────────────────────────────────
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status:      status,
        filledPrice: exit_price,
        filledAt:    exit_time ? new Date(exit_time) : new Date(),
      },
    });

    // ── 5. Close the linked Position ──────────────────────────────────────────
    let closedPosition = null;

    if (order.positionId) {
      const position = await prisma.position.findUnique({ where: { id: order.positionId } });

      if (position && position.isOpen) {
        const exitedQty  = order.quantity;
        // Cap exit at remaining qty so we never go negative.
        const cappedExit = Math.min(exitedQty, position.quantity);
        const remaining  = position.quantity - cappedExit;
        // Promote to a full exit if the status says so OR if there's nothing
        // left after this exit. Without the qty check, a T1_HIT that drains
        // the last contract leaves the row at quantity=0, isOpen=true — the
        // orphan-position bug.
        const isFullExit = remaining <= 0
          || ['SL_HIT', 'T3_HIT', 'EOD_EXIT', 'CLOSED', 'NET_OFF'].includes(status);

        closedPosition = await prisma.position.update({
          where: { id: position.id },
          data: {
            isOpen:       isFullExit ? false : true,
            currentPrice: exit_price,
            pnl:          { increment: Number(pnl) },
            exitReason:   isFullExit ? status : undefined,
            closedAt:     isFullExit ? (exit_time ? new Date(exit_time) : new Date()) : undefined,
            quantity:     isFullExit ? 0 : remaining,
            // Clear all exit-trigger fields on a full exit so the WS server's
            // SL/target sweeper can never refire on a closed position.
            ...(isFullExit ? {
              stopLoss:    null,
              targetPrice: null,
              target2:     null,
              target3:     null,
              targetQty:   null,
              trailingSL:  false,
            } : {}),
          },
        });

        // On a full exit, cancel any remaining pending exit orders for this
        // position so an orphaned SL-M / LIMIT can never fire later.
        if (isFullExit) {
          await prisma.order.updateMany({
            where: {
              accountId:  order.accountId,
              positionId: position.id,
              status:     'PENDING',
              id:         { not: order.id },
            },
            data: { status: 'CANCELLED', rejectedReason: `Position closed via ${status}` },
          });
        }

        // ── 6. Create Trade record ────────────────────────────────────────────
        await prisma.trade.create({
          data: {
            accountId:   order.accountId,
            symbol:      order.symbol,
            displayName: order.displayName,
            side:        order.side,
            quantity:    cappedExit,
            entryPrice:  position.entryPrice,
            exitPrice:   exit_price,
            pnl:         Number(pnl),
            exitReason:  status,
            entryTime:   position.createdAt,
            exitTime:    exit_time ? new Date(exit_time) : new Date(),
          },
        });

        // ── 7. Update account balance and margin ──────────────────────────────
        const marginReleased = isFullExit
          ? position.marginUsed
          : (position.marginUsed / position.quantity) * cappedExit;

        await prisma.account.update({
          where: { id: order.accountId },
          data: {
            balance:     { increment: Number(pnl) },
            realizedPnl: { increment: Number(pnl) },
            usedMargin:  { decrement: Math.max(0, marginReleased) },
          },
        });

        if (isFullExit) {
          await prisma.position.update({
            where: { id: position.id },
            data:  { marginUsed: 0 },
          });
        }
      }
    }

    console.log(`[BotExit] ${status} | order=${orderId} | exit_price=${exit_price} | pnl=${pnl}`);

    return NextResponse.json(
      {
        status:          'updated',
        order_id:        orderId,
        exit_status:     status,
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
