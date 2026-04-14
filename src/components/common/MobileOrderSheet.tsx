'use client';

import { useState } from 'react';
import { OrderPanel } from '@/components/Trading/OrderPanel';

export function MobileOrderSheet() {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Floating "+" button — only on mobile, above bottom nav */}
            <button
                onClick={() => setOpen(true)}
                className="md:hidden fixed bottom-16 right-4 z-50 w-14 h-14 rounded-full bg-primary-container text-on-primary-fixed shadow-lg flex items-center justify-center text-2xl font-bold transition-transform active:scale-95"
                aria-label="Place Order"
            >
                +
            </button>

            {/* Bottom sheet overlay */}
            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        className="md:hidden fixed inset-0 bg-black/40 z-50"
                        onClick={() => setOpen(false)}
                    />
                    {/* Sheet */}
                    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
                        {/* Handle + header */}
                        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-surface-container-highest">
                            <div className="w-10 h-1 bg-surface-dim rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant pt-2">
                                Place Order
                            </span>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-on-surface-variant hover:text-on-surface text-xl leading-none pt-2"
                            >
                                ✕
                            </button>
                        </div>
                        {/* OrderPanel fills the sheet */}
                        <OrderPanel />
                    </div>
                </>
            )}
        </>
    );
}
