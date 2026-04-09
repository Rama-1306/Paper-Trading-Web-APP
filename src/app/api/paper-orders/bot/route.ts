/**
 * POST /api/paper-orders/bot
 * SAHAAI Signal Flow — Step B: Bot Paper Order Receiver
 *
 * Called by the algo bot after it decides to act on a broadcast signal.
 * This endpoint:
 *   1. Authenticates via Authorization: Bearer {BOT_SECRET} header
 *   2. Validates the order payload
 *   3. Creates a paper Order record (FILLED for MARKET, PENDING for LIMIT)
 *   4. For MARKET orders: nets off opposite-side / averages same-side / opens fresh
 *   5. Creates pending exit orders (one LIMIT per t1/t2/t3 + one SL-M for sl)
 *      so multi-target exits and SL fire correctly. Targets are NOT stored on
 *      the Position row (see commit 9aafde9).
 *   6. Marks the originating WebhookSignal as order_created = true
 *   7. Returns the created order + position IDs
 *
 * Expected JSON from the bot:
 * {
 *   "bot_id":       "SAHAAI-XXXX",        // label only — not checked against DB
 *   "account_id":   "clxxx...",           // paper trading account to debit
 *   "signal_id":    "cmnougqs7...",       // optional — WebhookSignal.id
 *   "symbol":       "BANKNIFTY25APR48000CE",
 *   "display_name": "BANKNIFTY 48000 CE", // optional
 *   "side":         "BUY",               // BUY | SELL
 *   "order_type":   "MARKET",            // MARKET | LIMIT
 *   "quantity":     30,
 *   "price":        48100.0,             // fill price for MARKET; required for LIMIT
 *   "sl":           47980.0,             // optional stop-loss
 *   "t1":           48261.0,             // optional target 1
 *   "t2":           48340.0,             // optional target 2
 *   "t3":           48430.0,             // optional target 3
 *   "t1_qty":       10,                  // optional — defaults to even split of `quantity`
 *   "t2_qty":       10,                  // optional
 *   "t3_qty":       10                   // optional
 * }
 *
 * Behaviour rules:
 * - Opposite-side existing position: net off only up to that position's qty.
 *   If `quantity` exceeds it, the order is REJECTED — we never silently flip
 *   sides into a reverse position.
 * - Same-side existing position: average into it (combined qty, weighted-avg
 *   entry price). Any pending SL-M exit order on the existing position has its
 *   quantity bumped to the new combined total so the full position stays
 *   protected. Existing LIMIT target orders are left alone — the bot operator
 *   should re-set targets via /api/positions PUT if they want to change them.
 *   The bot's sl/t1/t2/t3 fields are IGNORED when averaging into an existing
 *   position (other than auto-resizing the SL-M qty above).
 * - Fresh position: create the position, then create one pending LIMIT order
 *   per target level and one SL-M order for the SL.
 *
 * Auth: set BOT_SECRET env variable in Railway. Bot sends it as:
 *   Authorization: Bearer <BOT_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getQuickMargin } from '@/lib/utils/margins';

// ── helpers ───────────────────────────────────────────────────────────────────

function instrumentType(symbol: string): string {
  if (symbol.includes('CE')) return 'CE';
  if (symbol.includes('PE')) return 'PE';
  return 'FUTURES';
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function authenticateBot(req: NextRequest): boolean {
  const secret = process.env.BOT_SECRET;
  if (!secret) {
    // If BOT_SECRET is not set, log a warning and allow through (dev fallback)
    console.warn('[BotOrder] BOT_SECRET env variable is not set — authentication skipped');
    return true;
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return token === secret;
}

/**
 * Split a total quantity across the provided target levels.
 * If a level supplies its own qty (>=1), use that. Otherwise distribute the
 * remainder evenly among the unspecified levels, putting any rounding remainder
 * on the LAST unspecified level.
 *
 * Returns the resolved qty array aligned with the input prices.
 * Returns null if any explicit qty is invalid OR the sum exceeds totalQty.
 */
function resolveTargetQtys(
  totalQty: number,
  levels: Array<{ price: number; qty?: number | null }>
): number[] | null {
  const explicit = levels.map((l) => (l.qty !== undefined && l.qty !== null ? Math.floor(Number(l.qty)) : null));
  for (const q of explicit) {
    if (q !== null && (!Number.isFinite(q) || q < 1)) return null;
  }
  const explicitSum = explicit.reduce<number>((s, q) => s + (q ?? 0), 0);
  if (explicitSum > totalQty) return null;

  const remaining = totalQty - explicitSum;
  const unspecifiedCount = explicit.filter((q) => q === null).length;

  if (unspecifiedCount === 0) {
    // All explicit. May still be < totalQty (the SL still protects the rest).
    return explicit.map((q) => q as number);
  }

  const base = Math.floor(remaining / unspecifiedCount);
  const leftover = remaining - base * unspecifiedCount;

  // Distribute base to each unspecified, push leftover onto the last unspecified.
  let unspecifiedIdx = 0;
  return explicit.map((q, i) => {
    if (q !== null) return q;
    unspecifiedIdx += 1;
    const isLastUnspecified = unspecifiedIdx === unspecifiedCount;
    const assigned = base + (isLastUnspecified ? leftover : 0);
    void i;
    return assigned;
  });
}

/** Validate that a target price is on the profitable side of the entry. */
function targetSideError(side: string, entry: number, price: number, label: string): string | null {
  if (!Number.isFinite(price) || price <= 0) return `${label} must be greater than 0`;
  if (side === 'BUY' && price <= entry) return `${label} must be above entry price for BUY positions`;
  if (side === 'SELL' && price >= entry) return `${label} must be below entry price for SELL positions`;
  return null;
}

/** Validate that an SL price is on the loss side of the entry. */
function slSideError(side: string, entry: number, sl: number): string | null {
  if (!Number.isFinite(sl) || sl <= 0) return 'sl must be greater than 0';
  if (side === 'BUY' && sl >= entry) return 'sl must be below entry price for BUY positions';
  if (side === 'SELL' && sl <= entry) return 'sl must be above entry price for SELL positions';
  return null;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────────────────
    if (!authenticateBot(req)) {
      return err('Unauthorized — invalid or missing BOT_SECRET', 401);
    }

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return err('Invalid JSON in request body');
    }

    const {
      bot_id,
      account_id,
      signal_id,
      symbol,
      display_name,
      side,
      order_type,
      quantity,
      price,
      sl,
      t1,
      t2,
      t3,
      t1_qty,
      t2_qty,
      t3_qty,
    } = body as {
      bot_id?: string;
      account_id?: string;
      signal_id?: string;
      symbol?: string;
      display_name?: string;
      side?: string;
      order_type?: string;
      quantity?: number;
      price?: number;
      sl?: number;
      t1?: number;
      t2?: number;
      t3?: number;
      t1_qty?: number;
      t2_qty?: number;
      t3_qty?: number;
    };

    // ── 3. Validate required fields ───────────────────────────────────────────
    if (!account_id) return err('account_id is required');
    if (!symbol)     return err('symbol is required');
    if (!side)       return err('side is required (BUY | SELL)');
    if (!order_type) return err('order_type is required (MARKET | LIMIT)');
    if (!quantity || quantity < 1) return err('quantity must be >= 1');

    const sideUpper = side.toUpperCase();
    const typeUpper = order_type.toUpperCase();

    if (!['BUY', 'SELL'].includes(sideUpper))    return err("side must be 'BUY' or 'SELL'");
    if (!['MARKET', 'LIMIT'].includes(typeUpper)) return err("order_type must be 'MARKET' or 'LIMIT'");
    if (typeUpper === 'LIMIT' && !price)          return err('price is required for LIMIT orders');

    // ── 4. Resolve account (outside tx — read-only) ──────────────────────────
    const account = await prisma.account.findUnique({
      where: { id: account_id },
    });

    if (!account) return err(`account_id '${account_id}' not found`, 404);

    const fillPrice   = price ?? 0;
    const sideNum     = sideUpper === 'BUY' ? 1 : -1;
    const instType    = instrumentType(symbol);
    const isOption    = instType === 'CE' || instType === 'PE';
    const premium     = isOption ? fillPrice * quantity : 0;
    const displayName = display_name || symbol;
    const exitSide    = sideUpper === 'BUY' ? 'SELL' : 'BUY';
    const isMarket    = typeUpper === 'MARKET';

    console.log(
      `[BotOrder] ${sideUpper} ${quantity} ${symbol} @ ${fillPrice} | bot=${bot_id ?? 'unknown'}`
    );

    // ── 5. LIMIT branch (no position changes — order sits PENDING) ───────────
    if (!isMarket) {
      const order = await prisma.order.create({
        data: {
          accountId:   account.id,
          symbol,
          displayName,
          side:        sideUpper,
          orderType:   'LIMIT',
          quantity,
          price:       price ?? null,
          status:      'PENDING',
          intent:      'OPEN',
        },
      });

      if (sl != null || t1 != null || t2 != null || t3 != null) {
        console.warn(
          `[BotOrder] LIMIT order ${order.id} ignored sl/t1/t2/t3 — set them after fill via /api/positions PUT`
        );
      }

      if (signal_id) {
        try {
          await prisma.webhookSignal.update({
            where: { id: signal_id },
            data:  { order_created: true, order_id: order.id },
          });
        } catch {
          console.warn(`[BotOrder] Could not update signal ${signal_id}`);
        }
      }

      return NextResponse.json(
        { status: 'created', order_id: order.id, position_id: null, order_status: order.status },
        { status: 201 }
      );
    }

    // ── 6. MARKET branch — everything atomic in a single transaction ─────────
    type TxResult =
      | { kind: 'rejected'; orderId: string; reason: string; httpStatus: number }
      | { kind: 'netted_partial'; orderId: string; positionId: string }
      | { kind: 'netted_full';    orderId: string; positionId: string }
      | { kind: 'averaged';       orderId: string; positionId: string }
      | { kind: 'opened';         orderId: string; positionId: string };

    const result: TxResult = await prisma.$transaction(async (tx) => {
      // Create the main MARKET order up front so we always have an id to attach.
      const order = await tx.order.create({
        data: {
          accountId:   account.id,
          symbol,
          displayName,
          side:        sideUpper,
          orderType:   'MARKET',
          quantity,
          price:       price ?? null,
          status:      'FILLED',
          filledPrice: fillPrice,
          filledAt:    new Date(),
          intent:      'OPEN', // may flip to CLOSE below
        },
      });

      const reject = async (reason: string, httpStatus: number): Promise<TxResult> => {
        await tx.order.update({
          where: { id: order.id },
          data:  { status: 'REJECTED', rejectedReason: reason, filledPrice: null, filledAt: null },
        });
        return { kind: 'rejected', orderId: order.id, reason, httpStatus };
      };

      // ── (a) Opposite-side: net off, NEVER reverse ────────────────────────
      const oppPosition = await tx.position.findFirst({
        where: { accountId: account.id, symbol, side: exitSide, isOpen: true },
        orderBy: { createdAt: 'asc' },
      });

      if (oppPosition) {
        if (quantity > oppPosition.quantity) {
          return reject(
            `Exit qty (${quantity}) exceeds opposite ${exitSide} position qty (${oppPosition.quantity}) for ${symbol}. Reverse positions are not allowed — split into two orders.`,
            400
          );
        }

        const pnlPerUnit = sideUpper === 'BUY'
          ? oppPosition.entryPrice - fillPrice
          : fillPrice - oppPosition.entryPrice;
        const netQty         = quantity;
        const pnl            = pnlPerUnit * netQty;
        const mPerUnit       = oppPosition.marginUsed > 0 ? oppPosition.marginUsed / oppPosition.quantity : 0;
        const marginReleased = mPerUnit * netQty;
        const fullyClosed    = netQty >= oppPosition.quantity;

        if (fullyClosed) {
          await tx.position.update({
            where: { id: oppPosition.id },
            data: {
              isOpen:       false,
              currentPrice: fillPrice,
              pnl,
              marginUsed:   0,
              exitReason:   'NET_OFF',
              closedAt:     new Date(),
            },
          });
          // Cancel any other pending exit orders tied to this position
          await tx.order.updateMany({
            where: {
              accountId:  account.id,
              positionId: oppPosition.id,
              status:     'PENDING',
              id:         { not: order.id },
            },
            data: { status: 'CANCELLED', rejectedReason: 'Position fully closed by net-off' },
          });
        } else {
          await tx.position.update({
            where: { id: oppPosition.id },
            data: {
              quantity:     oppPosition.quantity - netQty,
              currentPrice: fillPrice,
              marginUsed:   Math.max(0, oppPosition.marginUsed - marginReleased),
            },
          });
        }

        await tx.trade.create({
          data: {
            accountId:  account.id,
            symbol,
            displayName,
            side:       exitSide,
            quantity:   netQty,
            entryPrice: oppPosition.entryPrice,
            exitPrice:  fillPrice,
            pnl,
            exitReason: 'NET_OFF',
            entryTime:  oppPosition.createdAt,
          },
        });

        const isOpt = oppPosition.instrumentType === 'CE' || oppPosition.instrumentType === 'PE';
        const balanceAdjust = isOpt
          ? (oppPosition.side === 'BUY' ? fillPrice * netQty : -(fillPrice * netQty))
          : pnl;

        await tx.account.update({
          where: { id: account.id },
          data: {
            balance:     { increment: balanceAdjust },
            realizedPnl: { increment: pnl },
            usedMargin:  { decrement: Math.max(0, marginReleased) },
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data:  { intent: 'CLOSE', positionId: oppPosition.id },
        });

        return {
          kind: fullyClosed ? 'netted_full' : 'netted_partial',
          orderId: order.id,
          positionId: oppPosition.id,
        };
      }

      // ── (b) Same-side: average into existing ─────────────────────────────
      const samePosition = await tx.position.findFirst({
        where: { accountId: account.id, symbol, side: sideUpper, isOpen: true },
      });

      if (samePosition) {
        const additionalMargin = getQuickMargin(symbol, quantity, sideNum);
        const totalCost        = additionalMargin + (isOption && sideUpper === 'BUY' ? premium : 0);
        const available        = account.balance - account.usedMargin;
        if (totalCost > available) {
          return reject(
            `Insufficient funds to average. Required: ₹${Math.round(totalCost).toLocaleString('en-IN')}, Available: ₹${Math.round(available).toLocaleString('en-IN')}`,
            402
          );
        }

        const oldQty   = samePosition.quantity;
        const oldPrice = samePosition.entryPrice;
        const newQty   = oldQty + quantity;
        const avgPrice = (oldPrice * oldQty + fillPrice * quantity) / newQty;

        await tx.position.update({
          where: { id: samePosition.id },
          data: {
            quantity:     newQty,
            entryPrice:   avgPrice,
            currentPrice: fillPrice,
            marginUsed:   (samePosition.marginUsed || 0) + additionalMargin,
          },
        });

        // Resize any existing SL-M order for this position to protect the new
        // combined qty. LIMIT target orders keep their original per-target qty.
        await tx.order.updateMany({
          where: {
            accountId:  account.id,
            positionId: samePosition.id,
            status:     'PENDING',
            orderType:  'SL-M',
            side:       exitSide,
          },
          data: { quantity: newQty },
        });

        const balanceChange = isOption ? (sideUpper === 'BUY' ? -premium : premium) : 0;
        await tx.account.update({
          where: { id: account.id },
          data: {
            usedMargin: { increment: additionalMargin },
            ...(balanceChange !== 0 ? { balance: { increment: balanceChange } } : {}),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data:  { positionId: samePosition.id },
        });

        if (sl != null || t1 != null || t2 != null || t3 != null) {
          console.warn(
            `[BotOrder] Averaged into ${samePosition.id} — IGNORED bot's sl/t1/t2/t3. ` +
            `SL-M order qty was bumped to ${newQty}; LIMIT targets unchanged. ` +
            `Update targets via /api/positions PUT if needed.`
          );
        }

        return { kind: 'averaged', orderId: order.id, positionId: samePosition.id };
      }

      // ── (c) Fresh position ───────────────────────────────────────────────
      const marginRequired = getQuickMargin(symbol, quantity, sideNum);
      const totalCost      = marginRequired + (isOption && sideUpper === 'BUY' ? premium : 0);
      const available      = account.balance - account.usedMargin;
      if (totalCost > available) {
        return reject(
          `Insufficient funds. Required: ₹${Math.round(totalCost).toLocaleString('en-IN')}, Available: ₹${Math.round(available).toLocaleString('en-IN')}`,
          402
        );
      }

      // Validate exit-level prices BEFORE creating the position
      if (sl != null) {
        const e = slSideError(sideUpper, fillPrice, Number(sl));
        if (e) return reject(e, 400);
      }
      const targetLevels: Array<{ price: number; qty?: number | null; label: string }> = [];
      if (t1 != null) targetLevels.push({ price: Number(t1), qty: t1_qty, label: 't1' });
      if (t2 != null) targetLevels.push({ price: Number(t2), qty: t2_qty, label: 't2' });
      if (t3 != null) targetLevels.push({ price: Number(t3), qty: t3_qty, label: 't3' });

      for (const t of targetLevels) {
        const e = targetSideError(sideUpper, fillPrice, t.price, t.label);
        if (e) return reject(e, 400);
      }

      let resolvedQtys: number[] = [];
      if (targetLevels.length > 0) {
        const r = resolveTargetQtys(quantity, targetLevels);
        if (!r) {
          return reject(
            `Target qty allocation invalid — t1_qty/t2_qty/t3_qty must each be >= 1 and sum to <= ${quantity}`,
            400
          );
        }
        resolvedQtys = r;
      }

      const position = await tx.position.create({
        data: {
          accountId:      account.id,
          symbol,
          displayName,
          instrumentType: instType,
          side:           sideUpper,
          quantity,
          entryPrice:     fillPrice,
          currentPrice:   fillPrice,
          marginUsed:     marginRequired,
          // IMPORTANT: targets are NOT stored on the Position. They live as
          // pending LIMIT orders below. See commit 9aafde9.
        },
      });

      const balanceChange = isOption ? (sideUpper === 'BUY' ? -premium : premium) : 0;
      await tx.account.update({
        where: { id: account.id },
        data: {
          usedMargin: { increment: marginRequired },
          ...(balanceChange !== 0 ? { balance: { increment: balanceChange } } : {}),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data:  { positionId: position.id },
      });

      // Create one LIMIT exit order per target level
      for (let i = 0; i < targetLevels.length; i++) {
        const lvl = targetLevels[i];
        const qty = resolvedQtys[i];
        if (qty < 1) continue;
        await tx.order.create({
          data: {
            accountId:   account.id,
            positionId:  position.id,
            symbol,
            displayName,
            side:        exitSide,
            orderType:   'LIMIT',
            quantity:    qty,
            price:       lvl.price,
            triggerPrice: null,
            status:      'PENDING',
            intent:      'CLOSE',
          },
        });
      }

      // Create one SL-M order protecting the full position qty
      if (sl != null) {
        await tx.order.create({
          data: {
            accountId:    account.id,
            positionId:   position.id,
            symbol,
            displayName,
            side:         exitSide,
            orderType:    'SL-M',
            quantity,
            price:        null,
            triggerPrice: Number(sl),
            status:       'PENDING',
            intent:       'CLOSE',
          },
        });
      }

      console.log(
        `[BotOrder] Position opened: ${position.id} | ` +
        `SL=${sl ?? '-'} T1=${t1 ?? '-'} T2=${t2 ?? '-'} T3=${t3 ?? '-'} | ` +
        `targetQtys=[${resolvedQtys.join(',')}]`
      );

      return { kind: 'opened', orderId: order.id, positionId: position.id };
    });

    if (result.kind === 'rejected') {
      return NextResponse.json({ error: result.reason, order_id: result.orderId }, { status: result.httpStatus });
    }

    // ── 7. Mark originating WebhookSignal (best-effort, outside tx) ──────────
    if (signal_id) {
      try {
        await prisma.webhookSignal.update({
          where: { id: signal_id },
          data:  { order_created: true, order_id: result.orderId },
        });
      } catch {
        console.warn(`[BotOrder] Could not update signal ${signal_id}`);
      }
    }

    // ── 8. Return result ─────────────────────────────────────────────────────
    return NextResponse.json(
      {
        status:       'created',
        order_id:     result.orderId,
        position_id:  result.positionId,
        order_status: 'FILLED',
        action:       result.kind, // opened | averaged | netted_partial | netted_full
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[BotOrder] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check — lets the bot verify the endpoint is reachable
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'SAHAAI bot paper-order receiver' });
}
