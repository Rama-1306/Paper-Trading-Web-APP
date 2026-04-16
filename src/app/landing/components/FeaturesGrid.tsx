'use client';

import { motion } from 'framer-motion';
import {
    TrendingUp,
    Activity,
    Target,
    Brain,
    FlaskConical,
    Users,
    Grid3X3,
    Shield,
    SearchCode,
    GraduationCap,
    FileText,
    PlayCircle
} from 'lucide-react';

const features = [
    {
        icon: TrendingUp,
        title: 'Risk-Free Paper Trading',
        description: 'Practice All NSE indices, MCX commodities & BankNifty options trading with real-time live data from Fyers. Place orders, manage positions, track P&L — all without risking a single rupee. Build confidence before going live.',
        highlighted: false
    },
    {
        icon: Activity,
        title: 'Live Market Data + OI Intelligence',
        description: 'Real-time All NSE indices, MCX commodities spot price, complete option chain with live LTP, Greeks, and Open Interest data streamed via WebSocket. Plus AI-powered OI analysis reports.',
        highlighted: false
    },
    {
        icon: Target,
        title: 'Smart Trading Signals',
        description: 'Our proprietary indicator generates high-accuracy BUY/SELL signals with a proven 70-80% success rate. Powered by advanced technical analysis combining multiple market dimensions. Signals fire only on confirmed candle closes — no false repaints.',
        highlighted: false
    },
    {
        icon: Brain,
        title: 'AI Pattern Memory Journal',
        description: 'This is SAHAAI\'s superpower. Every trade you journal gets stored with full context — entry, exit, indicators, market conditions, your emotional state, and outcome. Over time, SAHAAI\'s AI identifies your successful patterns (80%+ match accuracy) and retrieves them in real-time during live markets.',
        highlighted: true,
        badge: 'Star Feature',
        callout: 'Your journal isn\'t just a diary — it\'s a self-learning AI that turns YOUR winning trades into future edge.'
    },
    {
        icon: FlaskConical,
        title: 'Powerful Strategy Backtester',
        description: 'Test any trading strategy or indicator combination on historical data with fine-grained control over entry rules, exit conditions, stop-loss logic, and multi-target profit booking. Customize every parameter.',
        highlighted: false
    },
    {
        icon: Users,
        title: 'Social Trading Intelligence',
        description: 'Access successful trading patterns shared by other SAHAAI traders. Every shared pattern is analyzed and validated by AI before being published. Follow top-performing paper traders, see their win rates, and get alerts when their high-confidence patterns match current market conditions.',
        highlighted: true,
        badge: 'Community Power',
        callout: 'Learn from the community\'s best patterns. Compete. Grow together.'
    },
    {
        icon: Grid3X3,
        title: 'Option Strike Heat Maps',
        description: 'Visual heat maps showing real-time activity across All NSE indices option strikes — OI buildup, OI change, volume concentration, and price movement intensity at a glance. Instantly spot where the market is building positions.',
        highlighted: false
    },
    {
        icon: Shield,
        title: 'Smart Hedging Strategy Builder',
        description: 'Build complex option hedging strategies visually — Iron Condor, Bull Call Spread, Bear Put Spread, Straddle, Strangle, and more. Auto-selects optimal strikes based on current market data, calculates max profit, max loss, and breakeven points.',
        highlighted: false
    },
    {
        icon: SearchCode,
        title: 'AI Custom Scanner & Indicator Creator',
        description: 'Describe your trading idea in plain English — SAHAAI\'s AI writes the Python code for your custom scanner or indicator. No coding knowledge needed. The AI builds, tests, and deploys your custom tools.',
        highlighted: false,
        badge: 'Coming Soon'
    },
    {
        icon: GraduationCap,
        title: 'Curated Learning Resources',
        description: 'Stop drowning in random YouTube videos. SAHAAI\'s Learning Hub filters and organizes the best trading education content into structured playlists — categorized by topic, skill level, and trading style. AI-curated to eliminate distractions.',
        highlighted: true,
        badge: 'Learn Smart',
        callout: 'No more tutorial overload. Learn the right thing, at the right time, in the right order.'
    },
    {
        icon: FileText,
        title: 'Daily & Real-Time AI Market Reports',
        description: 'AI-generated market analysis based on crucial data points — OI analysis, support/resistance zones, FII/DII activity, sector rotation, global cues, and intraday momentum shifts. Delivered daily before market open and updated during trading hours.',
        highlighted: false,
        badge: 'Coming Soon'
    },
    {
        icon: PlayCircle,
        title: 'Trade Replay + AI Coaching',
        description: 'Relive your trades bar-by-bar with full context replay. AI analyzes every trade — what you did right, what you could improve, and patterns in your behavior. Your 24/7 trading mentor that gets smarter with every trade you take.',
        highlighted: false,
        badge: 'Coming Soon'
    }
];

export default function FeaturesGrid() {
    return (
        <section id="features" className="py-24 bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        One Platform. Every Edge You Need.
                    </h2>
                    <p className="text-lg text-slate-400 max-w-3xl mx-auto">
                        Like an octopus with powerful arms, SAHAAI handles every aspect of your trading journey simultaneously — more useful features than any other trading app available today.
                    </p>
                </motion.div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className={`relative p-6 rounded-2xl transition-all hover:-translate-y-1 ${feature.highlighted
                                    ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10'
                                    : 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600'
                                }`}
                        >
                            {/* Badge */}
                            {feature.badge && (
                                <div className="absolute -top-3 left-4">
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${feature.badge === 'Star Feature' || feature.badge === 'Community Power' || feature.badge === 'Learn Smart'
                                            ? 'bg-amber-500 text-slate-900'
                                            : 'bg-slate-700 text-slate-300'
                                        }`}>
                                        {feature.badge}
                                    </span>
                                </div>
                            )}

                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.highlighted
                                    ? 'bg-amber-500/20'
                                    : 'bg-cyan-500/10'
                                }`}>
                                <feature.icon className={`w-6 h-6 ${feature.highlighted ? 'text-amber-400' : 'text-cyan-400'
                                    }`} />
                            </div>

                            {/* Content */}
                            <h3 className="text-xl font-bold text-white mb-2">
                                {feature.title}
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-3">
                                {feature.description}
                            </p>

                            {/* Callout for highlighted features */}
                            {feature.callout && (
                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                    <p className="text-sm text-amber-400/80 italic">
                                        &ldquo;{feature.callout}&rdquo;
                                    </p>
                                </div>
                            )}

                            {/* Golden glow effect for highlighted cards */}
                            {feature.highlighted && (
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/5 to-cyan-500/5 pointer-events-none" />
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
