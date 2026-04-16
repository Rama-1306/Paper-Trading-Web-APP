'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
    onSignInClick: () => void;
}

export default function Navbar({ onSignInClick }: NavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Features', href: '#features' },
        { name: 'How It Works', href: '#how-it-works' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'About', href: '#about' },
    ];

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled
                        ? 'bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50'
                        : 'bg-transparent'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2">
                            <div className="relative w-10 h-10 md:w-12 md:h-12">
                                <Image
                                    src="/sahaai-favicon.png"
                                    alt="SAHAAI"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-xl md:text-2xl font-bold text-white">
                                SAHAAI
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    className="text-slate-300 hover:text-cyan-400 font-medium transition-colors"
                                >
                                    {link.name}
                                </a>
                            ))}
                        </div>

                        {/* Auth Buttons */}
                        <div className="hidden md:flex items-center gap-4">
                            <button
                                onClick={onSignInClick}
                                className="px-5 py-2.5 text-white font-medium border border-slate-600 rounded-xl hover:border-cyan-500 hover:text-cyan-400 transition-all"
                            >
                                Sign In
                            </button>
                            <button
                                onClick={onSignInClick}
                                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-cyan-500/25"
                            >
                                Start Free
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden p-2 text-white"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50">
                        <div className="px-4 py-4 space-y-3">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    className="block py-2 text-slate-300 hover:text-cyan-400 font-medium"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </a>
                            ))}
                            <div className="pt-4 flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        onSignInClick();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="w-full py-3 text-white font-medium border border-slate-600 rounded-xl"
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={() => {
                                        onSignInClick();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl"
                                >
                                    Start Free
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
}
