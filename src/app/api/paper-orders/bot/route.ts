/**
 * POST /api/paper-orders/bot
 * SAHAAI Signal Flow — Step B: Bot Paper Order Receiver
 *
 * Called by the algo bot after it decides to act on a broadcast signal.
 * This endpoint:
 *   1. Authenticates the bot via bot_id (user_id in bot_status table)
 *   2. Validates the order payload
 *   3. Creates a paper Order record (FILLED for MARKET, PENDING for LIMIT)
 *   4. For MARKET orders: opens a Position with SL / T1 / T2 / T3
 *   5. Marks the originating WebhookSignal as order_created = true
 *   6. Returns the created order + position IDs
 *
 * Expected JSON from the bot:
 * {
 *   "bot_id":      "BOT-LICENSE-KEY",     // must exist in bot_status.user_id
 *   "account_id":  "clxxx...",            // paper trading account to debit
 *   "signal_id":   "cmnougqs7...",        // optional — WebhookSignal.id
 *   "symbol":      "NSE:BANKNIFTY25JANFUT",
 *   "display_name": "BANKNIFTY JAN FUT",  // optional
 *   "side":        "BUY",                 // BUY | SELL
 *   "order_type":  "MARKET",              // MARKET | LIMIT
 *   "quantity":    25,
 *   "price":       48250.0,               // required for LIMIT; fill price for MARKET
 *   "sl":          47900.0,               // optional stop-loss
 *   "t1":          48600.0,               // optional target 1
 *   "t2":          48900.0,               // optional target 2
 *   "t3":          49200.0                // optional target 3
 * }
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

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse body ─────────────────────────────────────────────────────────
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
    };

    // ── 2. Validate required fields ───────────────────────────────────────────
    if (!bot_id)     return err('bot_id is required');
    if (!account_id) return err('account_id is required');
    if (!symbol)     return err('symbol is required');
    if (!side)       return err('side is required (BUY | SELL)');
    if (!order_type) return err('order_type is required (MARKET | LIMIT)');
    if (!quantity || quantity < 1) return err('quantity must be >= 1');

    const sideUpper = side.toUpperCase();
    const typeUpper = order_type.toUpperCase();

    if (!['BUY', 'SELL'].includes(sideUpper))     return err("side must be 'BUY' or 'SELL'");
    if (!['MARKET', 'LIMIT'].includes(typeUpper)) return err("order_type must be 'MARKET' or 'LIMIT'");
    if (typeUpper === 'LIMIT' && !price)          return err('price is required for LIMIT orders');

    // ── 3. Authenticate bot ───────────────────────────────────────────────────
    const bot = await prisma.botStatus.findUnique({
      where: { user_id: bot_id },
      select: { user_id: true, status: true },
    });

    if (!bot) {
      return err('Unknown bot_id — bot is not registered', 403);
    }
    if (bot.status === 'halted') {
      return err('Bot is halted — orders are blocked', 403);
    }

    // ── 4. Resolve account ────────────────────────────────────────────────────
    const account = await prisma.account.findUnique({
      where: { id: account_id },
    });

    if (!account) return err('account_id not found', 404);

    const fillPrice = price ?? 0;
    const sideNum   = sideUpper === 'BUY' ? 1 : -1;
    const instType  = instrumentType(symbol);
    const isOption  = instType === 'CE' || instType === 'PE';
    const premium   = isOption ? fillPrice * quantity : 0;
    const displayName = display_name || symbol;

    // ── 5. Create the Order record ────────────────────────────────────────────
    const isMarket = typeUpper === 'MARKET';

    const order = await prisma.order.create({
      data: {
        accountId:   account.id,
        symbol,
        displayName,
        side:        sideUpper,
        orderType:   typeUpper,
        quantity,
        price:       price ?? null,
        status:      isMarket ? 'FILLED' : 'PENDING',
        filledPrice: isMarket ? fillPrice : null,
        filledAt:    isMarket ? new Date() : null,
      },
    });

    console.log(
      `[BotOrder] ${sideUpper} ${quantity} ${symbol} @ ${fillPrice} ` +
      `| order=${order.id} bot=${bot_id}`
    );

    // ── 6. For MARKET orders: open / update position ──────────────────────────
    let positionId: string | null = null;

    if (isMarket) {
      // Check for opposite-side position to net off first
      const oppSide = sideUpper === 'BUY' ? 'SELL' : 'BUY';
      const oppPosition = await prisma.position.findFirst({
        where: { accountId: account.id, symbol, side: oppSide, isOpen: true },
      });

      if (oppPosition) {
        // Net off against opposite position
        const pnlPerUnit =
          sideUpper === 'BUY'
            ? oppPosition.entryPrice - fillPrice
            : fillPrice - oppPosition.entryPrice;
        const netQty  = Math.min(quantity, oppPosition.quantity);
        const pnl     = pnlPerUnit * netQty;
        const mPerUnit = oppPosition.marginUsed > 0
          ? oppPosition.marginUsed / oppPosition.quantity
          : 0;
        const marginReleased = mPerUnit * netQty;

        if (netQty < oppPosition.quantity) {
          await prisma.position.update({
            where: { id: oppPosition.id },
            data: {
              quantity:    oppPosition.quantity - netQty,
              currentPrice: fillPrice,
              marginUsed:  Math.max(0, oppPosition.marginUsed - marginReleased),
            },
          });
        } else {
          await prisma.position.update({
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
        }

        await prisma.trade.create({
          data: {
            accountId:   account.id,
            symbol,
            displayName,
            side:        oppSide,
            quantity:    netQty,
            entryPrice:  oppPosition.entryPrice,
            exitPrice:   fillPrice,
            pnl,
            exitReason:  'NET_OFF',
            entryTime:   oppPosition.createdAt,
          },
        });

        await prisma.account.update({
          where: { id: account.id },
          data: {
            balance:     { increment: pnl },
            realizedPnl: { increment: pnl },
            usedMargin:  { decrement: Math.max(0, marginReleased) },
          },
        });

        positionId = oppPosition.id;
        await prisma.order.update({
          where: { id: order.id },
          data:  { positionId },
        });

        // If order qty > opposite position qty, open new position for remainder
        const remainingQty = quantity - netQty;
        if (remainingQty > 0) {
          const newMargin = getQuickMargin(symbol, remainingQty, sideNum);
          const newPos = await prisma.position.create({
            data: {
              accountId:    account.id,
              symbol,
              displayName,
              instrumentType: instType,
              side:         sideUpper,
              quantity:     remainingQty,
              entryPrice:   fillPrice,
              currentPrice: fillPrice,
              marginUsed:   newMargin,
              stopLoss:     sl    ?? null,
              targetPrice:  t1    ?? null,
              target2:      t2    ?? null,
              target3:      t3    ?? null,
            },
          });
          await prisma.account.update({
            where: { id: account.id },
            data:  { usedMargin: { increment: newMargin } },
          });
          positionId = newPos.id;
          await prisma.order.update({
            where: { id: order.id },
            data:  { positionId },
          });
        }
      } else {
        // No opposite position — open a fresh position
        const marginRequired = getQuickMargin(symbol, quantity, sideNum);
        const totalCost = marginRequired + (isOption && sideUpper === 'BUY' ? premium : 0);
        const available = account.balance - account.usedMargin;

        if (totalCost > available) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status:         'REJECTED',
              rejectedReason: `Insufficient funds. Required: ₹${Math.round(totalCost).toLocaleString('en-IN')}, Available: ₹${Math.round(available).toLocaleString('en-IN')}`,
              filledPrice:    null,
              filledAt:       null,
            },
          });
          return NextResponse.json(
            { error: 'Insufficient funds', order_id: order.id },
            { status: 402 }
          );
        }

        const position = await prisma.position.create({
          data: {
            accountId:     account.id,
            symbol,
            displayName,
            instrumentType: instType,
            side:          sideUpper,
            quantity,
            entryPrice:    fillPrice,
            currentPrice:  fillPrice,
            marginUsed:    marginRequired,
            stopLoss:      sl ?? null,
            targetPrice:   t1 ?? null,
            target2:       t2 ?? null,
            target3:       t3 ?? null,
          },
        });

        const balanceChange = isOption ? (sideUpper === 'BUY' ? -premium : premium) : 0;
        await prisma.account.update({
          where: { id: account.id },
          data: {
            usedMargin: { increment: marginRequired },
            ...(balanceChange !== 0 ? { balance: { increment: balanceChange } } : {}),
          },
        });

        positionId = position.id;
        await prisma.order.update({
          where: { id: order.id },
          data:  { positionId },
        });

        console.log(
          `[BotOrder] Position opened: ${position.id} | ` +
          `SL=${sl ?? '-'} T1=${t1 ?? '-'} T2=${t2 ?? '-'} T3=${t3 ?? '-'}`
        );
      }
    }

    // ── 7. Mark originating signal as order_created ───────────────────────────
    if (signal_id) {
      try {
        await prisma.webhookSignal.update({
          where: { id: signal_id },
          data:  { order_created: true, order_id: order.id },
        });
      } catch {
        // Signal may have been deleted or ID is wrong — don't fail the order
        console.warn(`[BotOrder] Could not update signal ${signal_id}`);
      }
    }

    // ── 8. Return result ──────────────────────────────────────────────────────
    return NextResponse.json(
      {
        status:      'created',
        order_id:    order.id,
        position_id: positionId,
        order_status: order.status,
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
