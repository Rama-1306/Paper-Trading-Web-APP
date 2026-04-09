import { Candle } from '@/types/market';

export interface CCCResult {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  
  color: 'GREEN' | 'RED' | 'ORANGE' | 'BLUE' | 'GREY';
  state: string;
  
  vwapProx?: number;
  ema50Prox?: number;
  ema100Prox?: number;

  isSignalCandle: boolean;
  signalDirection: 'BULL' | 'BEAR' | null;

  lvlEntry?: number;
  lvlSL?: number;
  lvlT1?: number;
  lvlT2?: number;
  lvlT3?: number;
  lvlT4?: number;
  lvlT5?: number;
  lvlT6?: number;
  lvlOrigEntry?: number;
  lvlRisk?: number;
  signalDir: number;
  targetsHit: number;
  t4Extended: boolean;

  emaEntryActive: boolean;
  emaEntryValue?: number;

  stBullBreak: boolean;
  stBearBreak: boolean;

  superTrend?: number;
  direction?: number;
  ema5?: number;
  sahaLine?: number;
}

// Pine parity: ta.rma seeds with SMA of the first `length` bars and returns na
// (NaN here) for earlier warmup bars. Also skips NaN inputs so callers like
// f_shema can pass NaN for bars with insufficient history.
function rma(src: number[], length: number): number[] {
  const alpha = 1 / length;
  const result: number[] = [];
  let sum = 0;
  let validCount = 0;
  let lastValid: number = NaN;

  for (let i = 0; i < src.length; i++) {
    const val = src[i];
    if (Number.isNaN(val)) {
      result.push(NaN);
      continue;
    }

    validCount++;

    if (validCount < length) {
      sum += val;
      result.push(NaN);
    } else if (validCount === length) {
      sum += val;
      lastValid = sum / length; // SMA seed
      result.push(lastValid);
    } else {
      lastValid = alpha * val + (1 - alpha) * lastValid;
      result.push(lastValid);
    }
  }
  return result;
}

// Pine parity: ta.ema seeds with SMA of the first `length` bars and returns na
// (NaN here) during warmup. Handles NaN inputs so the f_shema → ta.ema(ed, period)
// chain works when ed is na for the first `lag` bars.
function ema(src: number[], length: number): number[] {
  const alpha = 2 / (length + 1);
  const result: number[] = [];
  let sum = 0;
  let validCount = 0;
  let lastValid: number = NaN;

  for (let i = 0; i < src.length; i++) {
    const val = src[i];
    if (Number.isNaN(val)) {
      result.push(NaN);
      continue;
    }

    validCount++;

    if (validCount < length) {
      sum += val;
      result.push(NaN);
    } else if (validCount === length) {
      sum += val;
      lastValid = sum / length; // SMA seed
      result.push(lastValid);
    } else {
      lastValid = alpha * val + (1 - alpha) * lastValid;
      result.push(lastValid);
    }
  }
  return result;
}

function tr(candles: Candle[]): number[] {
  const result: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    result.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return result;
}

// Pine parity: ta.supertrend uses hl2 = (H+L)/2 as the mid-price, NOT hlc3.
// ATR = rma(TR, atrPeriod) which is NaN for the first atrPeriod-1 bars. Bands,
// ST line and direction stay NaN during that warmup. On the first bar with a
// valid ATR, bands are seeded from the basic values and direction defaults to 1
// (downtrend), matching Pine's `if na(atr[1]) direction := 1` branch.
function supertrend(candles: Candle[], factor: number, atrPeriod: number) {
  const trueRange = tr(candles);
  const atrRma = rma(trueRange, atrPeriod);

  const hl2 = candles.map(c => (c.high + c.low) / 2);

  const upperBands: number[] = [];
  const lowerBands: number[] = [];
  const superTrends: number[] = [];
  const directions: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const atr = atrRma[i];

    if (Number.isNaN(atr)) {
      upperBands.push(NaN);
      lowerBands.push(NaN);
      superTrends.push(NaN);
      directions.push(NaN);
      continue;
    }

    const basicUpper = hl2[i] + factor * atr;
    const basicLower = hl2[i] - factor * atr;

    const prevUpper = i > 0 ? upperBands[i - 1] : NaN;
    const prevLower = i > 0 ? lowerBands[i - 1] : NaN;
    const prevSt    = i > 0 ? superTrends[i - 1] : NaN;
    const prevDir   = i > 0 ? directions[i - 1]  : NaN;

    if (Number.isNaN(prevUpper)) {
      // First bar with valid ATR — seed bands and direction per Pine.
      upperBands.push(basicUpper);
      lowerBands.push(basicLower);
      superTrends.push(basicUpper);
      directions.push(1);
      continue;
    }

    const prevClose = candles[i - 1].close;

    const finalUpper = (basicUpper < prevUpper || prevClose > prevUpper) ? basicUpper : prevUpper;
    const finalLower = (basicLower > prevLower || prevClose < prevLower) ? basicLower : prevLower;

    upperBands.push(finalUpper);
    lowerBands.push(finalLower);

    let direction = prevDir;
    let st = prevSt;

    if (prevSt === prevUpper && candles[i].close > finalUpper) {
      direction = -1;
    } else if (prevSt === prevLower && candles[i].close < finalLower) {
      direction = 1;
    }

    if (direction === -1) {
      st = finalLower;
    } else {
      st = finalUpper;
    }

    superTrends.push(st);
    directions.push(direction);
  }

  return { superTrends, directions };
}

// Pine parity: `nz(src[1])` resolves to 0 on bar 0, so the previous source
// must be treated as 0 (not the current value) for i=0. This matters because
// the recursive smoothing below propagates the first-bar difference forward.
function f_saha_logic(src: number[], trArr: number[]): number[] {
  const result: number[] = [];
  let v1 = 0;
  let v2 = 0;
  let v3 = 0;

  for (let i = 0; i < src.length; i++) {
    const prevSrc = i > 0 ? src[i - 1] : 0;
    v1 = 0.2 * (src[i] - prevSrc) + 0.8 * v1;
    v2 = 0.1 * trArr[i] + 0.8 * v2;

    const lam = Math.abs(v1 / (v2 === 0 ? 0.0001 : v2));
    const alp = (-Math.pow(lam, 2) + Math.sqrt(Math.pow(lam, 4) + 16 * Math.pow(lam, 2))) / 8;

    v3 = alp * src[i] + (1 - alp) * v3;
    result.push(v3);
  }
  return result;
}

// Pine parity: for i < lag, Pine's `src[lag]` is na, so `ed = src + (src - na) = na`.
// ema() downstream skips NaN inputs until it has `length` valid samples to seed.
function f_shema(src: number[], period: number): number[] {
  const lag = Math.round((period - 1) / 2);
  const ed: number[] = [];

  for (let i = 0; i < src.length; i++) {
    if (i < lag) {
      ed.push(NaN);
    } else {
      ed.push(src[i] + (src[i] - src[i - lag]));
    }
  }

  return ema(ed, period);
}

const ST_MULT = 1.0;
const ST_ATR_LEN = 21;
const EMA_PERIOD = 5;
const SAHA_PERIOD = 5;
const PROX_PCT = 0.5;

export function calculateCCC(candles: Candle[]): CCCResult[] {
  if (candles.length === 0) return [];
  
  const closes = candles.map(c => c.close);
  const trArr = tr(candles);
  
  const ema5 = ema(closes, EMA_PERIOD);
  const ema50 = ema(closes, 50);
  const ema100 = ema(closes, 100);
  
  const { superTrends, directions } = supertrend(candles, ST_MULT, ST_ATR_LEN);
  const sahaLogic = f_saha_logic(closes, trArr);
  const sahaLineArr = f_shema(sahaLogic, SAHA_PERIOD);
  
  let vwapSum = 0;
  let volSum = 0;
  let lastSessionDate = '';
  const vwaps: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const d = new Date((candles[i].time + 19800) * 1000);
    const sessionDate = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (sessionDate !== lastSessionDate) {
      vwapSum = 0;
      volSum = 0;
      lastSessionDate = sessionDate;
    }
    const hlc3 = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const vol = candles[i].volume || 1;
    vwapSum += hlc3 * vol;
    volSum += vol;
    vwaps.push(volSum > 0 ? vwapSum / volSum : hlc3);
  }
  
  let state = 'INIT';
  let candleCol: 'GREEN' | 'RED' | 'ORANGE' | 'BLUE' | 'GREY' = 'GREY';
  
  let breakH: number | null = null;
  let breakL: number | null = null;
  let lastBearFlipH: number | null = null;
  let lastBearFlipL: number | null = null;
  let lastBullFlipH: number | null = null;
  let lastBullFlipL: number | null = null;
  let prevSTLine: number | null = null;

  let lvlEntry: number | undefined;
  let lvlSL: number | undefined;
  let lvlT1: number | undefined;
  let lvlT2: number | undefined;
  let lvlT3: number | undefined;
  let lvlT4: number | undefined;
  let lvlT5: number | undefined;
  let lvlT6: number | undefined;
  let lvlOrigEntry: number | undefined;
  let lvlRisk: number | undefined;
  let signalDir = 0;
  let targetsHit = 0;
  let t4Extended = false;
  let emaEntryActive = false;
  let emaEntryTouched = false;
  
  const results: CCCResult[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const isBullishST = directions[i] < 0;
    const isBearishST = directions[i] > 0;
    const prevDir = i > 0 ? directions[i - 1] : directions[i];
    // NaN-safe: during the SuperTrend warmup directions[] is NaN, and
    // `NaN !== NaN` is true in JS, which would spuriously report a trend flip
    // on every warmup bar and again at the first valid-ATR bar. Guard both sides.
    const trendChanged = !Number.isNaN(prevDir) && !Number.isNaN(directions[i]) && directions[i] !== prevDir;
    const stBullBreak = trendChanged && isBullishST;
    const stBearBreak = trendChanged && isBearishST;
    
    let drawBear = false;
    let drawBull = false;
    let tgtH = c.high;
    let tgtL = c.low;
    
    if (trendChanged) {
      prevSTLine = i > 0 ? superTrends[i - 1] : null;
      if (isBearishST) {
        lastBearFlipH = c.high;
        lastBearFlipL = c.low;
      }
      if (isBullishST) {
        lastBullFlipH = c.high;
        lastBullFlipL = c.low;
      }
    }
    
    if (state === 'INIT') {
      if (isBullishST && ema5[i] > sahaLineArr[i]) {
        state = 'BULL';
        candleCol = 'GREEN';
      } else if (isBearishST && ema5[i] < sahaLineArr[i]) {
        state = 'BEAR';
        candleCol = 'RED';
      } else {
        candleCol = 'GREY';
      }
    } 
    else if (state === 'BULL') {
      candleCol = 'GREEN';
      if (isBearishST) {
        if (trendChanged) {
          breakH = c.high; breakL = c.low;
        } else {
          breakH = lastBearFlipH ?? c.high; breakL = lastBearFlipL ?? c.low;
        }
        state = 'BREAK_B';
        candleCol = 'GREY';
      }
    }
    else if (state === 'BREAK_B') {
      candleCol = 'GREY';
      if (isBullishST) {
        if (trendChanged) {
          breakH = c.high; breakL = c.low;
        } else {
          breakH = lastBullFlipH ?? c.high; breakL = lastBullFlipL ?? c.low;
        }
        state = 'BREAK_S';
        candleCol = 'GREY';
      } else if (breakL !== null && c.close < breakL && ema5[i] < sahaLineArr[i] && prevSTLine !== null && ema5[i] < prevSTLine) {
        state = 'BEAR';
        candleCol = 'RED';
        drawBear = true;
        tgtH = breakH ?? c.high;
        tgtL = breakL ?? c.low;
      }
    }
    else if (state === 'BEAR') {
      candleCol = 'RED';
      if (isBullishST) {
        if (trendChanged) {
          breakH = c.high; breakL = c.low;
        } else {
          breakH = lastBullFlipH ?? c.high; breakL = lastBullFlipL ?? c.low;
        }
        state = 'BREAK_S';
        candleCol = 'GREY';
      }
    }
    else if (state === 'BREAK_S') {
      candleCol = 'GREY';
      if (isBearishST) {
        if (trendChanged) {
          breakH = c.high; breakL = c.low;
        } else {
          breakH = lastBearFlipH ?? c.high; breakL = lastBearFlipL ?? c.low;
        }
        state = 'BREAK_B';
        candleCol = 'GREY';
      } else if (breakH !== null && c.close > breakH && ema5[i] > sahaLineArr[i] && prevSTLine !== null && ema5[i] > prevSTLine) {
        state = 'BULL';
        candleCol = 'GREEN';
        drawBull = true;
        tgtH = breakH ?? c.high;
        tgtL = breakL ?? c.low;
      }
    }
    
    if (!trendChanged) {
      const prevLow = i > 0 ? candles[i - 1].low : null;
      const prevHigh = i > 0 ? candles[i - 1].high : null;
      
      if (candleCol === 'GREEN' && prevLow !== null && prevLow > c.close) candleCol = 'ORANGE';
      if (candleCol === 'RED' && prevHigh !== null && prevHigh < c.close) candleCol = 'BLUE';
    }

    if (drawBear || drawBull) {
      const rng = tgtH - tgtL;
      const risk = 1.618 * rng;
      lvlRisk = risk;
      targetsHit = 0;
      t4Extended = false;
      lvlT5 = undefined;
      lvlT6 = undefined;

      if (drawBear) {
        signalDir = -1;
        lvlEntry = tgtL;
        lvlOrigEntry = lvlEntry;
        lvlSL = lvlEntry + risk;
        lvlT1 = lvlEntry - 0.76 * risk;
        lvlT2 = lvlEntry - 1.2 * risk;
        lvlT3 = lvlEntry - 1.6 * risk;
        lvlT4 = lvlEntry - 2.6 * risk;
      } else {
        signalDir = 1;
        lvlEntry = tgtH;
        lvlOrigEntry = lvlEntry;
        lvlSL = lvlEntry - risk;
        lvlT1 = lvlEntry + 0.76 * risk;
        lvlT2 = lvlEntry + 1.2 * risk;
        lvlT3 = lvlEntry + 1.6 * risk;
        lvlT4 = lvlEntry + 2.6 * risk;
      }

      emaEntryActive = true;
      emaEntryTouched = false;
    }

    if (signalDir !== 0 && !(drawBear || drawBull) && lvlT1 !== undefined && lvlT2 !== undefined && lvlT3 !== undefined && lvlT4 !== undefined && lvlEntry !== undefined && lvlOrigEntry !== undefined && lvlRisk !== undefined) {
      if (signalDir === 1) {
        if (targetsHit === 0 && c.high >= lvlT1) {
          targetsHit = 1;
          lvlSL = lvlEntry;
        }
        if (targetsHit === 1 && c.high >= lvlT2) {
          targetsHit = 2;
          lvlEntry = lvlT1;
          lvlSL = lvlT1;
        }
        if (targetsHit === 2 && c.high >= lvlT3) {
          targetsHit = 3;
          lvlEntry = lvlT2;
          lvlSL = lvlT2;
        }
        if (targetsHit === 3 && c.high >= lvlT4) {
          targetsHit = 4;
          lvlEntry = lvlT3;
          lvlSL = lvlT3;
          if (!t4Extended) {
            lvlT5 = lvlOrigEntry + 3.6 * lvlRisk;
            lvlT6 = lvlOrigEntry + 4.6 * lvlRisk;
            t4Extended = true;
          }
        }
        if (targetsHit === 4 && lvlT5 !== undefined && c.high >= lvlT5) {
          targetsHit = 5;
          lvlEntry = lvlT4;
          lvlSL = lvlT4;
        }
        if (targetsHit === 5 && lvlT6 !== undefined && c.high >= lvlT6) {
          targetsHit = 6;
          lvlEntry = lvlT5;
          lvlSL = lvlT5;
        }
      } else if (signalDir === -1) {
        if (targetsHit === 0 && c.low <= lvlT1) {
          targetsHit = 1;
          lvlSL = lvlEntry;
        }
        if (targetsHit === 1 && c.low <= lvlT2) {
          targetsHit = 2;
          lvlEntry = lvlT1;
          lvlSL = lvlT1;
        }
        if (targetsHit === 2 && c.low <= lvlT3) {
          targetsHit = 3;
          lvlEntry = lvlT2;
          lvlSL = lvlT2;
        }
        if (targetsHit === 3 && c.low <= lvlT4) {
          targetsHit = 4;
          lvlEntry = lvlT3;
          lvlSL = lvlT3;
          if (!t4Extended) {
            lvlT5 = lvlOrigEntry - 3.6 * lvlRisk;
            lvlT6 = lvlOrigEntry - 4.6 * lvlRisk;
            t4Extended = true;
          }
        }
        if (targetsHit === 4 && lvlT5 !== undefined && c.low <= lvlT5) {
          targetsHit = 5;
          lvlEntry = lvlT4;
          lvlSL = lvlT4;
        }
        if (targetsHit === 5 && lvlT6 !== undefined && c.low <= lvlT6) {
          targetsHit = 6;
          lvlEntry = lvlT5;
          lvlSL = lvlT5;
        }
      }
    }

    if (emaEntryActive && !emaEntryTouched && signalDir !== 0 && !(drawBear || drawBull)) {
      if (signalDir === 1 && c.low <= ema5[i]) {
        emaEntryTouched = true;
        emaEntryActive = false;
      }
      if (signalDir === -1 && c.high >= ema5[i]) {
        emaEntryTouched = true;
        emaEntryActive = false;
      }
    }
    
    const proxThresh = c.close * PROX_PCT / 100.0;
    let vwapProx, ema50Prox, ema100Prox;
    
    if (Math.abs(c.close - vwaps[i]) <= proxThresh) vwapProx = vwaps[i];
    if (Math.abs(c.close - ema50[i]) <= proxThresh) ema50Prox = ema50[i];
    if (Math.abs(c.close - ema100[i]) <= proxThresh) ema100Prox = ema100[i];
    
    results.push({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      color: candleCol,
      state,
      isSignalCandle: drawBear || drawBull,
      signalDirection: drawBear ? 'BEAR' : drawBull ? 'BULL' : null,

      lvlEntry: signalDir !== 0 ? lvlEntry : undefined,
      lvlSL: signalDir !== 0 ? lvlSL : undefined,
      lvlT1: signalDir !== 0 ? lvlT1 : undefined,
      lvlT2: signalDir !== 0 ? lvlT2 : undefined,
      lvlT3: signalDir !== 0 ? lvlT3 : undefined,
      lvlT4: signalDir !== 0 ? lvlT4 : undefined,
      lvlT5: signalDir !== 0 ? lvlT5 : undefined,
      lvlT6: signalDir !== 0 ? lvlT6 : undefined,
      lvlOrigEntry: signalDir !== 0 ? lvlOrigEntry : undefined,
      lvlRisk: signalDir !== 0 ? lvlRisk : undefined,
      signalDir,
      targetsHit,
      t4Extended,
      emaEntryActive,
      emaEntryValue: emaEntryActive && !emaEntryTouched ? ema5[i] : undefined,

      stBullBreak,
      stBearBreak,

      vwapProx,
      ema50Prox,
      ema100Prox,
      superTrend: superTrends[i],
      direction: directions[i],
      ema5: ema5[i],
      sahaLine: sahaLineArr[i],
    });
  }
  
  return results;
}
