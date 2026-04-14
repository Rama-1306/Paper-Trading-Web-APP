'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type CandlestickData, type Time, type SeriesMarker, type ISeriesMarkersPluginApi } from 'lightweight-charts';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { calculateCCC } from '@/lib/indicators/ccc';

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candlestickSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceLinesRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionLinesRef = useRef<any[]>([]);
  const prevCandleCountRef = useRef(0);
  const prevLastTimeRef = useRef(0);
  const prevShowIndicatorsRef = useRef(false);
  const candles = useMarketStore((s) => s.candles);
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const positions = useTradingStore((s) => s.positions);
  const showIndicators = useUIStore((s) => s.showIndicators);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#fbf9f5' },
        textColor: '#4e4632',
        fontSize: 11,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.04)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: 'rgba(116, 91, 0, 0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#745b00',
        },
        horzLine: {
          color: 'rgba(116, 91, 0, 0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#745b00',
        },
      },
      rightPriceScale: {
        borderColor: '#e4e2de',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#e4e2de',
        timeVisible: true,
        secondsVisible: false,
        shiftVisibleRangeOnNewBar: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candlestickSeriesInstance = chart.addSeries(CandlestickSeries, {
      upColor: '#00875a',
      downColor: '#ba1a1a',
      borderUpColor: '#00875a',
      borderDownColor: '#ba1a1a',
      wickUpColor: '#00875a99',
      wickDownColor: '#ba1a1a99',
    });

    const markersPlugin = createSeriesMarkers(candlestickSeriesInstance, []);

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeriesInstance;
    markersPluginRef.current = markersPlugin;
    setIsReady(true);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      markersPluginRef.current = null;
      priceLinesRef.current = [];
      positionLinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isReady || !candlestickSeriesRef.current || candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];
    const isTickUpdate =
      candles.length === prevCandleCountRef.current &&
      lastCandle.time === prevLastTimeRef.current &&
      showIndicators === prevShowIndicatorsRef.current;

    const cccResults = calculateCCC(candles);

    // --- Tick update: only update the last bar via update() to preserve pan/zoom ---
    if (isTickUpdate) {
      const lastCCC = cccResults[cccResults.length - 1];
      const timeIST = (lastCCC.time + 19800) as Time;
      let mainColor: string;
      if (showIndicators) {
        mainColor = '#8b8f98';
        if (lastCCC.color === 'GREEN') mainColor = '#00e676';
        else if (lastCCC.color === 'RED') mainColor = '#ff1744';
        else if (lastCCC.color === 'ORANGE') mainColor = '#ff9800';
        else if (lastCCC.color === 'BLUE') mainColor = '#2196F3';
      } else {
        mainColor = lastCCC.close >= lastCCC.open ? '#00e676' : '#ff1744';
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (candlestickSeriesRef.current as any).update({
        time: timeIST,
        open: lastCCC.open,
        high: lastCCC.high,
        low: lastCCC.low,
        close: lastCCC.close,
        color: mainColor,
        borderColor: mainColor,
        wickColor: mainColor,
      });
      return;
    }

    // --- Full data load: setData + fitContent (symbol/timeframe change, new candle, indicator toggle) ---
    prevCandleCountRef.current = candles.length;
    prevLastTimeRef.current = lastCandle.time;
    prevShowIndicatorsRef.current = showIndicators;

    const markers: SeriesMarker<Time>[] = [];

    const formattedData: CandlestickData[] = cccResults.map((c) => {
      const timeIST = (c.time + 19800) as Time;

      let mainColor: string;
      if (showIndicators) {
        mainColor = '#8b8f98';
        if (c.color === 'GREEN') mainColor = '#00e676';
        else if (c.color === 'RED') mainColor = '#ff1744';
        else if (c.color === 'ORANGE') mainColor = '#ff9800';
        else if (c.color === 'BLUE') mainColor = '#2196F3';

        if (c.isSignalCandle && c.signalDirection) {
          markers.push({
            time: timeIST,
            position: c.signalDirection === 'BULL' ? 'belowBar' : 'aboveBar',
            color: c.signalDirection === 'BULL' ? '#00e676' : '#ff1744',
            shape: c.signalDirection === 'BULL' ? 'arrowUp' : 'arrowDown',
            text: c.signalDirection === 'BULL' ? 'BUY' : 'SELL',
            size: 2,
          });
        }

        if (c.stBullBreak) {
          markers.push({
            time: timeIST,
            position: 'belowBar',
            color: '#00CC00',
            shape: 'arrowUp',
            text: '',
            size: 1,
          });
        }
        if (c.stBearBreak) {
          markers.push({
            time: timeIST,
            position: 'aboveBar',
            color: '#CC0000',
            shape: 'arrowDown',
            text: '',
            size: 1,
          });
        }
      } else {
        mainColor = c.close >= c.open ? '#00e676' : '#ff1744';
      }

      return {
        time: timeIST,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        color: mainColor,
        borderColor: mainColor,
        wickColor: mainColor,
      };
    });

    const uniqueSortedData = Array.from(
      new Map(formattedData.map((item) => [item.time, item])).values()
    ).sort((a, b) => (a.time as number) - (b.time as number));

    if (uniqueSortedData.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (candlestickSeriesRef.current as any).setData(uniqueSortedData);
      chartRef.current?.timeScale().fitContent();
    }

    const uniqueMarkers = Array.from(
      new Map(markers.map((m) => [`${m.time}-${m.position}-${m.text}`, m])).values()
    ).sort((a, b) => (a.time as number) - (b.time as number));

    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(showIndicators ? uniqueMarkers : []);
    }

    if (priceLinesRef.current && priceLinesRef.current.length > 0) {
      priceLinesRef.current.forEach(line => candlestickSeriesRef.current?.removePriceLine(line));
      priceLinesRef.current = [];
    }

    const lastBar = cccResults[cccResults.length - 1];
    if (showIndicators && lastBar && lastBar.signalDir !== 0 && candlestickSeriesRef.current) {
      const series = candlestickSeriesRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createLine = (price: number, color: string, title: string, lineStyle: number = 2) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priceLinesRef.current.push(series.createPriceLine({ price, color, title, lineWidth: 1, lineStyle, axisLabelVisible: true } as any));
      };

      const th = lastBar.targetsHit;
      const hitColor = 'rgba(128,128,128,0.4)';

      if (lastBar.lvlEntry !== undefined) {
        const entryLabel = th === 0 ? 'Entry' : th === 1 ? 'Entry (BE)' : 'Trail SL';
        createLine(lastBar.lvlEntry, '#ffffff', `${entryLabel} ${lastBar.lvlEntry.toFixed(2)}`);
      }

      if (lastBar.lvlSL !== undefined) {
        const slLabel = th === 0 ? 'SL' : th === 1 ? 'SL>BE' : 'Trail SL';
        createLine(lastBar.lvlSL, '#FF4444', `${slLabel} ${lastBar.lvlSL.toFixed(2)}`);
      }

      if (lastBar.lvlT1 !== undefined) createLine(lastBar.lvlT1, th >= 1 ? hitColor : '#00CC00', `T1${th >= 1 ? ' HIT' : ''} ${lastBar.lvlT1.toFixed(2)}`);
      if (lastBar.lvlT2 !== undefined) createLine(lastBar.lvlT2, th >= 2 ? hitColor : '#00CC00', `T2${th >= 2 ? ' HIT' : ''} ${lastBar.lvlT2.toFixed(2)}`);
      if (lastBar.lvlT3 !== undefined) createLine(lastBar.lvlT3, th >= 3 ? hitColor : '#00CC00', `T3${th >= 3 ? ' HIT' : ''} ${lastBar.lvlT3.toFixed(2)}`);
      if (lastBar.lvlT4 !== undefined) createLine(lastBar.lvlT4, th >= 4 ? hitColor : '#00CC00', `T4${th >= 4 ? ' HIT' : ''} ${lastBar.lvlT4.toFixed(2)}`);

      if (lastBar.t4Extended) {
        if (lastBar.lvlT5 !== undefined) createLine(lastBar.lvlT5, th >= 5 ? hitColor : '#FFD700', `T5${th >= 5 ? ' HIT' : ''} ${lastBar.lvlT5.toFixed(2)}`);
        if (lastBar.lvlT6 !== undefined) createLine(lastBar.lvlT6, th >= 6 ? hitColor : '#FFD700', `T6${th >= 6 ? ' HIT' : ''} ${lastBar.lvlT6.toFixed(2)}`);
      }

      if (lastBar.emaEntryActive && lastBar.emaEntryValue !== undefined) {
        createLine(lastBar.emaEntryValue, '#FFEB3B', `EMA Entry ${lastBar.emaEntryValue.toFixed(2)}`, 1);
      }

      if (lastBar.vwapProx !== undefined) createLine(lastBar.vwapProx, '#FF9800', `VWAP ${lastBar.vwapProx.toFixed(2)}`, 2);
      if (lastBar.ema50Prox !== undefined) createLine(lastBar.ema50Prox, '#E040FB', `EMA50 ${lastBar.ema50Prox.toFixed(2)}`, 2);
      if (lastBar.ema100Prox !== undefined) createLine(lastBar.ema100Prox, '#00BCD4', `EMA100 ${lastBar.ema100Prox.toFixed(2)}`, 2);
    }

  }, [candles, isReady, showIndicators]);

  useEffect(() => {
    if (!isReady || !candlestickSeriesRef.current) return;

    if (positionLinesRef.current.length > 0) {
      positionLinesRef.current.forEach(line => {
        try { candlestickSeriesRef.current?.removePriceLine(line); } catch { }
      });
      positionLinesRef.current = [];
    }

    const activePositions = positions.filter(p => p.isOpen && p.symbol === activeSymbol);

    activePositions.forEach((pos) => {
      const series = candlestickSeriesRef.current!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lineParams = { lineWidth: 2, axisLabelVisible: true } as any;

      positionLinesRef.current.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.createPriceLine({
          price: pos.entryPrice,
          color: '#3b82f6',
          title: `Entry ${pos.side}`,
          lineStyle: 0,
          ...lineParams,
        } as any)
      );

      if (pos.stopLoss) {
        positionLinesRef.current.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          series.createPriceLine({
            price: pos.stopLoss,
            color: '#ef5350',
            title: pos.trailingSL ? 'TSL' : 'SL',
            lineStyle: 2,
            ...lineParams,
          } as any)
        );
      }

      if (pos.targetPrice) {
        positionLinesRef.current.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          series.createPriceLine({
            price: pos.targetPrice,
            color: '#66bb6a',
            title: 'Target',
            lineStyle: 2,
            ...lineParams,
          } as any)
        );
      }
    });
  }, [positions, activeSymbol, isReady]);

  useEffect(() => {
    if (candles.length > 0 || !isReady || !candlestickSeriesRef.current) return;
    candlestickSeriesRef.current.setData([]);
    prevCandleCountRef.current = 0;
    prevLastTimeRef.current = 0;
  }, [candles, isReady]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: '100%',
        height: 'calc(100% - 40px)',
        touchAction: 'none',
      }}
    />
  );
}
