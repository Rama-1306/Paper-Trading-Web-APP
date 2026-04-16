'use client';

import { motion } from 'framer-motion';

interface CTABannerProps {
    onSignUpClick: () => void;
}

export default function CTABanner({ onSignUpClick }: CTABannerProps) {
    return (
        <section className="py-24 bg-gradient-to-br from-cyan-900/30 via-slate-900 to-amber-900/20 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />

            <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                        Ready to Trade Smarter?
                    </h2>
                    <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
                        Join SAHAAI — India's most feature-rich paper trading & learning platform. Free to start.
                    </p>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onSignUpClick}
                        className="px-10 py-4 bg-white text-slate-900 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl text-lg"
                    >
                        Create Free Account
                    </motion.button>

                    <p className="mt-6 text-slate-400">
                        Join 🐙 and let the Octopus Hands guide your trading journey.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
