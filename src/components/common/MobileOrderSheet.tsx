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
                        className="md:hidden fixed inset-0 bg-black/50 z-[110]"
                        onClick={() => setOpen(false)}
                    />
                    {/* Sheet — sits above backdrop & bottom nav */}
                    <div className="md:hidden fixed inset-x-0 top-[10vh] bottom-0 z-[120] bg-surface-container-lowest rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
                        {/* Handle + header */}
                        <div className="relative flex items-center justify-between px-4 pt-5 pb-2 border-b border-surface-container-highest shrink-0">
                            <div className="w-10 h-1 bg-surface-dim rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                                Place Order
                            </span>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-on-surface-variant hover:text-on-surface text-xl leading-none"
                            >
                                ✕
                            </button>
                        </div>
                        {/* OrderPanel scrolls inside sheet, padding accounts for safe-area */}
                        <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+16px)]">
                            <OrderPanel />
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
