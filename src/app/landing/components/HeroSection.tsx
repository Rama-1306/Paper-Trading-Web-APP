'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Play, Check } from 'lucide-react';

type Particle = { left: number; top: number; duration: number; delay: number };

function useParticles(count: number): Particle[] {
    const [particles, setParticles] = useState<Particle[]>([]);
    useEffect(() => {
        setParticles(
            Array.from({ length: count }, () => ({
                left: Math.random() * 100,
                top: Math.random() * 100,
                duration: Math.random() * 10 + 10,
                delay: Math.random() * 5,
            }))
        );
    }, [count]);
    return particles;
}

interface HeroSectionProps {
    onSignUpClick: () => void;
}

export default function HeroSection({ onSignUpClick }: HeroSectionProps) {
    const particles = useParticles(20);

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
            {/* Background gradient mesh */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent" />

            {/* Animated particles — client-only to avoid SSR hydration mismatch */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {particles.map((p, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-cyan-500/30 rounded-full"
                        initial={{ opacity: 0 }}
                        animate={{
                            y: [0, -1200],
                            opacity: [0, 1, 0],
                        }}
                        transition={{
                            duration: p.duration,
                            repeat: Infinity,
                            ease: 'linear',
                            delay: p.delay,
                        }}
                        style={{
                            left: `${p.left}%`,
                            top: `${p.top}%`,
                        }}
                    />
                ))}
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Column - Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center lg:text-left"
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-cyan-500/30 rounded-full mb-6"
                        >
                            <span className="text-cyan-400">🇮🇳</span>
                            <span className="text-sm text-slate-300">Built for Indian F&O Traders</span>
                        </motion.div>

                        {/* Headline */}
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                            Octopus Hands for{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-amber-400">
                                the Traders
                            </span>
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-xl mx-auto lg:mx-0">
                            India's smartest paper trading & learning platform. Practice BankNifty options with live market data, proprietary signals with 70-80% accuracy, AI-powered pattern recognition, and a social trading community — all in one place. Zero risk. Real growth.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onSignUpClick}
                                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                            >
                                Start Paper Trading — Free
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-8 py-4 bg-transparent border border-slate-600 text-white font-medium rounded-xl hover:border-cyan-500 hover:text-cyan-400 transition-all flex items-center justify-center gap-2"
                            >
                                <Play size={20} />
                                Watch Demo
                            </motion.button>
                        </div>

                        {/* Trust Indicators */}
                        <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                                <Check size={16} className="text-green-500" />
                                <span>Live Fyers Data Feed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check size={16} className="text-green-500" />
                                <span>No Real Money at Risk</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check size={16} className="text-green-500" />
                                <span>Works on Mobile (PWA)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check size={16} className="text-green-500" />
                                <span>Free Plan Available</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check size={16} className="text-green-500" />
                                <span>AI-Powered Insights</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column - Dashboard Mockup */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="relative"
                    >
                        <div className="relative mx-auto max-w-lg lg:max-w-none">
                            {/* Browser Frame */}
                            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                                {/* Browser Header */}
                                <div className="bg-slate-900 px-4 py-3 flex items-center gap-2">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                        <div className="w-3 h-3 rounded-full bg-green-500" />
                                    </div>
                                    <div className="flex-1 text-center">
                                        <span className="text-xs text-slate-500">sahaai.tech/dashboard</span>
                                    </div>
                                </div>

                                {/* Dashboard Content */}
                                <div className="p-4 bg-slate-900 space-y-3">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                                <span className="text-cyan-400 font-bold">S</span>
                                            </div>
                                            <div>
                                                <p className="text-white font-semibold">Portfolio Overview</p>
                                                <p className="text-xs text-slate-500">Welcome back, Trader</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-white">₹10,00,000</p>
                                            <p className="text-xs text-green-500">+₹45,230 (4.7%)</p>
                                        </div>
                                    </div>

                                    {/* Chart Area */}
                                    <div className="bg-slate-800 rounded-xl p-4 h-40 flex items-end justify-between gap-1">
                                        {[35, 45, 30, 55, 40, 65, 50, 70, 60, 80, 65, 90, 75, 85, 70, 95, 80].map((height, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 bg-cyan-500/60 rounded-t"
                                                style={{ height: `${height}%` }}
                                            />
                                        ))}
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-800 rounded-lg p-3">
                                            <p className="text-xs text-slate-500">Day P&L</p>
                                            <p className="text-green-500 font-bold">+₹12,450</p>
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

                                    {/* Signal Badge */}
                                    <div className="bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 rounded-lg p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            <span className="text-sm text-white">BUY Signal Active</span>
                                        </div>
                                        <span className="text-xs text-cyan-400">BankNifty 52500 CE</span>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Elements */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute -top-6 -right-6 bg-slate-800 border border-amber-500/30 rounded-xl p-4 shadow-lg"
                            >
                                <p className="text-xs text-slate-400 mb-1">Signal Accuracy</p>
                                <p className="text-2xl font-bold text-amber-400">70-80%</p>
                            </motion.div>

                            <motion.div
                                animate={{ y: [0, 10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                                className="absolute -bottom-4 -left-4 bg-slate-800 border border-cyan-500/30 rounded-xl p-4 shadow-lg"
                            >
                                <p className="text-xs text-slate-400 mb-1">Pattern Match</p>
                                <p className="text-2xl font-bold text-cyan-400">80%+</p>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
