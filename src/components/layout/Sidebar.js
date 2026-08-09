'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Hexagon, LayoutDashboard, Swords, Users, Trophy,
  Radio, ChevronLeft, ChevronRight, Shield, Star,
  LogOut, Settings
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/matches',   icon: Swords,          label: 'Matches' },
  { href: '/players',   icon: Star,            label: 'Players' },
  { href: '/users',     icon: Users,           label: 'Users & Teams' },
  { href: '/leagues',   icon: Shield,          label: 'Leagues' },
  { href: '/broadcast', icon: Radio,           label: 'Broadcast' },
  { href: '/tournament',icon: Trophy,          label: 'Tournament' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Hexagon size={18} strokeWidth={1.5} />
        </div>
        <span className="sidebar-logo-text font-syne">FANTASY KNUST</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${pathname === href ? 'active' : ''}`}
          >
            <Icon size={18} className="nav-icon" strokeWidth={1.8} />
            <span className="nav-label">{label}</span>
          </Link>
        ))}
      </nav>

      <div>
        <button
          className="nav-item"
          onClick={logout}
          style={{ width: '100%', textAlign: 'left', borderRadius: '6px', margin: '0 0 4px 0' }}
        >
          <LogOut size={18} className="nav-icon" strokeWidth={1.8} />
          <span className="nav-label">Sign Out</span>
        </button>

        <button
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed
            ? <ChevronRight size={18} />
            : <ChevronLeft size={18} />
          }
        </button>
      </div>
    </aside>
  );
}
