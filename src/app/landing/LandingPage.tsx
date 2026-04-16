'use client';

import { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import StatsBar from './components/StatsBar';
import FeaturesGrid from './components/FeaturesGrid';
import HowItWorks from './components/HowItWorks';
import PricingPlans from './components/PricingPlans';
import UniqueAdvantages from './components/UniqueAdvantages';
import MarketOpportunity from './components/MarketOpportunity';
import PlatformShowcase from './components/PlatformShowcase';
import AboutFounder from './components/AboutFounder';
import CTABanner from './components/CTABanner';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';

export default function LandingPage() {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-900">
            <Navbar onSignInClick={() => setIsAuthModalOpen(true)} />

            <main>
                <HeroSection onSignUpClick={() => setIsAuthModalOpen(true)} />
                <StatsBar />
                <FeaturesGrid />
                <HowItWorks />
                <PlatformShowcase />
                <PricingPlans onSignUpClick={() => setIsAuthModalOpen(true)} />
                <UniqueAdvantages />
                <MarketOpportunity />
                <AboutFounder />
                <CTABanner onSignUpClick={() => setIsAuthModalOpen(true)} />
            </main>

            <Footer />

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </div>
    );
}
