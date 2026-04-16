'use client';

import { motion } from 'framer-motion';
import { Target, BarChart3, BrainCircuit, Zap } from 'lucide-react';

const stats = [
    {
        icon: Target,
        label: 'Proprietary Signal Accuracy',
        value: '70-80%',
        description: 'Proven success rate'
    },
    {
        icon: BarChart3,
        label: 'Market Coverage',
        value: 'BankNifty + Full Options Chain',
        description: 'All NSE indices & MCX'
    },
    {
        icon: BrainCircuit,
        label: 'Pattern Match Engine',
        value: '80%+ Match Retrieval',
        description: 'AI-powered patterns'
    },
    {
        icon: Zap,
        label: 'Risk',
        value: '₹0 — Paper Trading',
        description: 'Zero financial risk'
    }
];

export default function StatsBar() {
    return (
        <section className="py-12 bg-slate-800/50 border-y border-slate-700/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="text-center group"
                        >
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-cyan-500/10 rounded-xl mb-4 group-hover:bg-cyan-500/20 transition-colors">
                                <stat.icon className="w-6 h-6 text-cyan-400" />
                            </div>
                            <p className="text-3xl md:text-4xl font-bold text-white mb-1">
                                {stat.value}
                            </p>
                            <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                            <p className="text-xs text-slate-500">{stat.description}</p>
                            <div className="mt-3 w-12 h-0.5 bg-gradient-to-r from-cyan-500 to-amber-500 mx-auto rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
