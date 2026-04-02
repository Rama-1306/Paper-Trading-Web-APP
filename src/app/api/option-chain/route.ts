import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { FyersAPI } from '@/lib/broker/fyers';
import { getSharedFyersToken } from '@/lib/fyers-shared-token';
function getWsHttpBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';
  return raw.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://').replace(/\/$/, '');
}

async function fetchOptionChainFromWsProxy(symbol: string, strikeCount: number) {
  try {
    const wsBase = getWsHttpBaseUrl();
    const proxyUrl = `${wsBase}/option-chain?symbol=${encodeURIComponent(symbol)}&strikecount=${strikeCount}`;
    const response = await fetch(proxyUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data?.strikes)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'NSE:NIFTYBANK-INDEX';
    const strikeCount = parseInt(searchParams.get('strikecount') || '10');

    const cookieStore = await cookies();
    const token =
      cookieStore.get('fyers_access_token')?.value ||
      searchParams.get('token') ||
      (await getSharedFyersToken());

    if (!token) {
      const wsFallback = await fetchOptionChainFromWsProxy(symbol, strikeCount);
      if (wsFallback) {
        return NextResponse.json(wsFallback);
      }
      return NextResponse.json({ error: 'Fyers token not found' }, { status: 401 });
    }
    let data: any;
    try {
      const fyers = new FyersAPI(token);
      data = await fyers.getOptionChain(symbol, strikeCount);
    } catch (error) {
      const wsFallback = await fetchOptionChainFromWsProxy(symbol, strikeCount);
      if (wsFallback) {
        return NextResponse.json(wsFallback);
      }
      throw error;
    }

    const allOptions = data.data?.optionsChain || data.data?.options_chain || data.options_chain || [];

    let spotPrice = 0;
    let expiryDate = '';
    const options: any[] = [];

    for (const opt of allOptions) {
      if (opt.strike_price === -1 || opt.strike_price <= 0 || !opt.option_type || opt.option_type === '') {
        if (opt.ltp > 0) spotPrice = opt.ltp;
        continue;
      }
      options.push(opt);
    }

    if (!spotPrice && data.data?.underlying_ltp) {
      spotPrice = data.data.underlying_ltp;
    }

    const strikesMap: Record<number, any> = {};

    for (const opt of options) {
      const strike = opt.strike_price || opt.strikePrice;
      if (!strike || strike <= 0) continue;
      if (!strikesMap[strike]) {
        strikesMap[strike] = { strikePrice: strike };
      }

      const optType = (opt.option_type || opt.optionType || '').toUpperCase();
      const info = {
        symbol: opt.symbol || '',
        ltp: opt.ltp || 0,
        change: opt.ltpch || opt.ch || 0,
        changePercent: opt.ltpchp || opt.chp || 0,
        volume: opt.v || opt.volume || 0,
        oi: opt.oi || 0,
        prevOi: opt.prev_oi || opt.poi || 0,
        oiChange: opt.oich || 0,
        bid: opt.bid || 0,
        ask: opt.ask || 0,
      };

      if (optType === 'CE') {
        strikesMap[strike].ce = info;
      } else if (optType === 'PE') {
        strikesMap[strike].pe = info;
      }

      if (!expiryDate && opt.symbol) {
        const m = opt.symbol.match(/\d{2}[A-Z]{3}\d{2}/);
        if (m) expiryDate = m[0];
      }
    }

    const sortedStrikes = Object.values(strikesMap).sort((a: any, b: any) => a.strikePrice - b.strikePrice);
    const atmStrike = Math.round(spotPrice / 100) * 100;

    const expiryData = data.data?.expiryData;
    if (expiryData && Array.isArray(expiryData) && expiryData.length > 0) {
      expiryDate = expiryData[0]?.date || expiryData[0] || expiryDate;
    }

    return NextResponse.json({
      strikes: sortedStrikes,
      underlying: data.data?.underlying_symbol || symbol,
      spotPrice,
      atmStrike,
      expiry: expiryDate,
    });
  } catch (error: any) {
    console.error('Option Chain API Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
