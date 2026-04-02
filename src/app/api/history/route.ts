import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getSharedFyersToken } from '@/lib/fyers-shared-token';

// GET /api/history?symbol=NSE:NIFTYBANK-INDEX&resolution=5&days=5
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'NSE:NIFTYBANK-INDEX';
    const resolution = searchParams.get('resolution') || '5';
    const days = parseInt(searchParams.get('days') || '5');

    // Read token from cookie or query
    let token = searchParams.get('token');
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('fyers_access_token')?.value || null;
    }
    if (!token) {
      token = getSharedFyersToken();
    }

    // Calculate date range in epoch seconds
    const nowSecs = Math.floor(Date.now() / 1000);
    const dateTo = nowSecs;
    const dateFrom = nowSecs - (days * 24 * 60 * 60);

    const appId = process.env.FYERS_APP_ID;
    if (!appId || !token) {
      return NextResponse.json({ error: 'Missing API credentials or token' }, { status: 401 });
    }

    const response = await axios.get('https://api-t1.fyers.in/data/history', {
      headers: {
        Authorization: `${appId}:${token}`,
      },
      params: {
        symbol,
        resolution,
        date_format: '0', // 0 = epoch timestamp
        range_from: dateFrom,
        range_to: dateTo,
        cont_flag: '1',
      },
    });

    if (response.data?.s !== 'ok') {
      return NextResponse.json({ error: response.data?.message || 'Failed to fetch history' }, { status: 400 });
    }

    // Fyers returns candles as: [[timestamp, open, high, low, close, volume], ...]
    const candles = (response.data.candles || []).map((c: number[]) => ({
      time: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));

    return NextResponse.json({ candles, symbol, resolution });
  } catch (error: any) {
    console.error('History API Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch historical data' }, { status: 500 });
  }
}
