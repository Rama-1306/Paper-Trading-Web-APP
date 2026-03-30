import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { DEFAULT_CONFIG } from '@/lib/utils/constants';
import { getQuickMargin } from '@/lib/utils/margins';

export async function GET() {
  try {
    const account = await prisma.account.findFirst();
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const istStartOfDay = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
    const utcStartOfDay = new Date(istStartOfDay.getTime() - istOffsetMs);

    const orders = await prisma.order.findMany({
      where: {
        accountId: account.id,
        createdAt: { gte: utcStartOfDay },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      symbol, displayName, side, orderType, quantity, price, triggerPrice,
      stopLoss, targetPrice, trailingSL, trailingDistance
    } = body;

    if (!symbol || !side || !orderType || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: symbol, side, orderType, quantity' },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'Quantity must be at least 1' },
        { status: 400 }
      );
    }

    if ((orderType === 'LIMIT' || orderType === 'SL') && !price) {
      return NextResponse.json(
        { error: 'Price is required for LIMIT and SL orders' },
        { status: 400 }
      );
    }

    if ((orderType === 'SL' || orderType === 'SL-M') && !triggerPrice) {
      return NextResponse.json(
        { error: 'Trigger price is required for SL and SL-M orders' },
        { status: 400 }
      );
    }

    const account = await prisma.account.findFirst();
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }


    const order = await prisma.order.create({
      data: {
        accountId: account.id,
        symbol,
        displayName: displayName || symbol,
        side,
        orderType,
        quantity,
        price: price ?? null,
        triggerPrice: triggerPrice ?? null,
        status: orderType === 'MARKET' ? 'FILLED' : 'PENDING',
        filledPrice: orderType === 'MARKET' ? (price || 0) : null,
        filledAt: orderType === 'MARKET' ? new Date() : null,
      },
    });

    if (orderType === 'MARKET') {
      let instrumentType = 'FUTURES';
      if (symbol.includes('CE')) instrumentType = 'CE';
      else if (symbol.includes('PE')) instrumentType = 'PE';

      const fillPrice = price || 0;
      const sideNum = side === 'BUY' ? 1 : -1;
      const isOption = instrumentType === 'CE' || instrumentType === 'PE';
      const premium = isOption ? fillPrice * quantity : 0;

      // --- Position netting: check for an opposite-side open position first ---
      const oppositeSide = side === 'BUY' ? 'SELL' : 'BUY';
      const oppositePosition = await prisma.position.findFirst({
        where: { accountId: account.id, symbol, side: oppositeSide, isOpen: true },
      });

      if (oppositePosition) {
        // P&L: if we're BUYing against a SELL position, profit = entry(sell) - exit(buy)
        const pnlPerUnit = side === 'BUY'
          ? oppositePosition.entryPrice - fillPrice
          : fillPrice - oppositePosition.entryPrice;

        const netQty = Math.min(quantity, oppositePosition.quantity); // qty actually netted
        const pnl = pnlPerUnit * netQty;

        const marginPerUnit = oppositePosition.marginUsed > 0
          ? oppositePosition.marginUsed / oppositePosition.quantity
          : 0;
        const marginToRelease = marginPerUnit * netQty;

        if (netQty < oppositePosition.quantity) {
          // Partial net: shrink the opposite position
          await prisma.position.update({
            where: { id: oppositePosition.id },
            data: {
              quantity: oppositePosition.quantity - netQty,
              currentPrice: fillPrice,
              marginUsed: Math.max(0, oppositePosition.marginUsed - marginToRelease),
            },
          });
        } else {
          // Full net: close the opposite position
          await prisma.position.update({
            where: { id: oppositePosition.id },
            data: {
              isOpen: false,
              currentPrice: fillPrice,
              pnl,
              marginUsed: 0,
              exitReason: 'NET_OFF',
              closedAt: new Date(),
            },
          });
        }

        // Create trade record for the netted portion
        await prisma.trade.create({
          data: {
            accountId: account.id,
            symbol,
            displayName: displayName || symbol,
            side: oppositeSide,
            quantity: netQty,
            entryPrice: oppositePosition.entryPrice,
            exitPrice: fillPrice,
            pnl,
            exitReason: 'NET_OFF',
            entryTime: oppositePosition.createdAt,
          },
        });

        // Release margin and credit P&L
        await prisma.account.update({
          where: { id: account.id },
          data: {
            balance: { increment: pnl },
            realizedPnl: { increment: pnl },
            usedMargin: { decrement: Math.max(0, marginToRelease) },
          },
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { positionId: oppositePosition.id },
        });

        // If order qty > opposite position qty, open a new position for the remainder
        const remainingQty = quantity - netQty;
        if (remainingQty > 0) {
          const newMargin = getQuickMargin(symbol, remainingQty, sideNum);
          const newPosition = await prisma.position.create({
            data: {
              accountId: account.id,
              symbol,
              displayName: displayName || symbol,
              instrumentType,
              side,
              quantity: remainingQty,
              entryPrice: fillPrice,
              currentPrice: fillPrice,
              marginUsed: newMargin,
              stopLoss: stopLoss || null,
              targetPrice: targetPrice || null,
              trailingSL: trailingSL || false,
              trailingDistance: trailingDistance || null,
            },
          });
          await prisma.account.update({
            where: { id: account.id },
            data: { usedMargin: { increment: newMargin } },
          });
          await prisma.order.update({
            where: { id: order.id },
            data: { positionId: newPosition.id },
          });
        }

        return NextResponse.json(order, { status: 201 });
      }

      // --- No opposite position: check same-side to average or create new ---
      const existingPosition = await prisma.position.findFirst({
        where: { accountId: account.id, symbol, side, isOpen: true },
      });

      if (existingPosition) {
        const oldQty = existingPosition.quantity;
        const oldPrice = existingPosition.entryPrice;
        const newQty = oldQty + quantity;
        const avgPrice = (oldPrice * oldQty + fillPrice * quantity) / newQty;

        const additionalMargin = getQuickMargin(symbol, quantity, sideNum);
        const totalCostForAvg = additionalMargin + (isOption && side === 'BUY' ? premium : 0);
        const availForAvg = account.balance - account.usedMargin;
        if (totalCostForAvg > availForAvg) {
          return NextResponse.json(
            { error: `Insufficient funds to average. Required: ₹${totalCostForAvg.toLocaleString()}, Available: ₹${Math.floor(availForAvg).toLocaleString()}` },
            { status: 400 }
          );
        }

        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            quantity: newQty,
            entryPrice: avgPrice,
            currentPrice: fillPrice,
            marginUsed: existingPosition.marginUsed + additionalMargin,
            stopLoss: stopLoss || existingPosition.stopLoss,
            targetPrice: targetPrice || existingPosition.targetPrice,
            trailingSL: trailingSL !== undefined ? trailingSL : existingPosition.trailingSL,
            trailingDistance: trailingDistance || existingPosition.trailingDistance,
          },
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { positionId: existingPosition.id },
        });

        const balanceChange = isOption ? (side === 'BUY' ? -premium : premium) : 0;
        await prisma.account.update({
          where: { id: account.id },
          data: {
            usedMargin: { increment: additionalMargin },
            ...(balanceChange !== 0 ? { balance: { increment: balanceChange } } : {}),
          },
        });
      } else {
        const openPositions = await prisma.position.count({
          where: { accountId: account.id, isOpen: true },
        });

        if (openPositions >= DEFAULT_CONFIG.MAX_POSITIONS) {
          return NextResponse.json(
            { error: `Maximum ${DEFAULT_CONFIG.MAX_POSITIONS} positions allowed` },
            { status: 400 }
          );
        }

        const marginRequired = getQuickMargin(symbol, quantity, sideNum);
        const totalCost = marginRequired + (isOption && side === 'BUY' ? premium : 0);

        const availableBalance = account.balance - account.usedMargin;
        if (totalCost > availableBalance) {
          return NextResponse.json(
            { error: `Insufficient funds. Required: ₹${totalCost.toLocaleString()}, Available: ₹${Math.floor(availableBalance).toLocaleString()}` },
            { status: 400 }
          );
        }

        const position = await prisma.position.create({
          data: {
            accountId: account.id,
            symbol,
            displayName: displayName || symbol,
            instrumentType,
            side,
            quantity,
            entryPrice: fillPrice,
            currentPrice: fillPrice,
            marginUsed: marginRequired,
            stopLoss: stopLoss || null,
            targetPrice: targetPrice || null,
            trailingSL: trailingSL || false,
            trailingDistance: trailingDistance || null,
          },
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { positionId: position.id },
        });

        const balanceChange = isOption ? (side === 'BUY' ? -premium : premium) : 0;
        await prisma.account.update({
          where: { id: account.id },
          data: {
            usedMargin: { increment: marginRequired },
            ...(balanceChange !== 0 ? { balance: { increment: balanceChange } } : {}),
          },
        });
      }
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Orders POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Order not found or not pending' }, { status: 404 });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Orders DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
