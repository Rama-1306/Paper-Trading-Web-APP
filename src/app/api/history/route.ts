import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getSharedFyersToken } from '@/lib/fyers-shared-token';
function getWsHttpBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';
  return raw.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://').replace(/\/$/, '');
}

async function fetchHistoryFromWsProxy(symbol: string, resolution: string, days: number) {
  try {
    const wsBase = getWsHttpBaseUrl();
    const proxyUrl = `${wsBase}/history?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&days=${days}`;
    const response = await fetch(proxyUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data?.candles)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

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
      token = await getSharedFyersToken();
    }

    // Calculate date range in epoch seconds
    const nowSecs = Math.floor(Date.now() / 1000);
    const dateTo = nowSecs;
    const dateFrom = nowSecs - (days * 24 * 60 * 60);

    const appId = process.env.FYERS_APP_ID;
    if (!appId || !token) {
      const wsFallback = await fetchHistoryFromWsProxy(symbol, resolution, days);
      if (wsFallback) {
        return NextResponse.json(wsFallback);
      }
      return NextResponse.json({ error: 'Missing API credentials or token' }, { status: 401 });
    }
    let response;
    try {
      response = await axios.get('https://api-t1.fyers.in/data/history', {
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
    } catch (error) {
      const wsFallback = await fetchHistoryFromWsProxy(symbol, resolution, days);
      if (wsFallback) {
        return NextResponse.json(wsFallback);
      }
      throw error;
    }

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
