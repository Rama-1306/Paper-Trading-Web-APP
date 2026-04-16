'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Users, AlertTriangle, Scale } from 'lucide-react';

const opportunities = [
    {
        icon: Users,
        value: '1.5 Crore+',
        label: 'Active F&O Traders in India',
        description: 'And growing 30%+ year over year'
    },
    {
        icon: TrendingUp,
        value: 'USD 1.08B → 2.61B',
        label: 'Indian Online Trading Platform Market',
        description: 'CAGR projection'
    },
    {
        icon: AlertTriangle,
        value: '9 out of 10',
        label: 'Retail Traders Lose Money',
        description: 'SEBI study confirms the problem SAHAAI solves'
    },
    {
        icon: Scale,
        value: 'SEBI 2025',
        label: 'Retail Algo Framework',
        description: 'New regulations creating massive opportunity'
    }
];

export default function MarketOpportunity() {
    return (
        <section className="py-24 bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        The Opportunity
                    </h2>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {opportunities.map((opp, index) => (
                        <motion.div
                            key={opp.label}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-center"
                        >
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-cyan-500/10 rounded-xl mb-4">
                                <opp.icon className="w-6 h-6 text-cyan-400" />
                            </div>
                            <p className="text-3xl md:text-4xl font-bold text-white mb-1">
                                {opp.value}
                            </p>
                            <p className="text-lg text-cyan-400 font-semibold mb-1">
                                {opp.label}
                            </p>
                            <p className="text-sm text-slate-400">
                                {opp.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
