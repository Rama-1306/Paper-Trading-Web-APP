import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol');
  const token = searchParams.get('token');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const appId = process.env.FYERS_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: 'Fyers not configured' }, { status: 500 });
  }

  try {
    const response = await axios.get('https://api-t1.fyers.in/api/v3/depth', {
      params: { symbol, ohlcv_flag: 1 },
      headers: {
        Authorization: `${appId}:${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    if (response.data?.s !== 'ok' || !response.data?.d) {
      return NextResponse.json({ error: 'No depth data available' }, { status: 404 });
    }

    const depthData = response.data.d[symbol];
    if (!depthData) {
      return NextResponse.json({ error: 'Symbol not found in response' }, { status: 404 });
    }

    return NextResponse.json({
      symbol,
      bids: (depthData.bids || []).slice(0, 5).map((b: any) => ({
        price: b.price,
        qty: b.qty,
        orders: b.orders,
      })),
      asks: (depthData.asks || []).slice(0, 5).map((a: any) => ({
        price: a.price,
        qty: a.qty,
        orders: a.orders,
      })),
      totalBuyQty: depthData.totalbuyqty || 0,
      totalSellQty: depthData.totalsellqty || 0,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch market depth' }, { status: 500 });
  }
}
