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
      const errMsg = response.data?.message || response.data?.errmsg || 'No depth data available';
      console.warn('Market depth: bad Fyers response:', response.data);
      return NextResponse.json({ error: errMsg }, { status: 404 });
    }

    // Fyers returns d[symbol] — try exact key, then case-insensitive, then first value
    let depthData = response.data.d[symbol];
    if (!depthData) {
      const keys = Object.keys(response.data.d);
      const matchKey = keys.find(k => k.toUpperCase() === symbol.toUpperCase());
      depthData = matchKey ? response.data.d[matchKey] : (keys.length > 0 ? response.data.d[keys[0]] : null);
    }

    if (!depthData) {
      return NextResponse.json({ error: 'Symbol not found in depth response' }, { status: 404 });
    }

    return NextResponse.json({
      symbol,
      bids: (depthData.bids || depthData.Bids || []).slice(0, 5).map((b: any) => ({
        price: b.price ?? b.Price ?? 0,
        qty: b.qty ?? b.Qty ?? b.volume ?? 0,
        orders: b.orders ?? b.Orders ?? 0,
      })),
      asks: (depthData.asks || depthData.Asks || depthData.offer || []).slice(0, 5).map((a: any) => ({
        price: a.price ?? a.Price ?? 0,
        qty: a.qty ?? a.Qty ?? a.volume ?? 0,
        orders: a.orders ?? a.Orders ?? 0,
      })),
      totalBuyQty: depthData.totalbuyqty ?? depthData.totalBuyQty ?? 0,
      totalSellQty: depthData.totalsellqty ?? depthData.totalSellQty ?? 0,
    });
  } catch (err: any) {
    console.error('Market depth error:', err?.response?.data || err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch market depth' }, { status: 500 });
  }
}
