'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const NAV_ITEMS = [
  { href: '/', icon: 'dashboard', label: 'Dashboard' },
  { href: '/trade', icon: 'candlestick_chart', label: 'Chart' },
  { href: '/positions', icon: 'account_balance_wallet', label: 'Positions' },
  { href: '/orders', icon: 'receipt_long', label: 'Orders' },
  { href: '/trades', icon: 'swap_horiz', label: 'Trades' },
  { href: '/watchlist', icon: 'visibility', label: 'Watchlist' },
  { href: '/option-chain', icon: 'table_chart', label: 'Option Chain' },
  { href: '/alerts', icon: 'notifications', label: 'Alerts' },
  { href: '/backtester', icon: 'query_stats', label: 'Backtester' },
  { href: '/signal-log', icon: 'bolt', label: 'Signals' },
];

export function SideNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fyers_access_token');
      localStorage.removeItem('activeSymbol');
      localStorage.removeItem('activeLotSize');
    }
    await signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full z-40 flex flex-col pt-16 bg-surface-container-low w-20 hover:w-64 transition-all duration-300 group overflow-hidden border-r border-surface-dim/20">
      {/* Account badge */}
      <div className="flex items-center gap-4 px-5 py-5 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-primary-fixed text-lg">
            account_balance_wallet
          </span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          <p className="font-bold text-[10px] uppercase tracking-widest text-on-surface">Global Ledger</p>
          <p className="text-[10px] text-on-surface-variant">Verified Account</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-2 flex-grow">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 px-3 py-3 rounded-none transition-all duration-200 ${active
                ? 'bg-primary-container text-on-primary-fixed border-l-4 border-on-primary-fixed'
                : 'text-on-surface hover:bg-surface-dim/40'
                }`}
            >
              <span className="material-symbols-outlined shrink-0 text-xl">{icon}</span>
              <span className="font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-200">
                {label}
              </span>
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-4 px-3 py-3 rounded-none transition-all duration-200 ${pathname === '/admin'
              ? 'bg-primary-container text-on-primary-fixed border-l-4 border-on-primary-fixed'
              : 'text-on-surface hover:bg-surface-dim/40'
              }`}
          >
            <span className="material-symbols-outlined shrink-0 text-xl">admin_panel_settings</span>
            <span className="font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-200">
              Admin
            </span>
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 pb-6 flex flex-col gap-1 border-t border-surface-dim/20">
        <Link
          href="/profile"
          className="flex items-center gap-4 px-3 py-3 text-on-surface hover:bg-surface-dim/40 transition-all"
        >
          <span className="material-symbols-outlined shrink-0 text-xl">person</span>
          <span className="font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-200">
            Profile
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-4 px-3 py-3 text-error hover:bg-error-container/40 transition-all w-full"
        >
          <span className="material-symbols-outlined shrink-0 text-xl">logout</span>
          <span className="font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-200">
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}
