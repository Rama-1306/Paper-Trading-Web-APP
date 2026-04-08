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
    const { positionId, stopLoss, targetPrice, targetQty, trailingSL, trailingDistance } = body;

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

    const parsedStopLoss =
      stopLoss === undefined || stopLoss === null ? stopLoss : Number(stopLoss);
    const parsedTargetPrice =
      targetPrice === undefined || targetPrice === null ? targetPrice : Number(targetPrice);
    const parsedTargetQty =
      targetQty === undefined || targetQty === null ? targetQty : Math.floor(Number(targetQty));

    if (parsedStopLoss !== undefined && parsedStopLoss !== null) {
      if (!Number.isFinite(parsedStopLoss) || parsedStopLoss <= 0) {
        return NextResponse.json({ error: 'Stop loss must be greater than 0' }, { status: 400 });
      }
      if (position.side === 'BUY' && parsedStopLoss >= position.entryPrice) {
        return NextResponse.json(
          { error: 'Stop loss must be below entry price for BUY positions' },
          { status: 400 }
        );
      }
      if (position.side === 'SELL' && parsedStopLoss <= position.entryPrice) {
        return NextResponse.json(
          { error: 'Stop loss must be above entry price for SELL positions' },
          { status: 400 }
        );
      }
    }
    if (parsedTargetPrice !== undefined && parsedTargetPrice !== null) {
      if (!Number.isFinite(parsedTargetPrice) || parsedTargetPrice <= 0) {
        return NextResponse.json({ error: 'Target must be greater than 0' }, { status: 400 });
      }
      if (position.side === 'BUY' && parsedTargetPrice <= position.entryPrice) {
        return NextResponse.json(
          { error: 'Target must be above entry price for BUY positions' },
          { status: 400 }
        );
      }
      if (position.side === 'SELL' && parsedTargetPrice >= position.entryPrice) {
        return NextResponse.json(
          { error: 'Target must be below entry price for SELL positions' },
          { status: 400 }
        );
      }
    }

    if (parsedTargetQty !== undefined && parsedTargetQty !== null) {
      if (!Number.isFinite(parsedTargetQty) || parsedTargetQty < 1) {
        return NextResponse.json({ error: 'Target quantity must be at least 1' }, { status: 400 });
      }
      if (parsedTargetQty > position.quantity) {
        return NextResponse.json(
          { error: `Target quantity cannot exceed open quantity (${position.quantity})` },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (parsedStopLoss !== undefined) updateData.stopLoss = parsedStopLoss;
    if (parsedTargetPrice !== undefined) updateData.targetPrice = parsedTargetPrice;
    if (parsedTargetQty !== undefined) updateData.targetQty = parsedTargetQty;
    if (trailingSL !== undefined) updateData.trailingSL = trailingSL;
    if (trailingDistance !== undefined) updateData.trailingDistance = trailingDistance;
    const exitSide = position.side === 'BUY' ? 'SELL' : 'BUY';
    const configuredExitQty = parsedTargetQty ?? position.quantity;
    const previousConfiguredQty = position.targetQty ?? position.quantity;
    const shouldCreateTargetOrder =
      parsedTargetPrice !== undefined &&
      parsedTargetPrice !== null &&
      (parsedTargetPrice !== position.targetPrice || configuredExitQty !== previousConfiguredQty);
    const shouldCreateStopOrder =
      parsedStopLoss !== undefined &&
      parsedStopLoss !== null &&
      (parsedStopLoss !== position.stopLoss || configuredExitQty !== previousConfiguredQty);

    const result = await prisma.$transaction(async (tx) => {
      const updatedPosition = await tx.position.update({
        where: { id: positionId },
        data: updateData,
      });

      if (parsedTargetPrice === null) {
        await tx.order.deleteMany({
          where: {
            accountId: account.id,
            positionId,
            status: 'PENDING',
            side: exitSide,
            orderType: 'LIMIT',
          },
        });
      }

      if (parsedStopLoss === null) {
        await tx.order.deleteMany({
          where: {
            accountId: account.id,
            positionId,
            status: 'PENDING',
            side: exitSide,
            orderType: { in: ['SL', 'SL-M'] },
          },
        });
      }

      const createdExitOrders: Array<{ id: string; orderType: string; quantity: number; price: number | null; triggerPrice: number | null }> = [];

      if (shouldCreateTargetOrder) {
        // Delete ALL existing pending target orders for this position first
        // to prevent stacking multiple LIMIT orders on repeated modifies
        await tx.order.deleteMany({
          where: {
            accountId: account.id,
            positionId,
            status: 'PENDING',
            side: exitSide,
            orderType: 'LIMIT',
          },
        });
        const targetOrder = await tx.order.create({
          data: {
            accountId: account.id,
            positionId,
            symbol: position.symbol,
            displayName: position.displayName,
            side: exitSide,
            orderType: 'LIMIT',
            quantity: configuredExitQty,
            price: parsedTargetPrice,
            triggerPrice: null,
            status: 'PENDING',
            intent: 'CLOSE',
          },
        });
        createdExitOrders.push({
          id: targetOrder.id,
          orderType: targetOrder.orderType,
          quantity: targetOrder.quantity,
          price: targetOrder.price,
          triggerPrice: targetOrder.triggerPrice,
        });
      }

      if (shouldCreateStopOrder) {
        // Delete ALL existing pending SL orders for this position first
        // to prevent stacking multiple SL orders on repeated modifies
        await tx.order.deleteMany({
          where: {
            accountId: account.id,
            positionId,
            status: 'PENDING',
            side: exitSide,
            orderType: { in: ['SL', 'SL-M'] },
          },
        });
        const stopOrder = await tx.order.create({
          data: {
            accountId: account.id,
            positionId,
            symbol: position.symbol,
            displayName: position.displayName,
            side: exitSide,
            orderType: 'SL-M',
            quantity: configuredExitQty,
            price: null,
            triggerPrice: parsedStopLoss,
            status: 'PENDING',
            intent: 'CLOSE',
          },
        });
        createdExitOrders.push({
          id: stopOrder.id,
          orderType: stopOrder.orderType,
          quantity: stopOrder.quantity,
          price: stopOrder.price,
          triggerPrice: stopOrder.triggerPrice,
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
