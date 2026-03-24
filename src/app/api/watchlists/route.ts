import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const account = await prisma.account.findFirst();
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const watchlists = await prisma.watchlist.findMany({
      where: { accountId: account.id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(watchlists);
  } catch (error) {
    console.error('Watchlists GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const watchlist = await prisma.watchlist.create({
      data: {
        name: name.trim(),
        accountId: account.id,
      },
      include: { items: true },
    });

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error('Watchlists POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { watchlistId, name, addSymbol, addDisplayName, removeItemId } = body;

    if (!watchlistId) {
      return NextResponse.json({ error: 'watchlistId required' }, { status: 400 });
    }

    if (name !== undefined) {
      await prisma.watchlist.update({
        where: { id: watchlistId },
        data: { name: name.trim() },
      });
    }

    if (addSymbol) {
      const existing = await prisma.watchlistItem.findFirst({
        where: { watchlistId, symbol: addSymbol },
      });
      if (!existing) {
        await prisma.watchlistItem.create({
          data: {
            watchlistId,
            symbol: addSymbol,
            displayName: addDisplayName || addSymbol,
          },
        });
      }
    }

    if (removeItemId) {
      await prisma.watchlistItem.delete({
        where: { id: removeItemId },
      });
    }

    const updated = await prisma.watchlist.findUnique({
      where: { id: watchlistId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Watchlists PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { watchlistId } = body;

    if (!watchlistId) {
      return NextResponse.json({ error: 'watchlistId required' }, { status: 400 });
    }

    await prisma.watchlist.delete({
      where: { id: watchlistId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watchlists DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
