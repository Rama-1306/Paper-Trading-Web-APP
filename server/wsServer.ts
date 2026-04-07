import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

// Load .env first, then .env.local (Next.js convention) — later values win
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { fyersDataSocket } = require('fyers-api-v3');

const MARGIN_PER_LOT: Record<string, number> = {
  'BANKNIFTY': 55000, 'NIFTY': 85000, 'FINNIFTY': 38000, 'MIDCPNIFTY': 26000,
  'CRUDEOIL': 90000, 'CRUDEOILM': 28000, 'NATURALGAS': 65000, 'NATGAS': 65000,
  'GOLD': 190000, 'GOLDM': 19000, 'GOLDPETAL': 6000,
  'SILVER': 120000, 'SILVERM': 28000, 'SILVERMIC': 9000,
  'COPPER': 38000, 'ZINC': 55000, 'LEAD': 35000, 'ALUMINIUM': 48000, 'NICKEL': 65000,
};
const WS_LOT_SIZES: Record<string, number> = {
  'BANKNIFTY': 30, 'NIFTY': 75, 'FINNIFTY': 65, 'MIDCPNIFTY': 120,
  'CRUDEOIL': 100, 'CRUDEOILM': 10, 'NATURALGAS': 1250,
  'GOLD': 100, 'GOLDM': 10, 'GOLDPETAL': 100,
  'SILVER': 30, 'SILVERM': 5, 'SILVERMIC': 1,
  'COPPER': 2500, 'ZINC': 5000, 'LEAD': 5000, 'ALUMINIUM': 5000, 'NICKEL': 1500,
};
const OPT_SELL_MARGIN: Record<string, number> = {
  'BANKNIFTY': 48000, 'NIFTY': 75000, 'FINNIFTY': 32000, 'MIDCPNIFTY': 22000,
};

function wsExtractUnderlying(symbol: string): string {
  const clean = symbol.replace(/^(NSE:|MCX:|BSE:)/, '');
  for (const key of Object.keys(MARGIN_PER_LOT).sort((a, b) => b.length - a.length)) {
    if (clean.toUpperCase().startsWith(key.toUpperCase())) return key;
  }
  return clean.replace(/\d.*/, '');
}

function wsGetQuickMargin(symbol: string, qty: number, side: string): number {
  const underlying = wsExtractUnderlying(symbol);
  const lotSize = WS_LOT_SIZES[underlying.toUpperCase()] || 1;
  const lots = Math.max(1, Math.round(Math.abs(qty) / lotSize));
  const isOption = /\d+(CE|PE)$/i.test(symbol.replace(/^(NSE:|MCX:|BSE:)/, ''));
  if (isOption && side === 'BUY') return 0;
  if (isOption && side === 'SELL') {
    return (OPT_SELL_MARGIN[underlying.toUpperCase()] || 25000) * lots;
  }
  return (MARGIN_PER_LOT[underlying.toUpperCase()] || 25000) * lots;
}

const PORT = 3002;
const globalTickCache: Record<string, number> = {};

function sendJson(res: any, status: number, payload: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function toSafeInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function proxyHistoryFromSharedFeed(reqUrl: string, res: any) {
  try {
    const url = new URL(reqUrl, `http://localhost:${PORT}`);
    const symbol = url.searchParams.get('symbol') || 'NSE:NIFTYBANK-INDEX';
    const resolution = url.searchParams.get('resolution') || '5';
    const days = toSafeInt(url.searchParams.get('days'), 5, 1, 30);
    const appId = process.env.FYERS_APP_ID;
    const token = await ensurePrimaryBrokerTokenLoaded();

    if (!appId || !token) {
      return sendJson(res, 401, { error: 'Shared broker token not available' });
    }

    const nowSecs = Math.floor(Date.now() / 1000);
    const dateTo = nowSecs;
    const dateFrom = nowSecs - (days * 24 * 60 * 60);

    const response = await axios.get('https://api-t1.fyers.in/data/history', {
      headers: {
        Authorization: `${appId}:${token}`,
      },
      params: {
        symbol,
        resolution,
        date_format: '0',
        range_from: dateFrom,
        range_to: dateTo,
        cont_flag: '1',
      },
      timeout: 10000,
    });

    if (response.data?.s !== 'ok') {
      return sendJson(res, 400, { error: response.data?.message || 'Failed to fetch history' });
    }

    const candles = (response.data.candles || []).map((c: number[]) => ({
      time: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));

    return sendJson(res, 200, { candles, symbol, resolution });
  } catch (error: any) {
    console.error('WS history proxy error:', error.response?.data || error.message);
    return sendJson(res, 500, { error: 'Failed to fetch historical data' });
  }
}

async function proxyOptionChainFromSharedFeed(reqUrl: string, res: any) {
  try {
    const url = new URL(reqUrl, `http://localhost:${PORT}`);
    const symbol = url.searchParams.get('symbol') || 'NSE:NIFTYBANK-INDEX';
    const strikeCount = toSafeInt(url.searchParams.get('strikecount'), 10, 1, 50);
    const appId = process.env.FYERS_APP_ID;
    const token = await ensurePrimaryBrokerTokenLoaded();

    if (!appId || !token) {
      return sendJson(res, 401, { error: 'Shared broker token not available' });
    }

    const response = await axios.get('https://api-t1.fyers.in/data/options-chain-v3', {
      params: {
        symbol,
        strikecount: strikeCount,
        timestamp: '',
      },
      headers: {
        Authorization: `${appId}:${token}`,
      },
      timeout: 10000,
    });

    if (response.data?.s !== 'ok') {
      return sendJson(res, 400, { error: response.data?.message || 'Failed to fetch option chain' });
    }

    const data = response.data;
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

    return sendJson(res, 200, {
      strikes: sortedStrikes,
      underlying: data.data?.underlying_symbol || symbol,
      spotPrice,
      atmStrike,
      expiry: expiryDate,
    });
  } catch (error: any) {
    console.error('WS option-chain proxy error:', error.response?.data || error.message);
    return sendJson(res, 500, { error: 'Failed to fetch option chain' });
  }
}

const httpServer = createServer((req, res) => {
  const reqUrl = req.url;
  if (req.method === 'GET' && reqUrl?.startsWith('/history')) {
    void proxyHistoryFromSharedFeed(reqUrl, res);
    return;
  }
  if (req.method === 'GET' && reqUrl?.startsWith('/option-chain')) {
    void proxyOptionChainFromSharedFeed(reqUrl, res);
    return;
  }
  if (req.method === 'GET' && req.url?.startsWith('/ltp')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const symbol = url.searchParams.get('symbol');
    res.setHeader('Content-Type', 'application/json');
    if (symbol && globalTickCache[symbol] !== undefined) {
      res.end(JSON.stringify({ ltp: globalTickCache[symbol] }));
    } else {
      res.end(JSON.stringify({ ltp: null }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
});
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
});

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL || 'file:./prisma/dev.db' },
  },
});

const clients = new Map<string, { token: string | null; symbols: Set<string> }>();
const activeSymbols = new Set<string>();
let primaryBrokerToken: string | null = null;
let activeSocketToken: string | null = null;
let ensureSharedStatePromise: Promise<void> | null = null;

let skt: any = null;
let isProcessingOrders = false;
let fyersFeedLive = false;

function isFyersSocketConnected(): boolean {
  return fyersFeedLive;
}

function safelyCloseFyersSocket(instance: any) {
  if (!instance) return;
  try {
    if (typeof instance.close_connection === 'function') {
      instance.close_connection();
      return;
    }
  } catch {}
  try {
    if (typeof instance.disconnect === 'function') {
      instance.disconnect();
      return;
    }
  } catch {}
  try {
    if (typeof instance.close === 'function') {
      instance.close();
      return;
    }
  } catch {}
}

function resetFyersSocket(reason: string) {
  if (skt) {
    console.log(`♻️ Resetting Fyers socket (${reason})`);
    safelyCloseFyersSocket(skt);
  }
  skt = null;
  activeSocketToken = null;
}

async function ensureSharedBrokerStateTable(): Promise<void> {
  if (ensureSharedStatePromise) {
    return ensureSharedStatePromise;
  }

  ensureSharedStatePromise = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SharedBrokerState" (
      "provider" TEXT PRIMARY KEY,
      "accessToken" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).then(() => undefined);

  try {
    await ensureSharedStatePromise;
  } catch (error) {
    ensureSharedStatePromise = null;
    throw error;
  }
}

async function persistSharedBrokerToken(token: string) {
  const normalized = token?.trim();
  if (!normalized) return;
  await ensureSharedBrokerStateTable();
  await prisma.$executeRaw`
    INSERT INTO "SharedBrokerState" ("provider", "accessToken", "updatedAt")
    VALUES ('FYERS', ${normalized}, NOW())
    ON CONFLICT ("provider")
    DO UPDATE SET
      "accessToken" = EXCLUDED."accessToken",
      "updatedAt" = NOW()
  `;
}

async function loadPersistedSharedBrokerToken(): Promise<string | null> {
  await ensureSharedBrokerStateTable();
  const rows = await prisma.$queryRaw<Array<{ accessToken: string | null }>>`
    SELECT "accessToken"
    FROM "SharedBrokerState"
    WHERE "provider" = 'FYERS'
    LIMIT 1
  `;
  const token = rows[0]?.accessToken?.trim();
  return token && token.length > 0 ? token : null;
}

async function ensurePrimaryBrokerTokenLoaded(): Promise<string | null> {
  if (primaryBrokerToken) return primaryBrokerToken;
  try {
    primaryBrokerToken = await loadPersistedSharedBrokerToken();
  } catch (error) {
    console.error('Failed to load shared broker token:', error);
  }
  return primaryBrokerToken;
}

function initFyersSocket(token: string, forceReconnect = false) {
  const normalizedToken = token?.trim();
  if (!normalizedToken) return;

  const appId = process.env.FYERS_APP_ID;
  if (!appId) {
    console.error('❌ FYERS_APP_ID is missing in .env');
    return;
  }

  const sameToken = activeSocketToken === normalizedToken;
  const connected = isFyersSocketConnected();

  if (skt) {
    if (!forceReconnect && sameToken && connected) {
      return;
    }
    resetFyersSocket(forceReconnect ? 'forced reconnect' : (sameToken ? 'stale socket' : 'token rotation'));
  }

  const accessTokenFull = `${appId}:${normalizedToken}`;
  primaryBrokerToken = normalizedToken;
  activeSocketToken = normalizedToken;
  void persistSharedBrokerToken(normalizedToken).catch((error) => {
    console.error('Failed to persist shared broker token:', error);
  });
  console.log('🔑 Initializing Fyers Data Socket...');

  const fyersSocket = fyersDataSocket.getInstance(accessTokenFull);
  skt = fyersSocket;

  fyersSocket.on('connect', () => {
    console.log('🔗 Connected to Fyers Real-time Data WebSocket');
    skt = fyersSocket; // Reassign in case it was cleared after a previous close
    activeSocketToken = normalizedToken;
    fyersFeedLive = true;
    io.emit('feed_status', { live: true });

    if (activeSymbols.size > 0) {
      const syms = Array.from(activeSymbols);
      console.log('📡 Subscribing to:', syms);
      fyersSocket.subscribe(syms, false, 1);
      fyersSocket.mode(fyersSocket.FullMode, 1);
    }
  });

  fyersSocket.on('message', (message: any) => {
    const items = Array.isArray(message) ? message : [message];

    const ticks: any[] = [];
    items.forEach((item: any) => {
      if (!item || !item.symbol) return;

      ticks.push({
        symbol: item.symbol,
        ltp: item.ltp || 0,
        open: item.open_price || 0,
        high: item.high_price || 0,
        low: item.low_price || 0,
        close: item.prev_close_price || 0,
        change: item.ch || 0,
        changePercent: item.chp || 0,
        volume: item.vol_traded_today || 0,
        oi: item.oi || 0,
        timestamp: item.ltt || Math.floor(Date.now() / 1000),
      });
    });

    if (ticks.length > 0) {
      if (!fyersFeedLive) {
        fyersFeedLive = true;
        io.emit('feed_status', { live: true });
      }
      io.emit('ticks', ticks);
      processTicksForOrders(ticks);
    }
  });

  fyersSocket.on('error', (err: any) => {
    console.error('❌ Fyers WS Error:', err);
    fyersFeedLive = false;
    io.emit('feed_status', { live: false });
    const msg = String(err?.message || err || '').toLowerCase();
    const isAuthError =
      msg.includes('invalid') ||
      msg.includes('expired') ||
      msg.includes('unauthor') ||
      msg.includes('auth') ||
      msg.includes('token');
    if (isAuthError) {
      resetFyersSocket('authentication error');
    }
  });

  fyersSocket.on('close', () => {
    console.log('🔌 Fyers WS Closed — autoreconnect will retry');
    fyersFeedLive = false;
    io.emit('feed_status', { live: false });
    skt = null;
    activeSocketToken = null;
  });
  try {
    fyersSocket.connect();
    fyersSocket.autoreconnect();
  } catch (error) {
    console.error('Failed to start Fyers socket:', error);
    resetFyersSocket('startup failure');
  }
  fyersSocket.autoreconnect();
}

async function processTicksForOrders(ticks: any[]) {
  if (isProcessingOrders) return;
  isProcessingOrders = true;

  try {
    const tickMap: Record<string, number> = {};
    ticks.forEach(t => { tickMap[t.symbol] = t.ltp; globalTickCache[t.symbol] = t.ltp; });

    await processPositionSLTarget(tickMap);
    await processPendingOrders(tickMap);
  } catch (err) {
    console.error('Order processing error:', err);
  } finally {
    isProcessingOrders = false;
  }
}

async function processPositionSLTarget(tickMap: Record<string, number>) {
  const positions = await prisma.position.findMany({
    where: {
      isOpen: true,
      OR: [
        { stopLoss: { not: null } },
        { targetPrice: { not: null } },
        { trailingSL: true },
      ],
    },
  });

  for (const pos of positions) {
    const ltp = tickMap[pos.symbol];
    if (ltp === undefined || ltp <= 0) continue;

    if (pos.trailingSL && pos.trailingDistance && pos.trailingDistance > 0) {
      if (pos.side === 'BUY') {
        const newSL = ltp - pos.trailingDistance;
        if (!pos.stopLoss || newSL > pos.stopLoss) {
          await prisma.position.update({
            where: { id: pos.id },
            data: { stopLoss: newSL },
          });
          pos.stopLoss = newSL;
          io.emit('sl_updated', {
            accountId: pos.accountId,
            positionId: pos.id,
            symbol: pos.symbol,
            stopLoss: newSL,
            reason: 'TRAILING',
          });
        }
      } else {
        const newSL = ltp + pos.trailingDistance;
        if (!pos.stopLoss || newSL < pos.stopLoss) {
          await prisma.position.update({
            where: { id: pos.id },
            data: { stopLoss: newSL },
          });
          pos.stopLoss = newSL;
          io.emit('sl_updated', {
            accountId: pos.accountId,
            positionId: pos.id,
            symbol: pos.symbol,
            stopLoss: newSL,
            reason: 'TRAILING',
          });
        }
      }
    }

    let exitReason: string | null = null;

    if (pos.stopLoss) {
      if (pos.side === 'BUY' && ltp <= pos.stopLoss) {
        exitReason = 'SL_HIT';
      } else if (pos.side === 'SELL' && ltp >= pos.stopLoss) {
        exitReason = 'SL_HIT';
      }
    }

    if (!exitReason && pos.targetPrice) {
      if (pos.side === 'BUY' && ltp >= pos.targetPrice) {
        exitReason = 'TARGET_HIT';
      } else if (pos.side === 'SELL' && ltp <= pos.targetPrice) {
        exitReason = 'TARGET_HIT';
      }
    }

    if (exitReason) {
      // Partial exit: if target hit and targetQty < full position qty, only exit that portion
      if (exitReason === 'TARGET_HIT' && pos.targetQty && pos.targetQty > 0 && pos.targetQty < pos.quantity) {
        await partialCloseOnTarget(pos, ltp);
      } else {
        await closePosition(pos, ltp, exitReason);
      }
    }
  }
}

async function processPendingOrders(tickMap: Record<string, number>) {
  const pendingOrders = await prisma.order.findMany({
    where: { status: 'PENDING' },
  });

  for (const order of pendingOrders) {
    const ltp = tickMap[order.symbol];
    if (ltp === undefined || ltp <= 0) continue;

    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    if (orderAge < 2000) continue;

    let shouldFill = false;

    let fillPrice = ltp;

    if (order.orderType === 'LIMIT') {
      if (order.side === 'BUY' && order.price && ltp <= order.price) {
        // BUY LIMIT: fills when market is at or below the limit price.
        // Fill at the actual market price (ltp), which is always ≤ limit —
        // i.e. a better price than the limit the user specified.
        shouldFill = true;
        fillPrice = ltp;
      } else if (order.side === 'SELL' && order.price && ltp >= order.price) {
        // SELL LIMIT: fills when market is at or above the limit price.
        // Fill at the actual market price (ltp), which is always ≥ limit —
        // i.e. a better price than the limit the user specified.
        shouldFill = true;
        fillPrice = ltp;
      }
    }

    if (order.orderType === 'SL' || order.orderType === 'SL-M') {
      if (order.triggerPrice) {
        if (order.side === 'BUY' && ltp >= order.triggerPrice) {
          shouldFill = true;
          fillPrice = order.orderType === 'SL' && order.price ? order.price : ltp;
        } else if (order.side === 'SELL' && ltp <= order.triggerPrice) {
          shouldFill = true;
          fillPrice = order.orderType === 'SL' && order.price ? order.price : ltp;
        }
      }
    }

    if (shouldFill) {
      await fillPendingOrder(order, fillPrice);
    }
  }
}

async function partialCloseOnTarget(position: any, exitPrice: number) {
  try {
    const exitQty = position.targetQty as number;
    const pnl = position.side === 'BUY'
      ? (exitPrice - position.entryPrice) * exitQty
      : (position.entryPrice - exitPrice) * exitQty;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.position.findFirst({ where: { id: position.id, isOpen: true } });
      if (!current) return null;

      const marginPerUnit = current.marginUsed > 0 ? current.marginUsed / current.quantity : 0;
      const marginToRelease = marginPerUnit * exitQty;

      // Reduce position, clear targetPrice + targetQty so it won't trigger again
      await tx.position.update({
        where: { id: position.id },
        data: {
          quantity: current.quantity - exitQty,
          currentPrice: exitPrice,
          marginUsed: Math.max(0, current.marginUsed - marginToRelease),
          targetPrice: null,
          targetQty: null,
        },
      });

      await tx.trade.create({
        data: {
          accountId: position.accountId,
          symbol: position.symbol,
          displayName: position.displayName,
          side: position.side,
          quantity: exitQty,
          entryPrice: position.entryPrice,
          exitPrice,
          pnl,
          exitReason: 'TARGET_HIT',
          entryTime: position.createdAt,
        },
      });
      const exitSide = position.side === 'BUY' ? 'SELL' : 'BUY';
      await tx.order.create({
        data: {
          accountId: position.accountId,
          symbol: position.symbol,
          displayName: position.displayName,
          side: exitSide,
          orderType: 'MARKET',
          quantity: exitQty,
          price: exitPrice,
          status: 'FILLED',
          filledPrice: exitPrice,
          filledAt: new Date(),
          positionId: position.id,
        },
      });

      const isOption = position.instrumentType === 'CE' || position.instrumentType === 'PE';
      const balanceAdjust = isOption
        ? (position.side === 'BUY' ? exitPrice * exitQty : -(exitPrice * exitQty))
        : pnl;

      await tx.account.update({
        where: { id: position.accountId },
        data: {
          balance: { increment: balanceAdjust },
          realizedPnl: { increment: pnl },
          usedMargin: { decrement: Math.max(0, marginToRelease) },
        },
      });

      return true;
    });

    if (!result) {
      console.log(`⚠️ Position ${position.id} already closed, skipping partial target`);
      return;
    }

    const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);
    console.log(`🎯 Partial Target Hit: ${position.displayName} ${position.side} ${exitQty}/${position.quantity} qty @ ${exitPrice.toFixed(2)} | P&L: ${pnlStr}`);

    io.emit('position_closed', {
      accountId: position.accountId,
      positionId: position.id,
      symbol: position.symbol,
      displayName: position.displayName,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl,
      exitReason: 'TARGET_HIT',
      isPartial: true,
      exitQty,
      remainingQty: position.quantity - exitQty,
    });
  } catch (err) {
    console.error(`Failed to partial-close position ${position.id}:`, err);
  }
}

async function closePosition(position: any, exitPrice: number, exitReason: string) {
  try {
    const pnl = position.side === 'BUY'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.position.findFirst({
        where: { id: position.id, isOpen: true },
      });
      if (!current) return null;

      await tx.position.update({
        where: { id: position.id },
        data: {
          isOpen: false,
          currentPrice: exitPrice,
          pnl,
          exitReason,
          closedAt: new Date(),
        },
      });

      await tx.trade.create({
        data: {
          accountId: position.accountId,
          symbol: position.symbol,
          displayName: position.displayName,
          side: position.side,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          exitPrice,
          pnl,
          exitReason,
          entryTime: position.createdAt,
        },
      });
      const exitSide = position.side === 'BUY' ? 'SELL' : 'BUY';
      await tx.order.create({
        data: {
          accountId: position.accountId,
          symbol: position.symbol,
          displayName: position.displayName,
          side: exitSide,
          orderType: exitReason === 'SL_HIT' ? 'SL-M' : 'MARKET',
          quantity: position.quantity,
          price: exitPrice,
          status: 'FILLED',
          filledPrice: exitPrice,
          filledAt: new Date(),
          positionId: position.id,
        },
      });

      const isOption = position.instrumentType === 'CE' || position.instrumentType === 'PE';
      let balanceAdjust: number;
      if (isOption) {
        if (position.side === 'BUY') {
          balanceAdjust = exitPrice * position.quantity;
        } else {
          balanceAdjust = -(exitPrice * position.quantity);
        }
      } else {
        balanceAdjust = pnl;
      }

      await tx.account.update({
        where: { id: position.accountId },
        data: {
          balance: { increment: balanceAdjust },
          realizedPnl: { increment: pnl },
          usedMargin: { decrement: Math.max(0, position.marginUsed || wsGetQuickMargin(position.symbol, position.quantity, position.side)) },
        },
      });

      return true;
    });

    if (!result) {
      console.log(`⚠️ Position ${position.id} already closed, skipping`);
      return;
    }

    const reasonLabel = exitReason === 'SL_HIT' ? 'Stop Loss Hit' :
      exitReason === 'TARGET_HIT' ? 'Target Hit' : exitReason;

    console.log(`📍 ${reasonLabel}: ${position.displayName} ${position.side} @ ${exitPrice.toFixed(2)} | P&L: ${pnl.toFixed(2)}`);

    io.emit('position_closed', {
      accountId: position.accountId,
      positionId: position.id,
      symbol: position.symbol,
      displayName: position.displayName,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl,
      exitReason,
    });
  } catch (err) {
    console.error(`Failed to close position ${position.id}:`, err);
  }
}

async function fillPendingOrder(order: any, fillPrice: number) {
  try {
    let instrumentType = 'FUTURES';
    if (order.symbol.includes('CE')) instrumentType = 'CE';
    else if (order.symbol.includes('PE')) instrumentType = 'PE';

    const marginRequired = wsGetQuickMargin(order.symbol, order.quantity, order.side);

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({
        where: { id: order.id, status: 'PENDING' },
      });
      if (!current) return null;

      const isOption = instrumentType === 'CE' || instrumentType === 'PE';

      // --- Position netting: check for opposite-side position first ---
      const oppositeSide = order.side === 'BUY' ? 'SELL' : 'BUY';
      const oppositePosition = await tx.position.findFirst({
        where: { accountId: order.accountId, symbol: order.symbol, side: oppositeSide, isOpen: true },
      });

      if (oppositePosition) {
        const pnlPerUnit = order.side === 'BUY'
          ? oppositePosition.entryPrice - fillPrice
          : fillPrice - oppositePosition.entryPrice;
        const netQty = Math.min(order.quantity, oppositePosition.quantity);
        const pnl = pnlPerUnit * netQty;
        const marginPerUnit = oppositePosition.marginUsed > 0
          ? oppositePosition.marginUsed / oppositePosition.quantity : 0;
        const marginToRelease = marginPerUnit * netQty;

        if (netQty < oppositePosition.quantity) {
          await tx.position.update({
            where: { id: oppositePosition.id },
            data: {
              quantity: oppositePosition.quantity - netQty,
              currentPrice: fillPrice,
              marginUsed: Math.max(0, oppositePosition.marginUsed - marginToRelease),
            },
          });
        } else {
          await tx.position.update({
            where: { id: oppositePosition.id },
            data: { isOpen: false, currentPrice: fillPrice, pnl, marginUsed: 0, exitReason: 'NET_OFF', closedAt: new Date() },
          });
        }

        await tx.trade.create({
          data: {
            accountId: order.accountId,
            symbol: order.symbol,
            displayName: order.displayName,
            side: oppositeSide,
            quantity: netQty,
            entryPrice: oppositePosition.entryPrice,
            exitPrice: fillPrice,
            pnl,
            exitReason: 'NET_OFF',
            entryTime: oppositePosition.createdAt,
          },
        });

        await tx.account.update({
          where: { id: order.accountId },
          data: {
            balance: { increment: pnl },
            realizedPnl: { increment: pnl },
            usedMargin: { decrement: Math.max(0, marginToRelease) },
          },
        });

        let finalPositionId = oppositePosition.id;
        const remainingQty = order.quantity - netQty;
        if (remainingQty > 0) {
          const newMargin = wsGetQuickMargin(order.symbol, remainingQty, order.side);
          const newPos = await tx.position.create({
            data: {
              accountId: order.accountId,
              symbol: order.symbol,
              displayName: order.displayName,
              instrumentType,
              side: order.side,
              quantity: remainingQty,
              entryPrice: fillPrice,
              currentPrice: fillPrice,
              marginUsed: newMargin,
            },
          });
          await tx.account.update({
            where: { id: order.accountId },
            data: { usedMargin: { increment: newMargin } },
          });
          finalPositionId = newPos.id;
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'FILLED', filledPrice: fillPrice, filledAt: new Date(), positionId: finalPositionId },
        });

        return { positionId: finalPositionId, averaged: false, netted: true };
      }

      // --- Same-side: average or open new ---
      const existingPosition = await tx.position.findFirst({
        where: { accountId: order.accountId, symbol: order.symbol, side: order.side, isOpen: true },
      });

      let positionId: string;

      if (existingPosition) {
        const oldQty = existingPosition.quantity;
        const oldPrice = existingPosition.entryPrice;
        const newQty = oldQty + order.quantity;
        const avgPrice = (oldPrice * oldQty + fillPrice * order.quantity) / newQty;

        await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            quantity: newQty,
            entryPrice: avgPrice,
            currentPrice: fillPrice,
            marginUsed: (existingPosition.marginUsed || 0) + marginRequired,
          },
        });
        positionId = existingPosition.id;
      } else {
        const position = await tx.position.create({
          data: {
            accountId: order.accountId,
            symbol: order.symbol,
            displayName: order.displayName,
            instrumentType,
            side: order.side,
            quantity: order.quantity,
            entryPrice: fillPrice,
            currentPrice: fillPrice,
            marginUsed: marginRequired,
          },
        });
        positionId = position.id;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'FILLED',
          filledPrice: fillPrice,
          filledAt: new Date(),
          positionId,
        },
      });

      const premium = isOption ? fillPrice * order.quantity : 0;
      const balanceChange = isOption ? (order.side === 'BUY' ? -premium : premium) : 0;

      await tx.account.update({
        where: { id: order.accountId },
        data: {
          usedMargin: { increment: marginRequired },
          ...(balanceChange !== 0 ? { balance: { increment: balanceChange } } : {}),
        },
      });

      return { positionId, averaged: !!existingPosition, netted: false };
    });

    if (!result) {
      console.log(`⚠️ Order ${order.id} already filled/cancelled, skipping`);
      return;
    }

    const label = result.netted ? '✅ Order filled (netted)' : result.averaged ? '✅ Order filled (averaged)' : '✅ Order filled';
    console.log(`${label}: ${order.displayName} ${order.side} ${order.orderType} @ ${fillPrice.toFixed(2)}`);

    io.emit('order_filled', {
      accountId: order.accountId,
      orderId: order.id,
      positionId: result.positionId,
      symbol: order.symbol,
      displayName: order.displayName,
      side: order.side,
      orderType: order.orderType,
      fillPrice,
      quantity: order.quantity,
      averaged: result.averaged,
    });

    activeSymbols.add(order.symbol);
    handleSymbolSync();
  } catch (err) {
    console.error(`Failed to fill order ${order.id}:`, err);
  }
}

function handleSymbolSync() {
  if (!skt || !isFyersSocketConnected()) return;

  const syms = Array.from(activeSymbols);
  if (syms.length > 0) {
    console.log('📡 Subscribing to:', syms);
    skt.subscribe(syms, false, 1);
    skt.mode(skt.FullMode, 1);
  }
}

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  const rawToken = socket.handshake.auth?.token;
  const token = typeof rawToken === 'string' && rawToken.trim() ? rawToken.trim() : null;

  clients.set(socket.id, { token, symbols: new Set() });
  socket.emit('authenticated', { success: true, sharedFeed: !token });
  // Tell this client immediately whether the Fyers feed is currently live
  socket.emit('feed_status', { live: isFyersSocketConnected() });

  // IMPORTANT: Register ALL socket event handlers synchronously before any async
  // work. If handlers are registered after an await, events sent by the client
  // immediately on connect (e.g. 'subscribe') arrive before the handler exists
  // and are silently dropped — breaking live feed for user accounts.

  socket.on('subscribe', (symbols: string[]) => {
    const client = clients.get(socket.id);
    if (!client) return;

    symbols.forEach(s => {
      client.symbols.add(s);
      activeSymbols.add(s);
    });

    console.log(`📊 Client ${socket.id} subscribed to: ${symbols.join(', ')}`);
    socket.emit('subscribed', Array.from(client.symbols));

    // If feed is already live just sync symbols; otherwise try to start it.
    if (isFyersSocketConnected()) {
      handleSymbolSync();
    } else {
      const tokenForFeed = token || primaryBrokerToken;
      if (tokenForFeed) {
        initFyersSocket(tokenForFeed, !!token);
      } else {
        // Token not in memory yet — load from DB then start feed
        void ensurePrimaryBrokerTokenLoaded().then((persisted) => {
          if (persisted && !isFyersSocketConnected()) {
            initFyersSocket(persisted);
          } else {
            handleSymbolSync();
          }
        });
      }
    }
  });

  socket.on('unsubscribe', (symbols: string[]) => {
    const client = clients.get(socket.id);
    if (!client) return;
    symbols.forEach(s => client.symbols.delete(s));

    activeSymbols.clear();
    clients.forEach(c => c.symbols.forEach(s => activeSymbols.add(s)));

    // Only unsubscribe from Fyers for symbols no other client still needs.
    // Without this check, switching the chart symbol would drop position symbols
    // from the Fyers feed even though other clients (or the same client's positions)
    // still require them.
    const orphaned = symbols.filter(s => !activeSymbols.has(s));
    if (skt && isFyersSocketConnected() && orphaned.length > 0) {
      skt.unsubscribe(orphaned, false, 1);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    clients.delete(socket.id);

    activeSymbols.clear();
    clients.forEach(c => c.symbols.forEach(s => activeSymbols.add(s)));
  });

  // Async broker/token setup — runs after handlers are registered so no events are lost.
  if (token) {
    void persistSharedBrokerToken(token).catch((error) => {
      console.error('Failed to persist shared broker token:', error);
    });
    initFyersSocket(token, true);
  } else {
    void ensurePrimaryBrokerTokenLoaded().then((persistedToken) => {
      if (persistedToken && !isFyersSocketConnected()) {
        initFyersSocket(persistedToken);
      }
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Fyers Live Data Server running on ws://localhost:${PORT}`);
  console.log(`   FYERS_APP_ID:   ${process.env.FYERS_APP_ID ? '✅ loaded' : '❌ missing — set in .env or .env.local'}`);
  console.log(`   DATABASE_URL:   ${process.env.DATABASE_URL ? '✅ loaded' : '❌ missing'}`);
});

void ensurePrimaryBrokerTokenLoaded().then((token) => {
  if (token) {
    console.log('🔑 Loaded shared broker token from DB');
    initFyersSocket(token);
  }
});
