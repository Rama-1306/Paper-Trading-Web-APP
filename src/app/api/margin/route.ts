import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { getMarginRequired, getQuickMargin, type MarginPosition } from '@/lib/utils/margins';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, qty, side, includeExisting } = body;

    if (!symbol || !qty || !side) {
      return NextResponse.json(
        { error: 'Missing required fields: symbol, qty, side' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    let token = searchParams.get('token');
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('fyers_access_token')?.value || null;
    }
    const appId = process.env.FYERS_APP_ID || null;

    const positions: MarginPosition[] = [
      { symbol, qty: Math.abs(qty), side: side === 'BUY' ? 1 : -1 },
    ];

    if (includeExisting) {
      const account = await prisma.account.findFirst();
      if (account) {
        const openPositions = await prisma.position.findMany({
          where: { accountId: account.id, isOpen: true },
        });

        for (const pos of openPositions) {
          positions.push({
            symbol: pos.symbol,
            qty: pos.quantity,
            side: pos.side === 'BUY' ? 1 : -1,
          });
        }
      }
    }

    const result = await getMarginRequired(positions, token, appId);

    const newOrderMargin = getQuickMargin(
      symbol,
      Math.abs(qty),
      side === 'BUY' ? 1 : -1
    );

    return NextResponse.json({
      ...result,
      newOrderMargin,
      positions: positions.length,
    });
  } catch (error) {
    console.error('Margin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const qty = parseInt(searchParams.get('qty') || '0');
    const side = searchParams.get('side') || 'BUY';

    if (!symbol || !qty) {
      return NextResponse.json(
        { error: 'Missing required params: symbol, qty' },
        { status: 400 }
      );
    }

    const margin = getQuickMargin(symbol, qty, side === 'BUY' ? 1 : -1);

    return NextResponse.json({
      margin,
      symbol,
      qty,
      side,
      source: 'fallback',
    });
  } catch (error) {
    console.error('Margin GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
