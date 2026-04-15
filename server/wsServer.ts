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

// Railway (and most PaaS) inject the public-facing port via process.env.PORT.
// Hardcoding 3002 means the platform router cannot reach the service in prod.
const PORT = Number(process.env.PORT) || 3002;
const HOST = '0.0.0.0';
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
let lastTickReceivedAt = 0; // epoch ms — updated on every Fyers message with real ticks
let fyersSocketInitializing = false; // true between skt=fyersSocket and the first connect/error/close
let lastFyersResetAt = 0; // epoch ms — timestamp of most recent resetFyersSocket, used to suppress watchdog thrash
let intentionalClose = false; // set true right before we close the socket ourselves so the 'close' handler doesn't re-trigger reconnect
// Backoff state for managed reconnect after auth/network errors.
// Reset to 0 on every successful Fyers `connect`.
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

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
    intentionalClose = true;
    safelyCloseFyersSocket(skt);
  }
  skt = null;
  activeSocketToken = null;
  fyersSocketInitializing = false;
  lastFyersResetAt = Date.now();
}

// Reload the latest token from PostgreSQL (bypassing the in-memory cache),
// then reconnect Fyers with it. Used after auth errors, on close, and by
// the periodic poller. Schedules a retry with exponential backoff if no
// fresh token is available yet (e.g. user hasn't re-logged in).
async function refreshTokenAndReconnect(reason: string): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const fresh = await loadFreshSharedBrokerToken();
  if (!fresh) {
    reconnectAttempts += 1;
    const delayMs = Math.min(60_000, 2_000 * Math.pow(2, Math.min(reconnectAttempts, 5)));
    console.warn(`⚠️ Token refresh (${reason}): no token in DB. Retrying in ${delayMs}ms (attempt ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      void refreshTokenAndReconnect(reason);
    }, delayMs);
    return;
  }

  // If the DB token matches the one we're already using AND the feed is healthy,
  // there's nothing to do. Otherwise force a reconnect.
  if (fresh === activeSocketToken && isFyersSocketConnected()) {
    reconnectAttempts = 0;
    return;
  }

  console.log(`🔄 Token refresh (${reason}): reconnecting Fyers with fresh DB token`);
  initFyersSocket(fresh, true);
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

// Always hits the DB — bypasses the in-memory cache so refresh paths
// (token expiry, periodic poller, post-error reconnect) see the latest
// token written by the Next.js callback after a re-login.
async function loadFreshSharedBrokerToken(): Promise<string | null> {
  try {
    const fresh = await loadPersistedSharedBrokerToken();
    if (fresh) primaryBrokerToken = fresh;
    return fresh;
  } catch (error) {
    console.error('Failed to load fresh shared broker token:', error);
    return null;
  }
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

  // In-flight guard: if an init is already in progress with the same token and
  // we aren't forcing a reconnect, let the existing attempt complete instead of
  // killing it. Without this, rapid successive subscribe() calls each spawn a
  // fresh socket and reset the previous one mid-handshake, so the feed never
  // stabilizes and no ticks ever arrive.
  if (fyersSocketInitializing && skt && sameToken && !forceReconnect) {
    return;
  }

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
  fyersSocketInitializing = true;
  intentionalClose = false;

  fyersSocket.on('connect', () => {
    console.log('🔗 Connected to Fyers Real-time Data WebSocket');
    skt = fyersSocket; // Reassign in case it was cleared after a previous close
    activeSocketToken = normalizedToken;
    fyersFeedLive = true;
    fyersSocketInitializing = false;
    lastTickReceivedAt = Date.now(); // seed watchdog baseline at connect so staleness is measured from now
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
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

    // Fyers occasionally surfaces auth failures (codes -15 / -16) as data
    // messages instead of error events. Detect them here so we still kick
    // off the DB-token refresh path.
    for (const item of items) {
      const code = typeof item?.code === 'number' ? item.code : null;
      const status = typeof item?.s === 'string' ? item.s.toLowerCase() : '';
      if (code === -15 || code === -16 || status === 'error') {
        console.error('❌ Fyers auth error in message stream:', item);
        fyersFeedLive = false;
        io.emit('feed_status', { live: false });
        resetFyersSocket(`auth error code ${code ?? status}`);
        void refreshTokenAndReconnect('message auth error');
        return;
      }
    }

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
      lastTickReceivedAt = Date.now();
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
    fyersSocketInitializing = false;
    io.emit('feed_status', { live: false });
    const code = typeof err?.code === 'number' ? err.code : null;
    const msg = String(err?.message || err || '').toLowerCase();
    const isAuthError =
      code === -15 || code === -16 ||
      msg.includes('invalid') ||
      msg.includes('expired') ||
      msg.includes('unauthor') ||
      msg.includes('auth') ||
      msg.includes('token') ||
      msg.includes('-15') ||
      msg.includes('-16');
    if (isAuthError) {
      // Don't trust the in-memory token any more — reload from DB.
      // The Next.js callback writes the new token there on every re-login.
      resetFyersSocket('authentication error');
      void refreshTokenAndReconnect('auth error');
    }
  });

  fyersSocket.on('close', () => {
    const wasIntentional = intentionalClose;
    intentionalClose = false;
    fyersFeedLive = false;
    fyersSocketInitializing = false;
    io.emit('feed_status', { live: false });
    skt = null;
    activeSocketToken = null;
    if (wasIntentional) {
      // We closed the socket ourselves (via resetFyersSocket). The caller is
      // responsible for the next step — do NOT recursively refresh here or
      // we stack duplicate reconnects on top of the caller's own reconnect.
      console.log('🔌 Fyers WS Closed (intentional) — caller will reconnect');
      return;
    }
    console.log('🔌 Fyers WS Closed — refreshing token from DB and reconnecting');
    // Unexpected close: reload token from DB (covers rotation while connected).
    void refreshTokenAndReconnect('socket close');
  });
  try {
    fyersSocket.connect();
  } catch (error) {
    console.error('Failed to start Fyers socket:', error);
    resetFyersSocket('startup failure');
    void refreshTokenAndReconnect('startup failure');
  }
}

async function processTicksForOrders(ticks: any[]) {
  if (isProcessingOrders) return;
  isProcessingOrders = true;

  try {
    const tickMap: Record<string, number> = {};
    ticks.forEach(t => { tickMap[t.symbol] = t.ltp; globalTickCache[t.symbol] = t.ltp; });

    // Reap any position whose quantity has hit zero BEFORE evaluating SL/
    // target or firing pending orders. Without this, an orphaned SL on a
    // zero-qty position can fire and create a phantom new opposite-side
    // position when fillPendingOrder falls through to the same-side branch.
    await reapAllZeroQtyPositions(tickMap);

    await processPositionSLTarget(tickMap);
    await processPendingOrders(tickMap);
  } catch (err) {
    console.error('Order processing error:', err);
  } finally {
    isProcessingOrders = false;
  }
}

// Atomically close a position whose quantity has reached 0 (or below)
// and cancel every pending exit order tied to it. Used as a safety reaper
// so orphaned SL/target orders can never fire against a zero-qty position
// and create a phantom new position on the opposite side.
async function reapZeroQtyPosition(positionId: string, exitPrice: number, reason = 'ZERO_QTY_REAPED') {
  try {
    const closed = await prisma.$transaction(async (tx) => {
      const current = await tx.position.findFirst({
        where: { id: positionId, isOpen: true },
      });
      if (!current) return null;
      if (current.quantity > 0) return null;

      await tx.position.update({
        where: { id: positionId },
        data: {
          isOpen: false,
          currentPrice: exitPrice || current.currentPrice || current.entryPrice,
          pnl: 0,
          marginUsed: 0,
          stopLoss: null,
          targetPrice: null,
          target2: null,
          target3: null,
          targetQty: null,
          trailingSL: false,
          exitReason: reason,
          closedAt: new Date(),
        },
      });

      const cancelled = await tx.order.updateMany({
        where: {
          positionId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          rejectedReason: 'Position reached zero quantity',
        },
      });

      return { current, cancelledCount: cancelled.count };
    });

    if (closed) {
      console.log(
        `🧹 Reaped zero-qty position ${closed.current.displayName || closed.current.symbol} ` +
        `(${closed.current.side}) — cancelled ${closed.cancelledCount} pending order(s)`
      );
      io.emit('position_closed', {
        accountId: closed.current.accountId,
        positionId,
        symbol: closed.current.symbol,
        displayName: closed.current.displayName,
        side: closed.current.side,
        entryPrice: closed.current.entryPrice,
        exitPrice: exitPrice || closed.current.currentPrice || closed.current.entryPrice,
        pnl: 0,
        exitReason: reason,
      });
    }
  } catch (err) {
    console.error(`Failed to reap zero-qty position ${positionId}:`, err);
  }
}

// Sweep all open positions whose quantity has hit zero. Called from the
// tick loop so any bad state created by races in the order/position routes
// is cleaned up before SL/target evaluation runs.
async function reapAllZeroQtyPositions(tickMap: Record<string, number>) {
  const empties = await prisma.position.findMany({
    where: { isOpen: true, quantity: { lte: 0 } },
    select: { id: true, symbol: true, currentPrice: true, entryPrice: true },
  });
  for (const p of empties) {
    const lastPrice =
      tickMap[p.symbol] ?? p.currentPrice ?? p.entryPrice ?? 0;
    await reapZeroQtyPosition(p.id, lastPrice);
  }
}

async function processPositionSLTarget(tickMap: Record<string, number>) {
  const positions = await prisma.position.findMany({
    where: {
      isOpen: true,
      quantity: { gt: 0 },
      OR: [
        { stopLoss: { not: null } },
        { targetPrice: { not: null } },
        { trailingSL: true },
      ],
    },
  });
  const pendingLinkedExitOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      positionId: { not: null },
      orderType: { in: ['LIMIT', 'SL', 'SL-M'] },
    },
    select: { positionId: true },
  });
  const positionsWithPendingExits = new Set(
    pendingLinkedExitOrders
      .map((o) => o.positionId)
      .filter((positionId): positionId is string => !!positionId)
  );

  for (const pos of positions) {
    if (positionsWithPendingExits.has(pos.id)) continue;
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

  // Pre-pass: any pending order whose linked position is closed or has
  // quantity ≤ 0 must be cancelled before we even consider firing it.
  // The reaper will normally have done this, but a pending order created
  // late (after the reaper ran but before this fire-pass) would otherwise
  // execute against missing position state and create a phantom new position.
  const linkedPositionIds = Array.from(
    new Set(
      pendingOrders
        .map((o) => o.positionId)
        .filter((id): id is string => !!id)
    )
  );
  if (linkedPositionIds.length > 0) {
    const linkedPositions = await prisma.position.findMany({
      where: { id: { in: linkedPositionIds } },
      select: { id: true, isOpen: true, quantity: true },
    });
    const invalidPositionIds = new Set(
      linkedPositions
        .filter((p) => !p.isOpen || p.quantity <= 0)
        .map((p) => p.id)
    );
    // Also treat orders whose linked position vanished from the DB as invalid.
    const knownIds = new Set(linkedPositions.map((p) => p.id));
    for (const id of linkedPositionIds) {
      if (!knownIds.has(id)) invalidPositionIds.add(id);
    }
    if (invalidPositionIds.size > 0) {
      const cancelled = await prisma.order.updateMany({
        where: {
          status: 'PENDING',
          positionId: { in: Array.from(invalidPositionIds) },
        },
        data: {
          status: 'CANCELLED',
          rejectedReason: 'Linked position has no quantity remaining',
        },
      });
      if (cancelled.count > 0) {
        console.log(`🧹 Cancelled ${cancelled.count} pending order(s) tied to closed/zero-qty positions`);
      }
    }
  }

  // SL/SL-M orders must fire before LIMIT (target) orders for the same position.
  // This ensures a stop always takes priority over a profit target when both
  // trigger on the same price bar.
  pendingOrders.sort((a, b) => {
    const aIsSL = a.orderType === 'SL' || a.orderType === 'SL-M';
    const bIsSL = b.orderType === 'SL' || b.orderType === 'SL-M';
    if (aIsSL && !bIsSL) return -1;
    if (!aIsSL && bIsSL) return 1;
    return 0;
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
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.position.findFirst({ where: { id: position.id, isOpen: true } });
      if (!current) return null;

      // Cap exit qty at the *fresh* remaining quantity. Reading from
      // `current` (not the stale `position` snapshot) prevents leaving
      // the position at quantity = 0 with isOpen = true when another
      // partial close raced ahead of us.
      const requestedExitQty = Math.max(0, Number(position.targetQty) || 0);
      const exitQty = Math.min(requestedExitQty, current.quantity);
      if (exitQty <= 0) return null;

      const pnl = current.side === 'BUY'
        ? (exitPrice - current.entryPrice) * exitQty
        : (current.entryPrice - exitPrice) * exitQty;

      const marginPerUnit = current.marginUsed > 0 ? current.marginUsed / current.quantity : 0;
      const marginToRelease = marginPerUnit * exitQty;
      const remainingQty = current.quantity - exitQty;
      const fullyClosed = remainingQty <= 0;

      if (fullyClosed) {
        // Promoted to a full close — set isOpen=false and cancel any other
        // pending exit orders so an orphaned SL can never fire later.
        await tx.position.update({
          where: { id: position.id },
          data: {
            quantity: 0,
            isOpen: false,
            currentPrice: exitPrice,
            pnl,
            marginUsed: 0,
            stopLoss: null,
            targetPrice: null,
            target2: null,
            target3: null,
            targetQty: null,
            trailingSL: false,
            exitReason: 'TARGET_HIT',
            closedAt: new Date(),
          },
        });
        await tx.order.updateMany({
          where: { positionId: position.id, status: 'PENDING' },
          data: { status: 'CANCELLED', rejectedReason: 'Position fully closed by target' },
        });
      } else {
        // Reduce position, clear targetPrice + targetQty so it won't trigger again
        await tx.position.update({
          where: { id: position.id },
          data: {
            quantity: remainingQty,
            currentPrice: exitPrice,
            marginUsed: Math.max(0, current.marginUsed - marginToRelease),
            targetPrice: null,
            targetQty: null,
          },
        });
      }

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

      return { pnl, exitQty, remainingQty, fullyClosed };
    });

    if (!result) {
      console.log(`⚠️ Position ${position.id} already closed or empty, skipping partial target`);
      return;
    }

    const pnlStr = result.pnl >= 0 ? `+${result.pnl.toFixed(2)}` : result.pnl.toFixed(2);
    const label = result.fullyClosed ? '🎯 Final Target Hit (full close)' : '🎯 Partial Target Hit';
    console.log(`${label}: ${position.displayName} ${position.side} ${result.exitQty} qty @ ${exitPrice.toFixed(2)} | P&L: ${pnlStr}`);

    io.emit('position_closed', {
      accountId: position.accountId,
      positionId: position.id,
      symbol: position.symbol,
      displayName: position.displayName,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl: result.pnl,
      exitReason: 'TARGET_HIT',
      isPartial: !result.fullyClosed,
      exitQty: result.exitQty,
      remainingQty: result.remainingQty,
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


    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({
        where: { id: order.id, status: 'PENDING' },
      });
      if (!current) return null;
      const liveOrder = current;

      if (liveOrder.positionId) {
        const linkedPosition = await tx.position.findFirst({
          where: { id: liveOrder.positionId, accountId: liveOrder.accountId, isOpen: true },
        });
        if (!linkedPosition) {
          await tx.order.update({
            where: { id: liveOrder.id },
            data: { status: 'CANCELLED', rejectedReason: 'Linked position is already closed' },
          });
          return { positionId: liveOrder.positionId, averaged: false, netted: false, cancelled: true, filledQuantity: 0 };
        }

        const expectedExitSide = linkedPosition.side === 'BUY' ? 'SELL' : 'BUY';
        if (liveOrder.side !== expectedExitSide) {
          await tx.order.update({
            where: { id: liveOrder.id },
            data: { status: 'REJECTED', rejectedReason: 'Invalid side for linked exit order' },
          });
          return { positionId: linkedPosition.id, averaged: false, netted: false, cancelled: true, filledQuantity: 0 };
        }

        const executableQty = Math.min(liveOrder.quantity, linkedPosition.quantity);
        if (executableQty <= 0) {
          await tx.order.update({
            where: { id: liveOrder.id },
            data: { status: 'CANCELLED', rejectedReason: 'Linked position has no quantity left' },
          });
          return { positionId: linkedPosition.id, averaged: false, netted: false, cancelled: true, filledQuantity: 0 };
        }

        // Determine the correct exit reason based on the order type that triggered
        const exitReason = (liveOrder.orderType === 'SL' || liveOrder.orderType === 'SL-M')
          ? 'SL_HIT'
          : 'TARGET_HIT';

        const pnlPerUnit = linkedPosition.side === 'BUY'
          ? fillPrice - linkedPosition.entryPrice
          : linkedPosition.entryPrice - fillPrice;
        const pnl = pnlPerUnit * executableQty;
        const marginPerUnit = linkedPosition.marginUsed > 0
          ? linkedPosition.marginUsed / linkedPosition.quantity
          : 0;
        const marginToRelease = marginPerUnit * executableQty;

        const positionFullyClosed = executableQty >= linkedPosition.quantity;

        // Clear the position's SL/target fields so processPositionSLTarget
        // doesn't trigger a second exit on the next tick
        const clearFields: Record<string, null> = {};
        if (liveOrder.orderType === 'LIMIT') {
          clearFields.targetPrice = null;
          clearFields.targetQty = null;
        } else if (liveOrder.orderType === 'SL' || liveOrder.orderType === 'SL-M') {
          clearFields.stopLoss = null;
        }

        if (!positionFullyClosed) {
          await tx.position.update({
            where: { id: linkedPosition.id },
            data: {
              quantity: linkedPosition.quantity - executableQty,
              currentPrice: fillPrice,
              marginUsed: Math.max(0, linkedPosition.marginUsed - marginToRelease),
              ...clearFields,
            },
          });
        } else {
          await tx.position.update({
            where: { id: linkedPosition.id },
            data: {
              isOpen: false,
              currentPrice: fillPrice,
              pnl,
              marginUsed: 0,
              exitReason,
              closedAt: new Date(),
            },
          });

          // Cancel all other pending orders tied to this position
          await tx.order.updateMany({
            where: {
              accountId: liveOrder.accountId,
              positionId: linkedPosition.id,
              status: 'PENDING',
              id: { not: liveOrder.id },
            },
            data: {
              status: 'CANCELLED',
              rejectedReason: 'Position fully closed',
            },
          });
        }

        await tx.trade.create({
          data: {
            accountId: liveOrder.accountId,
            symbol: liveOrder.symbol,
            displayName: liveOrder.displayName,
            side: linkedPosition.side,
            quantity: executableQty,
            entryPrice: linkedPosition.entryPrice,
            exitPrice: fillPrice,
            pnl,
            exitReason,
            entryTime: linkedPosition.createdAt,
          },
        });

        const isOption = linkedPosition.instrumentType === 'CE' || linkedPosition.instrumentType === 'PE';
        const balanceAdjust = isOption
          ? (linkedPosition.side === 'BUY' ? fillPrice * executableQty : -(fillPrice * executableQty))
          : pnl;

        await tx.account.update({
          where: { id: liveOrder.accountId },
          data: {
            balance: { increment: balanceAdjust },
            realizedPnl: { increment: pnl },
            usedMargin: { decrement: Math.max(0, marginToRelease) },
          },
        });

        await tx.order.update({
          where: { id: liveOrder.id },
          data: {
            status: 'FILLED',
            filledPrice: fillPrice,
            filledAt: new Date(),
            quantity: executableQty,
            positionId: linkedPosition.id,
          },
        });

        return { positionId: linkedPosition.id, averaged: false, netted: true, cancelled: false, filledQuantity: executableQty, exitReason, positionFullyClosed };
      }

      const isOption = instrumentType === 'CE' || instrumentType === 'PE';

      // --- Position netting: check for opposite-side position first ---
      const oppositeSide = liveOrder.side === 'BUY' ? 'SELL' : 'BUY';
      const oppositePosition = await tx.position.findFirst({
        where: { accountId: liveOrder.accountId, symbol: liveOrder.symbol, side: oppositeSide, isOpen: true },
      });

      if (oppositePosition) {
        // Exit qty must not exceed position qty — never create a reverse position
        if (liveOrder.quantity > oppositePosition.quantity) {
          await tx.order.update({
            where: { id: liveOrder.id },
            data: { status: 'REJECTED', rejectedReason: `Exit qty (${liveOrder.quantity}) exceeds position qty (${oppositePosition.quantity})` },
          });
          return { positionId: oppositePosition.id, averaged: false, netted: false, cancelled: true, filledQuantity: 0 };
        }

        const netQty = liveOrder.quantity;
        const pnlPerUnit = liveOrder.side === 'BUY'
          ? oppositePosition.entryPrice - fillPrice
          : fillPrice - oppositePosition.entryPrice;
        const pnl = pnlPerUnit * netQty;
        const marginPerUnit = oppositePosition.marginUsed > 0
          ? oppositePosition.marginUsed / oppositePosition.quantity : 0;
        const marginToRelease = marginPerUnit * netQty;
        const positionFullyClosed = netQty >= oppositePosition.quantity;

        if (!positionFullyClosed) {
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
          // Cancel all other pending orders tied to this position
          await tx.order.updateMany({
            where: {
              accountId: liveOrder.accountId,
              positionId: oppositePosition.id,
              status: 'PENDING',
              id: { not: liveOrder.id },
            },
            data: { status: 'CANCELLED', rejectedReason: 'Position fully closed' },
          });
        }

        await tx.trade.create({
          data: {
            accountId: liveOrder.accountId,
            symbol: liveOrder.symbol,
            displayName: liveOrder.displayName,
            side: oppositeSide,
            quantity: netQty,
            entryPrice: oppositePosition.entryPrice,
            exitPrice: fillPrice,
            pnl,
            exitReason: 'NET_OFF',
            entryTime: oppositePosition.createdAt,
          },
        });

        const isOpt = oppositePosition.instrumentType === 'CE' || oppositePosition.instrumentType === 'PE';
        const balanceAdjust = isOpt
          ? (oppositePosition.side === 'BUY' ? fillPrice * netQty : -(fillPrice * netQty))
          : pnl;

        await tx.account.update({
          where: { id: liveOrder.accountId },
          data: {
            balance: { increment: balanceAdjust },
            realizedPnl: { increment: pnl },
            usedMargin: { decrement: Math.max(0, marginToRelease) },
          },
        });

        await tx.order.update({
          where: { id: liveOrder.id },
          data: { status: 'FILLED', filledPrice: fillPrice, filledAt: new Date(), positionId: oppositePosition.id },
        });
        return { positionId: oppositePosition.id, averaged: false, netted: true, cancelled: false, filledQuantity: netQty, positionFullyClosed };
      }

      // --- Same-side: average or open new ---
      const existingPosition = await tx.position.findFirst({
        where: { accountId: liveOrder.accountId, symbol: liveOrder.symbol, side: liveOrder.side, isOpen: true },
      });
      const marginRequired = wsGetQuickMargin(liveOrder.symbol, liveOrder.quantity, liveOrder.side);

      let positionId: string;

      if (existingPosition) {
        const oldQty = existingPosition.quantity;
        const oldPrice = existingPosition.entryPrice;
        const newQty = oldQty + liveOrder.quantity;
        const avgPrice = (oldPrice * oldQty + fillPrice * liveOrder.quantity) / newQty;

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
            accountId: liveOrder.accountId,
            symbol: liveOrder.symbol,
            displayName: liveOrder.displayName,
            instrumentType,
            side: liveOrder.side,
            quantity: liveOrder.quantity,
            entryPrice: fillPrice,
            currentPrice: fillPrice,
            marginUsed: marginRequired,
          },
        });
        positionId = position.id;
      }

      await tx.order.update({
        where: { id: liveOrder.id },
        data: {
          status: 'FILLED',
          filledPrice: fillPrice,
          filledAt: new Date(),
          positionId,
        },
      });

      const premium = isOption ? fillPrice * liveOrder.quantity : 0;
      const balanceChange = isOption ? (liveOrder.side === 'BUY' ? -premium : premium) : 0;

      await tx.account.update({
        where: { id: liveOrder.accountId },
        data: {
          usedMargin: { increment: marginRequired },
          ...(balanceChange !== 0 ? { balance: { increment: balanceChange } } : {}),
        },
      });
      return { positionId, averaged: !!existingPosition, netted: false, cancelled: false, filledQuantity: liveOrder.quantity };
    });

    if (!result) {
      console.log(`⚠️ Order ${order.id} already filled/cancelled, skipping`);
      return;
    }

    if (result.cancelled) {
      console.log(`⚠️ Pending order ${order.id} cancelled during fill due to linked-position state`);
      return;
    }

    const label = result.netted ? '✅ Order filled (exit)' : result.averaged ? '✅ Order filled (averaged)' : '✅ Order filled';
    console.log(`${label}: ${order.displayName} ${order.side} ${order.orderType} @ ${fillPrice.toFixed(2)}${result.exitReason ? ` [${result.exitReason}]` : ''}`);

    io.emit('order_filled', {
      accountId: order.accountId,
      orderId: order.id,
      positionId: result.positionId,
      symbol: order.symbol,
      displayName: order.displayName,
      side: order.side,
      orderType: order.orderType,
      fillPrice,
      quantity: result.filledQuantity ?? order.quantity,
      averaged: result.averaged,
    });

    // Emit position_closed only when the linked exit order fully closed a position
    if (result.netted && result.positionFullyClosed && result.exitReason) {
      io.emit('position_closed', {
        accountId: order.accountId,
        positionId: result.positionId,
        symbol: order.symbol,
        exitReason: result.exitReason,
        exitPrice: fillPrice,
      });
    }

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
        // Never force-reconnect from a subscribe: multiple browser components
        // emit subscribe() back-to-back on page load (chart + positions + option
        // chain + watchlist), and passing force=true would kill the in-flight
        // socket each time. The in-flight guard inside initFyersSocket makes
        // this a no-op when an init is already running.
        initFyersSocket(tokenForFeed, false);
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
    // Only force-reconnect if the token has actually changed.
    // Page reloads and navigation reconnect Socket.IO with the SAME token —
    // forcing a Fyers socket reset each time is the root cause of the
    // reconnect storm observed in production logs.
    const tokenChanged = token !== activeSocketToken;
    initFyersSocket(token, tokenChanged);
  } else {
    void ensurePrimaryBrokerTokenLoaded().then((persistedToken) => {
      if (persistedToken && !isFyersSocketConnected()) {
        initFyersSocket(persistedToken);
      }
    });
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Fyers Live Data Server running on ws://${HOST}:${PORT}`);
  console.log(`   FYERS_APP_ID:   ${process.env.FYERS_APP_ID ? '✅ loaded' : '❌ missing — set in .env or .env.local'}`);
  console.log(`   DATABASE_URL:   ${process.env.DATABASE_URL ? '✅ loaded' : '❌ missing'}`);
});

void ensurePrimaryBrokerTokenLoaded().then((token) => {
  if (token) {
    console.log('🔑 Loaded shared broker token from DB');
    initFyersSocket(token);
  }
});

// Feed watchdog — detects when the Fyers socket silently stops delivering ticks
// without firing a close/error event (e.g. idle network drop, carrier NAT timeout).
// If feed is marked live but no tick arrived in the last 90 s, force a reconnect.
// 90 s is conservative: during market hours ticks come every few seconds; outside
// hours the feed is legitimately quiet, so we only check when activeSymbols > 0.
const FEED_WATCHDOG_MS = 30_000;
const FEED_STALE_THRESHOLD_MS = 90_000;
const FEED_RESET_COOLDOWN_MS = 60_000; // don't fire watchdog again for a minute after a reset
setInterval(() => {
  if (!fyersFeedLive) return;
  if (activeSymbols.size === 0) return;
  if (lastTickReceivedAt === 0) return; // haven't received any tick yet this session
  // Cooldown: if we reset the socket recently (including due to a previous
  // watchdog trip), give the new connection time to settle before we judge it
  // stale again. Without this the watchdog can fire repeatedly on startup
  // before any ticks arrive, stacking reconnects on top of each other.
  if (Date.now() - lastFyersResetAt < FEED_RESET_COOLDOWN_MS) return;
  const staleness = Date.now() - lastTickReceivedAt;
  if (staleness > FEED_STALE_THRESHOLD_MS) {
    console.warn(
      `⚠️ Feed watchdog: no ticks for ${Math.round(staleness / 1000)}s — forcing reconnect`
    );
    fyersFeedLive = false;
    io.emit('feed_status', { live: false });
    resetFyersSocket('feed stale — watchdog');
    void refreshTokenAndReconnect('feed watchdog');
  }
}, FEED_WATCHDOG_MS);

// Periodically poll PostgreSQL for a new Fyers access token. This is the
// safety net for the daily expiry case: when the admin re-authenticates in
// the Next.js app, the callback writes a new row to SharedBrokerState. This
// poller picks it up even if no browser is connected to the WS server.
// Frequency is conservative — Fyers tokens are valid ~24h, so 30s is plenty.
const TOKEN_POLL_INTERVAL_MS = 30_000;
setInterval(() => {
  void (async () => {
    try {
      const fresh = await loadFreshSharedBrokerToken();
      if (!fresh) return;

      // Token rotated in DB → reconnect Fyers with the new one.
      if (fresh !== activeSocketToken) {
        console.log('🔄 Token poller: detected new token in DB — reconnecting Fyers');
        initFyersSocket(fresh, true);
        return;
      }

      // Token unchanged but feed is dead → kick a reconnect attempt
      // (e.g. recovering from a transient close).
      if (!isFyersSocketConnected()) {
        console.log('🔄 Token poller: feed is down — attempting reconnect');
        initFyersSocket(fresh, true);
      }
    } catch (error) {
      console.error('Token poller error:', error);
    }
  })();
}, TOKEN_POLL_INTERVAL_MS);
