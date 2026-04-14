'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useMarketStore } from '@/stores/marketStore';

interface WatchlistItem {
    id: string;
    symbol: string;
    name: string;
}

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
        { id: '1', symbol: 'NIFTY BANK', name: 'Nifty Bank' },
        { id: '2', symbol: 'NIFTY 50', name: 'Nifty 50' },
        { id: '3', symbol: 'BANKNIFTY', name: 'Bank Nifty' },
        { id: '4', symbol: 'FINNIFTY', name: 'Fin Nifty' },
    ]);
    const ticks = useMarketStore(s => s.ticks);

    const getLtp = (symbol: string) => {
        return ticks[symbol]?.ltp || 0;
    };

    const getChange = (symbol: string) => {
        const tick = ticks[symbol];
        if (!tick) return 0;
        return 0; // Change calculation - add proper field if available
    };

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
                                    Watchlist
                                </h1>
                                <p className="text-on-surface-variant leading-relaxed text-base max-w-xl">
                                    Track your favorite symbols and market movements.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {watchlist.map(item => {
                                const change = getChange(item.symbol);
                                const ltp = getLtp(item.symbol);
                                return (
                                    <div key={item.id} className="bg-surface-container-lowest p-6 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="font-bold text-lg text-on-surface">{item.symbol}</p>
                                                <p className="text-xs text-on-surface-variant">{item.name}</p>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                                            </span>
                                        </div>
                                        <p className="text-2xl font-black text-on-background">
                                            ₹{ltp.toFixed(2)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {watchlist.length === 0 && (
                            <div className="text-center py-16 text-on-surface-variant">
                                <span className="material-symbols-outlined text-4xl mb-4">visibility</span>
                                <p>No symbols in your watchlist</p>
                            </div>
                        )}
                    </main>
                </div>
                <ToastContainer />
            </div>
        </ProtectedRoute>
    );
}
