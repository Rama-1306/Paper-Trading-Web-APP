'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useTradingStore } from '@/stores/tradingStore';
import { useMarketStore, registerTickPositionUpdater } from '@/stores/marketStore';
import { formatINR } from '@/lib/utils/formatters';
import type { Tick } from '@/types/market';

export default function OrdersPage() {
    const [filter, setFilter] = useState('');
    const initSocket = useMarketStore(s => s.initSocket);
    const ticks = useMarketStore(s => s.ticks);
    const orders = useTradingStore(s => s.orders);

    useEffect(() => {
        registerTickPositionUpdater((incoming: Tick[]) => {
            // Update positions with latest ticks
        });
        useTradingStore.getState().fetchOrders();
        initSocket();
    }, [initSocket]);

    const filteredOrders = orders.filter(o =>
        filter === '' || o.symbol.toLowerCase().includes(filter.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETE': return 'bg-green-100 text-green-700';
            case 'CANCELLED': return 'bg-red-100 text-red-700';
            case 'REJECTED': return 'bg-red-100 text-red-700';
            case 'PENDING': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
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
                                    Orders
                                </h1>
                                <p className="text-on-surface-variant leading-relaxed text-base max-w-xl">
                                    View and manage all your trading orders in one place.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-1.5 rounded text-sm text-on-surface-variant">
                                <span className="material-symbols-outlined text-base">search</span>
                                <input
                                    type="text"
                                    placeholder="Filter by symbol..."
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                    className="bg-transparent border-none focus:outline-none p-0 text-sm placeholder:text-on-surface-variant/50 w-32"
                                />
                            </div>
                        </div>

                        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
                            {filteredOrders.length === 0 ? (
                                <div className="px-8 py-16 text-center text-on-surface-variant text-sm">
                                    No orders found.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-on-background">
                                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Order ID</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Symbol</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Type</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Side</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Qty</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white text-right">Price</th>
                                                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Status</th>
                                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-container-highest">
                                            {filteredOrders.map(order => (
                                                <tr key={order.id} className="hover:bg-surface-container-low transition-colors">
                                                    <td className="px-8 py-5 font-mono text-xs text-on-surface">{order.id.slice(0, 8)}...</td>
                                                    <td className="px-4 py-5 font-bold text-sm">{order.symbol}</td>
                                                    <td className="px-4 py-5 text-sm">{order.orderType || 'MARKET'}</td>
                                                    <td className="px-4 py-5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${order.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {order.side}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-5 text-right font-medium text-sm">{order.quantity}</td>
                                                    <td className="px-4 py-5 text-right font-mono text-sm">₹{order.price?.toFixed(2) || 'MKT'}</td>
                                                    <td className="px-4 py-5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-xs text-on-surface-variant">
                                                        {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '-'}
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
