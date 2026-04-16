'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const tabs = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        content: (
            <div className="p-4 bg-slate-900 space-y-3 min-h-[320px]">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <p className="text-white font-semibold">Portfolio Overview</p>
                        <p className="text-xs text-slate-500">Live Market — 09:30 IST</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-white font-mono">₹10,00,000</p>
                        <p className="text-xs text-green-400">+₹45,230 today (+4.7%)</p>
                    </div>
                </div>
                {/* Chart */}
                <div className="bg-slate-800 rounded-xl p-4 h-36 flex items-end justify-between gap-1">
                    {[35, 45, 30, 55, 40, 65, 50, 70, 60, 80, 65, 90, 75, 85, 70, 95, 80].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t transition-all" style={{ height: `${h}%`, background: h > 60 ? '#22d3ee' : '#64748b' }} />
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Day P&L</p>
                        <p className="text-green-400 font-bold font-mono">+₹12,450</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Win Rate</p>
                        <p className="text-white font-bold">68%</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Open Pos</p>
                        <p className="text-white font-bold">3 Active</p>
                    </div>
                </div>
                <div className="bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-sm text-white">BUY Signal Active</span>
                    </div>
                    <span className="text-xs text-cyan-400 font-mono">BANKNIFTY 52500 CE</span>
                </div>
            </div>
        )
    },
    {
        id: 'optionchain',
        label: 'Option Chain',
        content: (
            <div className="p-4 bg-slate-900 min-h-[320px]">
                <p className="text-white font-semibold mb-3">BankNifty Option Chain — Live</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-700">
                                <th className="text-left pb-2">LTP</th>
                                <th className="text-right pb-2">OI</th>
                                <th className="text-center pb-2 text-cyan-400">Strike</th>
                                <th className="text-left pb-2">OI</th>
                                <th className="text-right pb-2">LTP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { strike: 53000, ceLTP: '182.5', ceOI: '42.1L', peLTP: '890.0', peOI: '18.3L', hot: false },
                                { strike: 52500, ceLTP: '340.0', ceOI: '89.4L', peLTP: '610.0', peOI: '31.2L', hot: true },
                                { strike: 52000, ceLTP: '620.5', ceOI: '56.7L', peLTP: '390.0', peOI: '67.8L', hot: false },
                                { strike: 51500, ceLTP: '980.0', ceOI: '23.4L', peLTP: '215.5', peOI: '92.1L', hot: false },
                                { strike: 51000, ceLTP: '1420.0', ceOI: '12.1L', peLTP: '105.0', peOI: '45.6L', hot: false },
                            ].map((row) => (
                                <tr key={row.strike} className={`border-b border-slate-800 ${row.hot ? 'bg-cyan-500/10' : ''}`}>
                                    <td className="py-2 text-green-400">{row.ceLTP}</td>
                                    <td className="py-2 text-right text-slate-400">{row.ceOI}</td>
                                    <td className={`py-2 text-center font-bold ${row.hot ? 'text-cyan-400' : 'text-white'}`}>{row.strike}</td>
                                    <td className="py-2 text-slate-400">{row.peOI}</td>
                                    <td className="py-2 text-right text-red-400">{row.peLTP}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2 text-center">
                        <p className="text-xs text-slate-400">Max CE OI Strike</p>
                        <p className="text-cyan-400 font-bold">52500</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
                        <p className="text-xs text-slate-400">Max PE OI Strike</p>
                        <p className="text-red-400 font-bold">51500</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'positions',
        label: 'Positions',
        content: (
            <div className="p-4 bg-slate-900 min-h-[320px]">
                <p className="text-white font-semibold mb-3">Open Positions</p>
                <div className="space-y-2">
                    {[
                        { symbol: 'BANKNIFTY 52500 CE', qty: 25, entry: '320.00', ltp: '340.00', pnl: '+₹500', pnlPct: '+6.25%', positive: true },
                        { symbol: 'BANKNIFTY 52000 PE', qty: 50, entry: '410.00', ltp: '390.00', pnl: '-₹1,000', pnlPct: '-4.88%', positive: false },
                        { symbol: 'NIFTY 22500 CE', qty: 75, entry: '145.00', ltp: '168.50', pnl: '+₹1,762', pnlPct: '+16.21%', positive: true },
                    ].map((pos) => (
                        <div key={pos.symbol} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                            <div>
                                <p className="text-white text-sm font-mono font-semibold">{pos.symbol}</p>
                                <p className="text-xs text-slate-500">Qty: {pos.qty} · Entry: ₹{pos.entry} · LTP: ₹{pos.ltp}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold font-mono text-sm ${pos.positive ? 'text-green-400' : 'text-red-400'}`}>{pos.pnl}</p>
                                <p className={`text-xs ${pos.positive ? 'text-green-400' : 'text-red-400'}`}>{pos.pnlPct}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 bg-slate-800 rounded-lg p-3 flex justify-between items-center">
                    <p className="text-slate-400 text-sm">Total Unrealized P&L</p>
                    <p className="text-green-400 font-bold font-mono">+₹1,262</p>
                </div>
            </div>
        )
    },
    {
        id: 'journal',
        label: 'AI Journal',
        content: (
            <div className="p-4 bg-slate-900 min-h-[320px]">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-white font-semibold">Pattern Memory Journal</p>
                    <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">AI Active</span>
                </div>
                <div className="bg-gradient-to-r from-amber-500/10 to-cyan-500/10 border border-amber-500/30 rounded-lg p-3 mb-3">
                    <p className="text-xs text-amber-400 font-semibold mb-1">🧠 Pattern Match Alert</p>
                    <p className="text-sm text-white">This looks like your <span className="text-cyan-400">Pattern #47</span> — 83% historical success</p>
                    <p className="text-xs text-slate-400 mt-1">BankNifty morning reversal + high OI buildup at support</p>
                </div>
                <div className="space-y-2">
                    {[
                        { date: 'Apr 14', pattern: 'BNF Breakout + OI', result: '+₹8,400', win: true },
                        { date: 'Apr 12', pattern: 'Gap-up Fade Setup', result: '+₹3,200', win: true },
                        { date: 'Apr 10', pattern: 'Range Breakdown', result: '-₹1,800', win: false },
                    ].map((entry) => (
                        <div key={entry.date} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                            <div>
                                <p className="text-white text-sm">{entry.pattern}</p>
                                <p className="text-xs text-slate-500">{entry.date}</p>
                            </div>
                            <p className={`font-bold font-mono text-sm ${entry.win ? 'text-green-400' : 'text-red-400'}`}>{entry.result}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 'learning',
        label: 'Learning Hub',
        content: (
            <div className="p-4 bg-slate-900 min-h-[320px]">
                <p className="text-white font-semibold mb-3">Curated Learning Hub</p>
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                    {['Options Basics', 'Greeks', 'Strategies', 'Risk Mgmt', 'Psychology'].map((cat, i) => (
                        <span key={cat} className={`text-xs px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${i === 0 ? 'bg-cyan-500 text-slate-900 font-bold' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{cat}</span>
                    ))}
                </div>
                <div className="space-y-2">
                    {[
                        { title: 'BankNifty Options — Complete Beginner Guide', duration: '42 min', level: 'Beginner', done: true },
                        { title: 'Understanding Delta, Gamma & Theta', duration: '28 min', level: 'Intermediate', done: true },
                        { title: 'Iron Condor Strategy Deep Dive', duration: '35 min', level: 'Advanced', done: false },
                        { title: 'OI Analysis & Market Positioning', duration: '51 min', level: 'Intermediate', done: false },
                    ].map((video) => (
                        <div key={video.title} className="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${video.done ? 'bg-green-500/20' : 'bg-cyan-500/20'}`}>
                                <span className="text-xs">{video.done ? '✓' : '▶'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-medium truncate">{video.title}</p>
                                <p className="text-slate-500 text-xs">{video.duration} · {video.level}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
];

export default function PlatformShowcase() {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <section className="py-24 bg-slate-800/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        See SAHAAI in Action
                    </h2>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        Every screen built for the way Indian F&O traders actually work.
                    </p>
                </motion.div>

                {/* Browser Frame */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-3xl mx-auto"
                >
                    <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                        {/* Browser chrome */}
                        <div className="bg-slate-900 px-4 py-3 flex items-center gap-3 border-b border-slate-700/50">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                            </div>
                            <div className="flex-1 text-center">
                                <span className="text-xs text-slate-500">sahaai.tech/dashboard</span>
                            </div>
                        </div>

                        {/* Tab bar */}
                        <div className="bg-slate-900/60 flex overflow-x-auto border-b border-slate-700/50">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                                        activeTab === tab.id
                                            ? 'text-cyan-400 border-b-2 border-cyan-400'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <AnimatePresence mode="wait">
                            {tabs.map(
                                (tab) =>
                                    tab.id === activeTab && (
                                        <motion.div
                                            key={tab.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            {tab.content}
                                        </motion.div>
                                    )
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Below showcase */}
                <div className="text-center mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <p className="text-slate-400 text-sm">Available on Web & Mobile (PWA)</p>
                    <div className="flex gap-3">
                        <span className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300">
                            📱 Install as App
                        </span>
                        <span className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300">
                            💻 Open in Browser
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
