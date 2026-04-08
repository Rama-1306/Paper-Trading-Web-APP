import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getOrCreateAuthenticatedAccount } from '@/lib/account-context';

export async function GET(request: NextRequest) {
  try {
    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { account } = context;

    const searchParams = request.nextUrl.searchParams;
    const showClosed = searchParams.get('closed') === 'true';

    const positions = await prisma.position.findMany({
      where: {
        accountId: account.id,
        ...(showClosed ? {} : { isOpen: true }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error('Positions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { account, access } = context;
    if (!access.permissions.canModifySLTarget) {
      return NextResponse.json({ error: 'SL/target modification permission is disabled for this user' }, { status: 403 });
    }
    const body = await request.json();
    const { positionId, trailingSL, trailingDistance } = body;

    if (!positionId) {
      return NextResponse.json({ error: 'positionId required' }, { status: 400 });
    }

    const position = await prisma.position.findFirst({
      where: { id: positionId, accountId: account.id },
    });

    if (!position || !position.isOpen) {
      return NextResponse.json(
        { error: 'Position not found or already closed' },
        { status: 404 }
      );
    }

    // ── Parse all target levels (T1 / T2 / T3) and SL ────────────────────
    const parsePrice = (v: unknown) =>
      v === undefined || v === null ? v : Number(v);
    const parseQty = (v: unknown) =>
      v === undefined || v === null ? v : Math.floor(Number(v));

    const parsedSL   = parsePrice(body.stopLoss);
    const parsedT1   = parsePrice(body.targetPrice);
    const parsedT2   = parsePrice(body.target2);
    const parsedT3   = parsePrice(body.target3);
    const parsedQ1   = parseQty(body.targetQty);
    const parsedQ2   = parseQty(body.targetQty2);
    const parsedQ3   = parseQty(body.targetQty3);

    // ── Validate SL direction ─────────────────────────────────────────────
    if (parsedSL !== undefined && parsedSL !== null) {
      if (!Number.isFinite(parsedSL) || parsedSL <= 0) {
        return NextResponse.json({ error: 'Stop loss must be greater than 0' }, { status: 400 });
      }
      if (position.side === 'BUY' && parsedSL >= position.entryPrice) {
        return NextResponse.json(
          { error: 'Stop loss must be below entry price for BUY positions' },
          { status: 400 }
        );
      }
      if (position.side === 'SELL' && parsedSL <= position.entryPrice) {
        return NextResponse.json(
          { error: 'Stop loss must be above entry price for SELL positions' },
          { status: 400 }
        );
      }
    }

    // ── Validate each target price direction ──────────────────────────────
    const validateTarget = (price: number | null | undefined, label: string) => {
      if (price === undefined || price === null) return null;
      if (!Number.isFinite(price) || price <= 0) {
        return `${label} must be greater than 0`;
      }
      if (position.side === 'BUY' && price <= position.entryPrice) {
        return `${label} must be above entry price for BUY positions`;
      }
      if (position.side === 'SELL' && price >= position.entryPrice) {
        return `${label} must be below entry price for SELL positions`;
      }
      return null;
    };

    for (const [price, label] of [
      [parsedT1, 'T1'], [parsedT2, 'T2'], [parsedT3, 'T3'],
    ] as const) {
      const err = validateTarget(price as number | null | undefined, label as string);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    // ── Build list of targets to create ───────────────────────────────────
    type TargetLevel = { price: number; qty: number };
    const targets: TargetLevel[] = [];
    if (parsedT1 !== undefined && parsedT1 !== null) {
      targets.push({ price: parsedT1, qty: (parsedQ1 && parsedQ1 >= 1) ? parsedQ1 : position.quantity });
    }
    if (parsedT2 !== undefined && parsedT2 !== null) {
      if (!parsedQ2 || parsedQ2 < 1) {
        return NextResponse.json({ error: 'T2 quantity is required when T2 price is set' }, { status: 400 });
      }
      targets.push({ price: parsedT2, qty: parsedQ2 });
    }
    if (parsedT3 !== undefined && parsedT3 !== null) {
      if (!parsedQ3 || parsedQ3 < 1) {
        return NextResponse.json({ error: 'T3 quantity is required when T3 price is set' }, { status: 400 });
      }
      targets.push({ price: parsedT3, qty: parsedQ3 });
    }

    // ── Validate cumulative target qty ≤ position qty ─────────────────────
    const totalTargetQty = targets.reduce((sum, t) => sum + t.qty, 0);
    if (totalTargetQty > position.quantity) {
      return NextResponse.json(
        { error: `Total target qty (${totalTargetQty}) exceeds position qty (${position.quantity}). T1+T2+T3 must be ≤ ${position.quantity}` },
        { status: 400 }
      );
    }

    // ── Build position field updates ──────────────────────────────────────
    // IMPORTANT: Do NOT store targetPrice/target2/target3/targetQty on the
    // position.  Pending LIMIT orders are the sole source of truth for
    // targets.  Storing them on the position causes processPositionSLTarget
    // to race ahead of the pending-order path and close the FULL qty
    // instead of the per-target qty.
    const updateData: Record<string, unknown> = {
      targetPrice: null,
      target2: null,
      target3: null,
      targetQty: null,
    };
    if (parsedSL !== undefined) updateData.stopLoss = parsedSL;
    if (trailingSL !== undefined) updateData.trailingSL = trailingSL;
    if (trailingDistance !== undefined) updateData.trailingDistance = trailingDistance;

    const exitSide = position.side === 'BUY' ? 'SELL' : 'BUY';

    const result = await prisma.$transaction(async (tx) => {
      const updatedPosition = await tx.position.update({
        where: { id: positionId },
        data: updateData,
      });

      // ── Delete ALL existing pending exit orders (clean slate) ──────────
      await tx.order.deleteMany({
        where: {
          accountId: account.id,
          positionId,
          status: 'PENDING',
          side: exitSide,
        },
      });

      const createdExitOrders: Array<{ id: string; orderType: string; quantity: number; price: number | null; triggerPrice: number | null }> = [];

      // ── Create one LIMIT order per target level ────────────────────────
      for (const t of targets) {
        const order = await tx.order.create({
          data: {
            accountId: account.id,
            positionId,
            symbol: position.symbol,
            displayName: position.displayName,
            side: exitSide,
            orderType: 'LIMIT',
            quantity: t.qty,
            price: t.price,
            triggerPrice: null,
            status: 'PENDING',
            intent: 'CLOSE',
          },
        });
        createdExitOrders.push({
          id: order.id, orderType: order.orderType,
          quantity: order.quantity, price: order.price, triggerPrice: order.triggerPrice,
        });
      }

      // ── Create SL order (protects full position qty — execution caps) ──
      if (parsedSL !== undefined && parsedSL !== null) {
        const order = await tx.order.create({
          data: {
            accountId: account.id,
            positionId,
            symbol: position.symbol,
            displayName: position.displayName,
            side: exitSide,
            orderType: 'SL-M',
            quantity: position.quantity,
            price: null,
            triggerPrice: parsedSL,
            status: 'PENDING',
            intent: 'CLOSE',
          },
        });
        createdExitOrders.push({
          id: order.id, orderType: order.orderType,
          quantity: order.quantity, price: order.price, triggerPrice: order.triggerPrice,
        });
      }

      return { updatedPosition, createdExitOrders };
    });

    return NextResponse.json({
      ...result.updatedPosition,
      createdExitOrders: result.createdExitOrders,
    });
  } catch (error) {
    console.error('Positions PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { account, access } = context;
    if (!access.permissions.canExitPosition) {
      return NextResponse.json({ error: 'Position exit permission is disabled for this user' }, { status: 403 });
    }
    const body = await request.json();
    const { positionId, exitPrice, exitQuantity } = body;

    if (!positionId) {
      return NextResponse.json({ error: 'positionId required' }, { status: 400 });
    }

    const position = await prisma.position.findFirst({
      where: { id: positionId, accountId: account.id },
    });

    if (!position || !position.isOpen) {
      return NextResponse.json(
        { error: 'Position not found or already closed' },
        { status: 404 }
      );
    }

    const actualExitPrice = exitPrice || position.currentPrice || position.entryPrice;
    const qtyToExit = exitQuantity && exitQuantity > 0 && exitQuantity < position.quantity
      ? exitQuantity
      : position.quantity;
    const isPartialExit = qtyToExit < position.quantity;

    const pnl =
      position.side === 'BUY'
        ? (actualExitPrice - position.entryPrice) * qtyToExit
        : (position.entryPrice - actualExitPrice) * qtyToExit;

    const marginPerUnit = position.marginUsed > 0
      ? position.marginUsed / position.quantity
      : position.entryPrice * 0.15;
    const marginToRelease = marginPerUnit * qtyToExit;

    if (isPartialExit) {
      await prisma.position.update({
        where: { id: positionId },
        data: {
          quantity: position.quantity - qtyToExit,
          currentPrice: actualExitPrice,
          marginUsed: Math.max(0, position.marginUsed - marginToRelease),
        },
      });
    } else {
      await prisma.position.update({
        where: { id: positionId },
        data: {
          isOpen: false,
          currentPrice: actualExitPrice,
          pnl,
          marginUsed: 0,
          exitReason: 'MANUAL',
          closedAt: new Date(),
        },
      });
    }

    await prisma.trade.create({
      data: {
        accountId: position.accountId,
        symbol: position.symbol,
        displayName: position.displayName,
        side: position.side,
        quantity: qtyToExit,
        entryPrice: position.entryPrice,
        exitPrice: actualExitPrice,
        pnl,
        exitReason: 'MANUAL',
        entryTime: position.createdAt,
      },
    });
    const exitSide = position.side === 'BUY' ? 'SELL' : 'BUY';

    await prisma.order.create({
      data: {
        accountId: position.accountId,
        symbol: position.symbol,
        displayName: position.displayName,
        side: exitSide,
        orderType: 'MARKET',
        quantity: qtyToExit,
        price: actualExitPrice,
        status: 'FILLED',
        filledPrice: actualExitPrice,
        filledAt: new Date(),
        positionId: position.id,
        intent: 'CLOSE',
      },
    });

    if (!isPartialExit) {
      await prisma.order.updateMany({
        where: {
          accountId: position.accountId,
          positionId: position.id,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          rejectedReason: 'Position closed manually',
        },
      });
    }

    const isOption = position.instrumentType === 'CE' || position.instrumentType === 'PE';
    let balanceAdjust: number;
    if (isOption) {
      if (position.side === 'BUY') {
        balanceAdjust = actualExitPrice * qtyToExit;
      } else {
        balanceAdjust = -(actualExitPrice * qtyToExit);
      }
    } else {
      balanceAdjust = pnl;
    }

    await prisma.account.update({
      where: { id: position.accountId },
      data: {
        balance: { increment: balanceAdjust },
        realizedPnl: { increment: pnl },
        usedMargin: { decrement: Math.max(0, marginToRelease) },
      },
    });

    return NextResponse.json({
      success: true,
      pnl,
      exitPrice: actualExitPrice,
      exitQuantity: qtyToExit,
      isPartialExit,
      remainingQuantity: isPartialExit ? position.quantity - qtyToExit : 0,
    });
  } catch (error) {
    console.error('Positions DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
