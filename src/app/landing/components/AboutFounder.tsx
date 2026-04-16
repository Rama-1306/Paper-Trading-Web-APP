'use client';

import { motion } from 'framer-motion';

const credentials = [
    'Active BankNifty Options Trader',
    'Technical Analysis Expert',
    'Proprietary Indicator Developer',
    'Full-Stack Platform Builder',
];

export default function AboutFounder() {
    return (
        <section id="about-founder" className="py-24 bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        Built by a Trader, for Traders
                    </h2>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-3xl mx-auto bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 md:p-10"
                >
                    {/* Octopus accent */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center text-4xl">
                            🐙
                        </div>
                    </div>

                    <p className="text-slate-300 text-lg leading-relaxed text-center mb-4">
                        SAHAAI is built by an active BankNifty options trader with deep expertise in technical analysis, proprietary indicator development, and advanced backtesting systems.
                    </p>
                    <p className="text-slate-400 leading-relaxed text-center mb-8">
                        Every feature exists because it solves a real problem faced during actual trading — not because a product manager imagined it in a boardroom. The vision is simple:{' '}
                        <span className="text-white font-semibold">Paper → Trust → Live.</span> No trader should risk real money until they&apos;ve proven their edge with paper trading and pattern recognition.
                    </p>

                    {/* Credential pills */}
                    <div className="flex flex-wrap justify-center gap-3">
                        {credentials.map((cred) => (
                            <span
                                key={cred}
                                className="px-4 py-2 bg-slate-900 border border-cyan-500/30 text-cyan-400 text-sm rounded-full"
                            >
                                {cred}
                            </span>
                        ))}
                    </div>

                    <p className="text-center text-slate-500 text-sm mt-8">
                        &ldquo;9 out of 10 retail traders lose money. SAHAAI bridges the gap between theory and profitable trading.&rdquo;
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
