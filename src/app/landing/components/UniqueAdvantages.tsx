'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const advantages = [
    'Paper trading with live Fyers data feed',
    'AI Pattern Memory Journal — stores your winning setups, retrieves them in real-time (80%+ match)',
    'Social pattern sharing — access AI-validated patterns from top traders',
    'Paper trading competitions with leaderboards & rewards',
    'Strategy backtesting engine with fully customizable entry/exit/target rules',
    'Option strike heat maps for instant market sentiment reading',
    'Auto hedging strategy builder (Iron Condor, spreads, straddle, strangle)',
    'AI-powered custom scanner & indicator creation — describe in English, get Python code',
    'Curated learning playlists — best YouTube content organized by topic & level',
    'Daily & real-time AI market analysis reports (OI analysis, S/R zones, FII/DII data)',
    'Trade journal with emotion tagging & screenshot capture',
    'Trade Replay — relive trades bar-by-bar',
    'AI Trade Coaching — personalized insights from your trade history',
    'Professional charts with multiple timeframes',
    'PWA mobile app — install and trade from anywhere',
    'Smart trading signals with 70-80% accuracy'
];

export default function UniqueAdvantages() {
    return (
        <section id="about" className="py-24 bg-slate-800/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        More Features Than Any Other Trading App
                    </h2>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        We built everything traders actually need — in one place.
                    </p>
                </motion.div>

                {/* Advantages Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                    {advantages.map((advantage, index) => (
                        <motion.div
                            key={advantage}
                            initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-start gap-3"
                        >
                            <div className="flex-shrink-0 w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center mt-0.5">
                                <Check className="w-4 h-4 text-cyan-400" />
                            </div>
                            <span className="text-slate-300">{advantage}</span>
                        </motion.div>
                    ))}
                </div>

                {/* Closing Statement */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-12"
                >
                    <p className="text-xl text-white font-semibold">
                        Most trading apps give you one or two of these. SAHAAI gives you ALL of them — starting free.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
