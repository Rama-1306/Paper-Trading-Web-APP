import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/account — Get or create default account
export async function GET() {
  try {
    let account = await prisma.account.findFirst({
      include: {
        positions: { where: { isOpen: true } },
        _count: {
          select: {
            orders: { where: { status: 'PENDING' } },
          },
        },
      },
    });

    if (!account) {
      account = await prisma.account.create({
        data: {
          name: 'Default',
          balance: parseFloat(process.env.NEXT_PUBLIC_STARTING_CAPITAL || '1000000'),
          initialBalance: parseFloat(process.env.NEXT_PUBLIC_STARTING_CAPITAL || '1000000'),
        },
        include: {
          positions: { where: { isOpen: true } },
          _count: {
            select: {
              orders: { where: { status: 'PENDING' } },
            },
          },
        },
      });
    }

    // Calculate unrealized P&L from open positions
    const unrealizedPnl = account.positions.reduce(
      (sum, pos) => sum + pos.pnl,
      0
    );

    return NextResponse.json({
      id: account.id,
      name: account.name,
      balance: account.balance,
      initialBalance: account.initialBalance,
      usedMargin: account.usedMargin,
      availableMargin: account.balance - account.usedMargin,
      realizedPnl: account.realizedPnl,
      unrealizedPnl,
      totalPnl: account.realizedPnl + unrealizedPnl,
      totalPnlPercent:
        ((account.realizedPnl + unrealizedPnl) / account.initialBalance) * 100,
      todayPnl: 0, // TODO: calculate today's P&L
      winRate: 0,   // TODO: calculate from trades
      totalTrades: 0,
    });
  } catch (error) {
    console.error('Account API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/account — Reset account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'reset') {
      const account = await prisma.account.findFirst();
      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      // Close all positions
      await prisma.position.updateMany({
        where: { accountId: account.id, isOpen: true },
        data: { isOpen: false, closedAt: new Date() },
      });

      // Cancel pending orders
      await prisma.order.updateMany({
        where: { accountId: account.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      // Reset balance
      const startingCapital = parseFloat(process.env.NEXT_PUBLIC_STARTING_CAPITAL || '1000000');
      await prisma.account.update({
        where: { id: account.id },
        data: {
          balance: startingCapital,
          usedMargin: 0,
          realizedPnl: 0,
        },
      });

      return NextResponse.json({ success: true, message: 'Account reset' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Account reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
