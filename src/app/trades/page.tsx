'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore, registerTickPositionUpdater } from '@/stores/marketStore';
import { formatINR } from '@/lib/utils/formatters';
import type { Tick } from '@/types/market';

export default function TradesPage() {
    const [filter, setFilter] = useState('');
    const initSocket = useMarketStore(s => s.initSocket);
    const trades = useTradingStore(s => s.trades);

    useEffect(() => {
        registerTickPositionUpdater((incoming: Tick[]) => {
            // Update positions with latest ticks
        });
        useTradingStore.getState().fetchTrades();
        initSocket();
    }, [initSocket]);

    const filteredTrades = trades.filter(t =>
        filter === '' || t.symbol.toLowerCase().includes(filter.toLowerCase())
    );

    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-surface font-sans">
                <TopNav />
                <div className="flex">
                    <SideNav />
                    <main className="flex-1 ml-20 p-8 lg:p-12">
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                            <div>
                                <h1 className="text-5xl font-extrabold text-on-background tracking-tighter mb-3">
                                    Trades
                                </h1>
                                <p className="text-on-surface-variant leading-relaxed text-base max-w-xl">
                                    Complete history of all your executed trades.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <div className="bg-surface-container-low px-6 py-3 rounded-lg">
                                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Total P&L</p>
                                    <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {totalPnl >= 0 ? '+' : ''}{formatINR(totalPnl)}
                                    </p>
                                </div>
                                <div className="bg-surface-container-low px-6 py-3 rounded-lg">
                                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Win Rate</p>
                                    <p className="text-xl font-bold text-on-surface">
                                        {trades.length > 0 ? Math.round((winningTrades / trades.length) * 100) : 0}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-1.5 rounded text-sm text-on-surface-variant mb-6 w-fit">
                            <span className="material-symbols-outlined text-base">search</span>
                            <input
                                type="text"
                                placeholder="Filter by symbol..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="bg-transparent border-none focus:outline-none p-0 text-sm placeholder:text-on-surface-variant/50 w-32"
                            />
                        </div>

                        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
                            {filteredTrades.length === 0 ? (
                                <div className="px-8 py-16 text-center text-on-surface-variant text-sm">
                                    No trades found.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-on-background">
                                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Trade ID</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Symbol</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Side</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Qty</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Entry</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Exit</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">P&L</th>
                                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-container-highest">
                                            {filteredTrades.map(trade => (
                                                <tr key={trade.id} className="hover:bg-surface-container-low transition-colors">
                                                    <td className="px-8 py-5 font-mono text-xs text-on-surface">{trade.id.slice(0, 8)}...</td>
                                                    <td className="px-4 py-5 font-bold text-sm">{trade.symbol}</td>
                                                    <td className="px-4 py-5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${trade.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {trade.side}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-5 text-right font-medium text-sm">{trade.quantity}</td>
                                                    <td className="px-4 py-5 text-right font-mono text-sm">₹{trade.entryPrice?.toFixed(2) || '—'}</td>
                                                    <td className="px-4 py-5 text-right font-mono text-sm">₹{trade.exitPrice?.toFixed(2) || '—'}</td>
                                                    <td className="px-4 py-5 text-right">
                                                        <span className={`font-bold text-sm ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {trade.pnl >= 0 ? '+' : ''}{formatINR(trade.pnl)}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-xs text-on-surface-variant">
                                                        {trade.exitTime ? new Date(trade.exitTime).toLocaleDateString('en-IN') : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
                <ToastContainer />
            </div>
        </ProtectedRoute>
    );
}
