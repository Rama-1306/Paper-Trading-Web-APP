'use client';

import { useState } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { TopNav } from '@/components/common/TopNav';
import { SideNav } from '@/components/common/SideNav';
import { ToastContainer } from '@/components/common/ToastContainer';

interface Alert {
    id: string;
    symbol: string;
    type: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'P&L_THRESHOLD';
    value: number;
    enabled: boolean;
    triggered: boolean;
}

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([
        { id: '1', symbol: 'BANKNIFTY', type: 'PRICE_ABOVE', value: 52000, enabled: true, triggered: false },
        { id: '2', symbol: 'NIFTY 50', type: 'PRICE_BELOW', value: 22500, enabled: true, triggered: false },
    ]);

    const toggleAlert = (id: string) => {
        setAlerts(alerts.map(a =>
            a.id === id ? { ...a, enabled: !a.enabled } : a
        ));
    };

    const deleteAlert = (id: string) => {
        setAlerts(alerts.filter(a => a.id !== id));
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
                                    Alerts
                                </h1>
                                <p className="text-on-surface-variant leading-relaxed text-base max-w-xl">
                                    Set price alerts to get notified when conditions are met.
                                </p>
                            </div>
                        </div>

                        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
                            {alerts.length === 0 ? (
                                <div className="px-8 py-16 text-center text-on-surface-variant">
                                    <span className="material-symbols-outlined text-4xl mb-4 block">notifications_off</span>
                                    <p>No alerts set</p>
                                    <p className="text-sm mt-2">Create an alert to get notified</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-surface-container-highest">
                                    {alerts.map(alert => (
                                        <div key={alert.id} className="p-6 flex items-center justify-between hover:bg-surface-container-low transition-colors">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => toggleAlert(alert.id)}
                                                    className={`w-12 h-6 rounded-full transition-colors ${alert.enabled ? 'bg-primary' : 'bg-surface-dim'}`}
                                                >
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${alert.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                                </button>
                                                <div>
                                                    <p className="font-bold text-on-surface">{alert.symbol}</p>
                                                    <p className="text-xs text-on-surface-variant">
                                                        {alert.type === 'PRICE_ABOVE' && `Price above ₹${alert.value}`}
                                                        {alert.type === 'PRICE_BELOW' && `Price below ₹${alert.value}`}
                                                        {alert.type === 'P&L_THRESHOLD' && `P&L at ₹${alert.value}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {alert.triggered && (
                                                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                                                        Triggered
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => deleteAlert(alert.id)}
                                                    className="p-2 hover:bg-error-container rounded transition-colors text-error"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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
