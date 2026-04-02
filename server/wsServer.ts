import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

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

const httpServer = createServer((req, res) => {
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

const clients = new Map<string, { token: string; symbols: Set<string> }>();
const activeSymbols = new Set<string>();

let skt: any = null;
let isProcessingOrders = false;

function initFyersSocket(token: string) {
  if (skt) return;

  const appId = process.env.FYERS_APP_ID;
  if (!appId) {
    console.error('❌ FYERS_APP_ID is missing in .env');
    return;
  }

  const accessTokenFull = `${appId}:${token}`;
  console.log('🔑 Initializing Fyers Data Socket...');

  const fyersSocket = fyersDataSocket.getInstance(accessTokenFull);
  skt = fyersSocket;

  fyersSocket.on('connect', () => {
    console.log('🔗 Connected to Fyers Real-time Data WebSocket');
    skt = fyersSocket; // Reassign in case it was cleared after a previous close

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
      io.emit('ticks', ticks);
      processTicksForOrders(ticks);
    }
  });

  fyersSocket.on('error', (err: any) => {
    console.error('❌ Fyers WS Error:', err);
  });

  fyersSocket.on('close', () => {
    console.log('🔌 Fyers WS Closed — autoreconnect will retry');
    skt = null;
  });

  fyersSocket.connect();
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
        shouldFill = true;
        fillPrice = order.price;
      } else if (order.side === 'SELL' && order.price && ltp >= order.price) {
        shouldFill = true;
        fillPrice = order.price;
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
  if (!skt || !skt.isConnected()) return;

  const syms = Array.from(activeSymbols);
  if (syms.length > 0) {
    console.log('📡 Subscribing to:', syms);
    skt.subscribe(syms, false, 1);
    skt.mode(skt.FullMode, 1);
  }
}

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.emit('error', 'Fyers access token not found. Please connect Fyers.');
    return;
  }

  clients.set(socket.id, { token, symbols: new Set() });
  socket.emit('authenticated', { success: true });

  initFyersSocket(token);

  socket.on('subscribe', (symbols: string[]) => {
    const client = clients.get(socket.id);
    if (!client) return;

    symbols.forEach(s => {
      client.symbols.add(s);
      activeSymbols.add(s);
    });

    console.log(`📊 Client ${socket.id} subscribed to: ${symbols.join(', ')}`);
    socket.emit('subscribed', Array.from(client.symbols));

    handleSymbolSync();
  });

  socket.on('unsubscribe', (symbols: string[]) => {
    const client = clients.get(socket.id);
    if (!client) return;
    symbols.forEach(s => client.symbols.delete(s));

    activeSymbols.clear();
    clients.forEach(c => c.symbols.forEach(s => activeSymbols.add(s)));

    if (skt && skt.isConnected()) {
      skt.unsubscribe(symbols, false, 1);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    clients.delete(socket.id);

    activeSymbols.clear();
    clients.forEach(c => c.symbols.forEach(s => activeSymbols.add(s)));
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Fyers Live Data Server running on ws://localhost:${PORT}`);
  console.log(`   FYERS_APP_ID:   ${process.env.FYERS_APP_ID ? '✅ loaded' : '❌ missing — set in .env or .env.local'}`);
  console.log(`   DATABASE_URL:   ${process.env.DATABASE_URL ? '✅ loaded' : '❌ missing'}`);
});
