import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { DEFAULT_CONFIG } from '@/lib/utils/constants';
import { getQuickMargin } from '@/lib/utils/margins';
import { getOrCreateAuthenticatedAccount } from '@/lib/account-context';
function getISTDayBounds(date = new Date()) {
  const istDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  return {
    start: new Date(`${istDate}T00:00:00+05:30`),
    end: new Date(`${istDate}T23:59:59.999+05:30`),
  };
}

export async function GET() {
  try {
    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { account } = context;

    const [orders, trades] = await Promise.all([
      prisma.order.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.trade.findMany({
        where: { accountId: account.id },
        orderBy: { exitTime: 'desc' },
        take: 500,
      }),
    ]);

    const hasMatchingExitOrder = (trade: (typeof trades)[number]) => {
      const expectedExitSide = trade.side === 'BUY' ? 'SELL' : 'BUY';
      return orders.some((order) => {
        if (order.status !== 'FILLED') return false;
        if (order.symbol !== trade.symbol) return false;
        if (order.side !== expectedExitSide) return false;
        if (order.quantity !== trade.quantity) return false;

        const orderTime = order.filledAt || order.createdAt;
        const timeDiffMs = Math.abs(orderTime.getTime() - trade.exitTime.getTime());
        if (timeDiffMs > 5 * 60 * 1000) return false;

        const orderPrice = order.filledPrice ?? order.price ?? 0;
        return Math.abs(orderPrice - trade.exitPrice) <= 0.2;
      });
    };

    const syntheticExitOrders = trades
      .filter((trade) => !hasMatchingExitOrder(trade))
      .map((trade) => ({
        id: `synthetic-exit-${trade.id}`,
        accountId: trade.accountId,
        symbol: trade.symbol,
        displayName: trade.displayName,
        side: trade.side === 'BUY' ? 'SELL' : 'BUY',
        orderType: trade.exitReason === 'SL_HIT' ? 'SL-M' : 'MARKET',
        quantity: trade.quantity,
        price: trade.exitPrice,
        triggerPrice: null,
        status: 'FILLED',
        filledPrice: trade.exitPrice,
        rejectedReason: null,
        positionId: null,
        createdAt: trade.exitTime,
        updatedAt: trade.exitTime,
        filledAt: trade.exitTime,
      }));

    const combinedOrders = [...orders, ...syntheticExitOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 500);

    return NextResponse.json(combinedOrders);
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

    // Validate LIMIT order price direction before doing any DB work
    if (orderType === 'LIMIT') {
      const currentLtp = typeof body.currentLtp === 'number' ? body.currentLtp : 0;
      if (currentLtp > 0 && price) {
        if (side === 'BUY' && price >= currentLtp) {
          return NextResponse.json(
            { error: `BUY LIMIT price (${Number(price).toFixed(2)}) must be below current market price (${currentLtp.toFixed(2)}). Lower your limit price so the order waits for the market to drop to it, or use a Market order to buy immediately.` },
            { status: 400 }
          );
        }
        if (side === 'SELL' && price <= currentLtp) {
          return NextResponse.json(
            { error: `SELL LIMIT price (${Number(price).toFixed(2)}) must be above current market price (${currentLtp.toFixed(2)}). Raise your limit price so the order waits for the market to rise to it, or use a Market order to sell immediately.` },
            { status: 400 }
          );
        }
      }
    }

    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { account, access } = context;

    if (!access.permissions.canPlaceOrder) {
      return NextResponse.json({ error: 'Order placement permission is disabled for this user' }, { status: 403 });
    }

    const userMaxOrderQty = Math.max(1, Math.floor(access.riskLimits.maxOrderQuantity));
    if (quantity > userMaxOrderQty) {
      return NextResponse.json(
        { error: `Order quantity exceeds user limit (${userMaxOrderQty})` },
        { status: 400 }
      );
    }

    const orderPriceForRisk = Number(price || 0);
    if (orderPriceForRisk > 0) {
      const notional = orderPriceForRisk * quantity;
      if (notional > access.riskLimits.maxOrderNotional) {
        return NextResponse.json(
          { error: `Order notional exceeds user limit (₹${Math.floor(access.riskLimits.maxOrderNotional).toLocaleString('en-IN')})` },
          { status: 400 }
        );
      }
    }

    const { start, end } = getISTDayBounds();
    const dailyPnL = await prisma.trade.aggregate({
      where: {
        accountId: account.id,
        exitTime: {
          gte: start,
          lte: end,
        },
      },
      _sum: { pnl: true },
    });
    const realizedToday = dailyPnL._sum.pnl ?? 0;
    if (realizedToday <= -Math.abs(access.riskLimits.maxDailyLoss)) {
      return NextResponse.json(
        { error: `Daily loss limit reached (₹${Math.floor(access.riskLimits.maxDailyLoss).toLocaleString('en-IN')})` },
        { status: 400 }
      );
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
    const rejectOrder = async (reason: string) => {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'REJECTED',
          rejectedReason: reason,
          filledPrice: null,
          filledAt: null,
        },
      });
      return NextResponse.json({ error: reason }, { status: 400 });
    };

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
          return rejectOrder(`Insufficient funds to average. Required: ₹${totalCostForAvg.toLocaleString()}, Available: ₹${Math.floor(availForAvg).toLocaleString()}`);
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
        const userMaxOpenPositions = Math.max(1, Math.floor(access.riskLimits.maxOpenPositions));
        const maxAllowedPositions = Math.min(DEFAULT_CONFIG.MAX_POSITIONS, userMaxOpenPositions);

        if (openPositions >= maxAllowedPositions) {
          return rejectOrder(`Maximum ${maxAllowedPositions} positions allowed for this user`);
        }

        const marginRequired = getQuickMargin(symbol, quantity, sideNum);
        const totalCost = marginRequired + (isOption && side === 'BUY' ? premium : 0);

        const availableBalance = account.balance - account.usedMargin;
        if (totalCost > availableBalance) {
          return rejectOrder(`Insufficient funds. Required: ₹${totalCost.toLocaleString()}, Available: ₹${Math.floor(availableBalance).toLocaleString()}`);
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
    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { account, access } = context;
    if (!access.permissions.canCancelOrder) {
      return NextResponse.json({ error: 'Order cancellation permission is disabled for this user' }, { status: 403 });
    }
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        accountId: account.id,
      },
    });
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
