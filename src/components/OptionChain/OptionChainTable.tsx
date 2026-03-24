'use client';

import { useEffect, useState } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { formatINR } from '@/lib/utils/formatters';

export function OptionChainTable() {
  const optionChain = useMarketStore((s) => s.optionChain);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const addNotification = useUIStore((s) => s.addNotification);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const demoStrikes = Array.from({ length: 21 }, (_, i) => {
    const atm = 55000;
    const strike = atm - 1000 + i * 100;
    const dist = Math.abs(strike - atm);
    const baseCePremium = Math.max(20, 800 - dist * 0.6 + Math.random() * 40);
    const basePePremium = Math.max(20, 800 - (1000 - dist) * 0.6 + Math.random() * 40);

    return {
      strikePrice: strike,
      ce: {
        symbol: `DEMO:BANKNIFTY${strike}CE`,
        ltp: +(baseCePremium + (Math.random() - 0.5) * 20).toFixed(2),
        change: +(Math.random() * 10 - 5).toFixed(2),
        oi: Math.floor(Math.random() * 500000 + 100000),
        volume: Math.floor(Math.random() * 200000 + 50000),
      },
      pe: {
        symbol: `DEMO:BANKNIFTY${strike}PE`,
        ltp: +(basePePremium + (Math.random() - 0.5) * 20).toFixed(2),
        change: +(Math.random() * 10 - 5).toFixed(2),
        oi: Math.floor(Math.random() * 500000 + 100000),
        volume: Math.floor(Math.random() * 200000 + 50000),
      },
    };
  });

  const strikes = optionChain?.strikes ?? demoStrikes;
  const spotPrice = optionChain?.spotPrice || useMarketStore.getState().spotPrice || 55000;
  const atmStrike = optionChain?.atmStrike || Math.round(spotPrice / 100) * 100;

  const handleOptionSelect = (symbol: string, strikePrice: number, type: 'CE' | 'PE') => {
    if (!symbol || symbol.startsWith('DEMO:')) {
      addNotification({
        type: 'warning',
        title: 'Not Connected',
        message: 'Connect to Fyers to load live option chain and trade options.',
      });
      return;
    }
    setSelectedSymbol(symbol);
    useMarketStore.getState().setActiveSymbol(symbol);
    addNotification({
      type: 'info',
      title: 'Chart Switched',
      message: `Viewing ${strikePrice} ${type} chart`,
    });
  };

  if (!mounted) return <div style={{ overflow: 'auto', height: '100%' }} />;

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {optionChain?.expiry && (
        <div style={{
          padding: '4px 12px',
          fontSize: '10px',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>Expiry: {optionChain.expiry}</span>
          <span>Spot: {spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      )}
      <table className="data-table" style={{ fontSize: '11px' }}>
        <thead>
          <tr>
            <th className="right" style={{ color: 'var(--color-buy)' }}>OI</th>
            <th className="right" style={{ color: 'var(--color-buy)' }}>Volume</th>
            <th className="right" style={{ color: 'var(--color-buy)' }}>Chg</th>
            <th className="right" style={{ color: 'var(--color-buy)' }}>CE LTP</th>
            <th className="center" style={{ color: 'var(--color-buy)', fontSize: '9px' }}>Chart</th>
            <th className="center" style={{ 
              fontWeight: 700, 
              color: 'var(--text-bright)',
              fontSize: '11px',
            }}>STRIKE</th>
            <th className="center" style={{ color: 'var(--color-sell)', fontSize: '9px' }}>Chart</th>
            <th className="right" style={{ color: 'var(--color-sell)' }}>PE LTP</th>
            <th className="right" style={{ color: 'var(--color-sell)' }}>Chg</th>
            <th className="right" style={{ color: 'var(--color-sell)' }}>Volume</th>
            <th className="right" style={{ color: 'var(--color-sell)' }}>OI</th>
          </tr>
        </thead>
        <tbody>
          {strikes.map((s) => {
            const isATM = s.strikePrice === atmStrike;
            const isITM_CE = s.strikePrice < atmStrike;
            const isITM_PE = s.strikePrice > atmStrike;

            return (
              <tr key={s.strikePrice} style={{
                ...(isATM ? {
                  background: 'rgba(99, 102, 241, 0.08)',
                  borderTop: '1px solid rgba(99, 102, 241, 0.3)',
                  borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
                } : {}),
              }}>
                <td className="right" style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '10px',
                  background: isITM_CE ? 'rgba(41, 121, 255, 0.04)' : 'transparent',
                }}>
                  {(s.ce?.oi ?? 0).toLocaleString('en-IN')}
                </td>
                <td className="right" style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '10px',
                  background: isITM_CE ? 'rgba(41, 121, 255, 0.04)' : 'transparent',
                }}>
                  {(s.ce?.volume ?? 0).toLocaleString('en-IN')}
                </td>
                <td className={`right ${(s.ce?.change ?? 0) >= 0 ? 'profit' : 'loss'}`} style={{
                  background: isITM_CE ? 'rgba(41, 121, 255, 0.04)' : 'transparent',
                }}>
                  {(s.ce?.change ?? 0).toFixed(2)}
                </td>
                <td className="right" style={{
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isITM_CE ? 'rgba(41, 121, 255, 0.04)' : 'transparent',
                  color: 'var(--text-bright)',
                }}
                  onClick={() => {
                    const sym = s.ce?.symbol;
                    if (sym) {
                      setSelectedSymbol(sym);
                    }
                  }}
                  title={`Trade ${s.strikePrice} CE`}
                >
                  {(s.ce?.ltp ?? 0).toFixed(2)}
                </td>

                <td className="center" style={{
                  background: isITM_CE ? 'rgba(41, 121, 255, 0.04)' : 'transparent',
                }}>
                  <button
                    onClick={() => handleOptionSelect(s.ce?.symbol || '', s.strikePrice, 'CE')}
                    style={{
                      background: 'rgba(41, 121, 255, 0.15)',
                      border: '1px solid rgba(41, 121, 255, 0.3)',
                      color: '#4da6ff',
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title={`Open ${s.strikePrice} CE chart`}
                  >
                    CE
                  </button>
                </td>

                <td className="center" style={{
                  fontWeight: 700,
                  color: isATM ? 'var(--color-accent)' : 'var(--text-primary)',
                  fontSize: isATM ? '12px' : '11px',
                  position: 'relative',
                }}>
                  {s.strikePrice}
                </td>

                <td className="center" style={{
                  background: isITM_PE ? 'rgba(255, 109, 0, 0.04)' : 'transparent',
                }}>
                  <button
                    onClick={() => handleOptionSelect(s.pe?.symbol || '', s.strikePrice, 'PE')}
                    style={{
                      background: 'rgba(255, 109, 0, 0.15)',
                      border: '1px solid rgba(255, 109, 0, 0.3)',
                      color: '#ff9800',
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title={`Open ${s.strikePrice} PE chart`}
                  >
                    PE
                  </button>
                </td>

                <td className="right" style={{
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isITM_PE ? 'rgba(255, 109, 0, 0.04)' : 'transparent',
                  color: 'var(--text-bright)',
                }}
                  onClick={() => {
                    const sym = s.pe?.symbol;
                    if (sym) {
                      setSelectedSymbol(sym);
                    }
                  }}
                  title={`Trade ${s.strikePrice} PE`}
                >
                  {(s.pe?.ltp ?? 0).toFixed(2)}
                </td>
                <td className={`right ${(s.pe?.change ?? 0) >= 0 ? 'profit' : 'loss'}`} style={{
                  background: isITM_PE ? 'rgba(255, 109, 0, 0.04)' : 'transparent',
                }}>
                  {(s.pe?.change ?? 0).toFixed(2)}
                </td>
                <td className="right" style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '10px',
                  background: isITM_PE ? 'rgba(255, 109, 0, 0.04)' : 'transparent',
                }}>
                  {(s.pe?.volume ?? 0).toLocaleString('en-IN')}
                </td>
                <td className="right" style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '10px',
                  background: isITM_PE ? 'rgba(255, 109, 0, 0.04)' : 'transparent',
                }}>
                  {(s.pe?.oi ?? 0).toLocaleString('en-IN')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
