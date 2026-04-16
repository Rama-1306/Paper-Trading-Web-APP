'use client';

import { motion } from 'framer-motion';
import { UserPlus, GraduationCap, Target, Brain, Trophy } from 'lucide-react';

const steps = [
    {
        icon: UserPlus,
        title: 'Sign Up Free',
        description: 'Create your free account in 30 seconds. No credit card. No broker account needed to start.'
    },
    {
        icon: GraduationCap,
        title: 'Learn Structured',
        description: 'Follow curated learning paths from handpicked YouTube playlists. Organized by topic and skill level.'
    },
    {
        icon: Target,
        title: 'Practice Paper Trading',
        description: 'Place paper orders on real live market data. Track positions, set stop-losses and targets.'
    },
    {
        icon: Brain,
        title: 'Journal & Build Patterns',
        description: 'Log every trade with context. SAHAAI\'s AI identifies your winning patterns (80%+ match).'
    },
    {
        icon: Trophy,
        title: 'Compete & Grow',
        description: 'Join paper trading competitions, follow top traders, climb leaderboards, and refine your edge.'
    }
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 bg-slate-800/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        From Zero to Confident Trader in 5 Steps
                    </h2>
                </motion.div>

                {/* Steps - Desktop */}
                <div className="hidden lg:flex items-start justify-between relative">
                    {/* Connection Line */}
                    <div className="absolute top-10 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-amber-500 to-cyan-500" />

                    {steps.map((step, index) => (
                        <motion.div
                            key={step.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.15 }}
                            className="relative flex flex-col items-center text-center max-w-[200px] z-10"
                        >
                            <div className="w-20 h-20 bg-slate-900 border-4 border-slate-700 rounded-full flex items-center justify-center mb-4">
                                <step.icon className="w-8 h-8 text-cyan-400" />
                            </div>
                            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center mb-4 -mt-2">
                                <span className="text-sm font-bold text-slate-900">{index + 1}</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">
                                {step.title}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Steps - Mobile/Tablet */}
                <div className="lg:hidden space-y-8">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.title}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-4"
                        >
                            <div className="flex-shrink-0 w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-slate-900">{index + 1}</span>
                            </div>
                            <div className="pt-2">
                                <h3 className="text-lg font-bold text-white mb-1">
                                    {step.title}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {step.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
