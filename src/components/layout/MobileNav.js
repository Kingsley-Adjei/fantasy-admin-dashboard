'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Swords, Radio, MoreHorizontal, Trophy } from 'lucide-react';

const TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/matches',   icon: Swords,          label: 'Matches' },
  { href: '/broadcast', icon: Radio,           label: 'Cast' },
  { href: '/tournament',icon: Trophy,          label: 'Season' },
  { href: '/players',   icon: MoreHorizontal,  label: 'More' },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav">
      {TABS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className={`mobile-nav-item ${pathname === href ? 'active' : ''}`}
        >
          <Icon strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
