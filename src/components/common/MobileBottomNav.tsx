'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/trade', label: 'Chart', icon: '📊' },
  { href: '/positions', label: 'Pos', icon: '📈' },
  { href: '/orders', label: 'Orders', icon: '📋' },
  { href: '/watchlist', label: 'Watch', icon: '👁' },
  { href: '/option-chain', label: 'Chain', icon: '🔗' },
  { href: '/alerts', label: 'Alerts', icon: '🔔' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-bottom-nav">
      {ITEMS.map(item => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-tab${active ? ' active' : ''}`}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
