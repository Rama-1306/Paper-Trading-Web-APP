import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getOrCreateAuthenticatedAccount } from '@/lib/account-context';

export async function GET() {
  try {
    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { account, access } = context;
    if (!access.permissions.canViewReports) {
      return NextResponse.json({ error: 'Report viewing permission is disabled for this user' }, { status: 403 });
    }

    const trades = await prisma.trade.findMany({
      where: { accountId: account.id },
      orderBy: { exitTime: 'desc' },
      take: 100,
    });

    return NextResponse.json(trades);
  } catch (error) {
    console.error('Trades GET error:', error);
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
    if (!access.permissions.canViewReports) {
      return NextResponse.json({ error: 'Report viewing permission is disabled for this user' }, { status: 403 });
    }
    const body = await request.json();
    const { tradeId, notes, screenshotUrl } = body;

    if (!tradeId) {
      return NextResponse.json({ error: 'tradeId required' }, { status: 400 });
    }

    const trade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        accountId: account.id,
      },
    });
    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;
    if (screenshotUrl !== undefined) updateData.screenshotUrl = screenshotUrl;

    const updated = await prisma.trade.update({
      where: { id: tradeId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Trades PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
