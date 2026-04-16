'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface PricingPlansProps {
    onSignUpClick: () => void;
}

const plans = [
    {
        name: 'Free',
        price: '₹0',
        period: 'forever',
        description: 'Get started with the basics',
        color: 'slate',
        features: [
            { name: 'Paper trading with live data', included: true },
            { name: 'Basic trade journal (30 days history)', included: true },
            { name: 'Live charts (basic timeframes)', included: true },
            { name: 'Option chain viewer', included: true },
            { name: 'Community access (read-only)', included: true },
            { name: 'Learning Hub (beginner playlists only)', included: true },
            { name: 'Daily AI market summary (1 per day)', included: true },
            { name: 'AI Pattern Memory', included: false },
            { name: 'Strategy backtesting engine', included: false },
            { name: 'Option strike heat maps', included: false },
            { name: 'Hedging strategy builder', included: false },
            { name: 'Social pattern access', included: false },
            { name: 'Paper trading competitions', included: false },
        ],
        cta: 'Start Free'
    },
    {
        name: 'Starter',
        price: '₹300',
        period: '/3 months',
        description: 'Just ₹100/month — Best Value',
        color: 'cyan',
        highlighted: true,
        badge: 'Best Value',
        features: [
            { name: 'Paper trading with live data', included: true },
            { name: 'Full trade journal with screenshots & emotion tagging', included: true },
            { name: 'AI Pattern Memory — 80%+ match retrieval', included: true },
            { name: 'Strategy backtesting engine with custom rules', included: true },
            { name: 'Option strike heat maps', included: true },
            { name: 'Hedging strategy builder (Iron Condor, spreads, etc.)', included: true },
            { name: 'Social pattern access (view & follow top traders)', included: true },
            { name: 'Paper trading competitions & leaderboards', included: true },
            { name: 'Learning Hub (all levels, all categories)', included: true },
            { name: 'Telegram alerts', included: true },
            { name: 'AI market reports (3x daily)', included: true },
            { name: 'Trade Replay (when available)', included: true },
        ],
        cta: 'Get Started — ₹300/3 months'
    },
    {
        name: 'Pro',
        price: '₹599',
        period: '/month',
        description: 'Full access to all features',
        color: 'amber',
        features: [
            { name: 'Everything in Starter, plus:', included: true },
            { name: 'AI Custom Scanner & Indicator Builder', included: true },
            { name: 'Advanced AI Trade Coaching & behavioral insights', included: true },
            { name: 'AI Pattern Memory — unlimited pattern storage', included: true },
            { name: 'Priority real-time AI market reports', included: true },
            { name: 'WhatsApp alerts', included: true },
            { name: 'Social pattern sharing (publish your own patterns)', included: true },
            { name: 'Monthly challenge rewards & badges', included: true },
            { name: 'Mentor–Student mode', included: true },
            { name: 'Priority support', included: true },
            { name: 'Early access to all new features', included: true },
        ],
        cta: 'Go Pro'
    }
];

export default function PricingPlans({ onSignUpClick }: PricingPlansProps) {
    return (
        <section id="pricing" className="py-24 bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        Start free with 30% of features. Unlock 70% at India's most affordable trading platform price.
                    </p>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative rounded-2xl p-8 ${plan.highlighted
                                    ? 'bg-gradient-to-br from-cyan-900/30 to-slate-900 border-2 border-cyan-500 shadow-lg shadow-cyan-500/20'
                                    : 'bg-slate-800/50 border border-slate-700'
                                }`}
                        >
                            {/* Badge */}
                            {plan.badge && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                    <span className="px-4 py-1 bg-amber-500 text-slate-900 text-sm font-bold rounded-full">
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            {/* Header */}
                            <div className="text-center mb-6">
                                <h3 className={`text-xl font-bold mb-2 ${plan.color === 'cyan' ? 'text-cyan-400' :
                                        plan.color === 'amber' ? 'text-amber-400' : 'text-white'
                                    }`}>
                                    {plan.name}
                                </h3>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                                    <span className="text-slate-400">{plan.period}</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-2">{plan.description}</p>
                            </div>

                            {/* Features */}
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((feature) => (
                                    <li key={feature.name} className="flex items-start gap-3">
                                        {feature.included ? (
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <X className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                                        )}
                                        <span className={feature.included ? 'text-slate-300' : 'text-slate-500'}>
                                            {feature.name}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA Button */}
                            <button
                                onClick={onSignUpClick}
                                className={`w-full py-3 rounded-xl font-bold transition-all ${plan.highlighted
                                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 hover:shadow-lg hover:shadow-cyan-500/25'
                                        : plan.color === 'amber'
                                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                                    }`}
                            >
                                {plan.cta}
                            </button>
                        </motion.div>
                    ))}
                </div>

                {/* Footer Note */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="text-center mt-12 text-slate-400 text-sm"
                >
                    <p>All paid plans include live Fyers data feed and real-time WebSocket streaming.</p>
                    <p className="mt-2">Switch plans anytime. No lock-in contracts. Cancel whenever.</p>
                    <p className="mt-4 text-amber-400 font-medium">
                        🎉 Launch offer: First 500 users get Starter plan at ₹300/3 months — locked for life.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
