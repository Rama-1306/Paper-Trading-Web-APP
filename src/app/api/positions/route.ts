import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

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
    const body = await request.json();
    const { positionId, stopLoss, targetPrice, targetQty, trailingSL, trailingDistance } = body;

    if (!positionId) {
      return NextResponse.json({ error: 'positionId required' }, { status: 400 });
    }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position || !position.isOpen) {
      return NextResponse.json(
        { error: 'Position not found or already closed' },
        { status: 404 }
      );
    }

    if (stopLoss !== undefined && stopLoss !== null) {
      if (position.side === 'BUY' && stopLoss >= position.entryPrice) {
        return NextResponse.json(
          { error: 'Stop loss must be below entry price for BUY positions' },
          { status: 400 }
        );
      }
      if (position.side === 'SELL' && stopLoss <= position.entryPrice) {
        return NextResponse.json(
          { error: 'Stop loss must be above entry price for SELL positions' },
          { status: 400 }
        );
      }
    }

    if (targetPrice !== undefined && targetPrice !== null) {
      if (position.side === 'BUY' && targetPrice <= position.entryPrice) {
        return NextResponse.json(
          { error: 'Target must be above entry price for BUY positions' },
          { status: 400 }
        );
      }
      if (position.side === 'SELL' && targetPrice >= position.entryPrice) {
        return NextResponse.json(
          { error: 'Target must be below entry price for SELL positions' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (stopLoss !== undefined) updateData.stopLoss = stopLoss;
    if (targetPrice !== undefined) updateData.targetPrice = targetPrice;
    if (targetQty !== undefined) updateData.targetQty = targetQty;
    if (trailingSL !== undefined) updateData.trailingSL = trailingSL;
    if (trailingDistance !== undefined) updateData.trailingDistance = trailingDistance;

    const updated = await prisma.position.update({
      where: { id: positionId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Positions PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { positionId, exitPrice, exitQuantity } = body;

    if (!positionId) {
      return NextResponse.json({ error: 'positionId required' }, { status: 400 });
    }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
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
