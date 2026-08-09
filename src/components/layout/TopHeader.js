'use client';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function TopHeader({ title, liveMatch }) {
  const { logout } = useAuth();

  return (
    <header className="top-header">
      <div className="header-left">
        <span className="header-title">{title}</span>
        {liveMatch && (
          <div className="live-ticker">
            <span className="live-dot" />
            <span>LIVE NOW</span>
            <span style={{ color: 'var(--text)', fontWeight: 400 }}>
              {liveMatch}
            </span>
          </div>
        )}
      </div>
      <div className="header-right">
        <button className="header-btn" title="Notifications">
          <Bell size={16} strokeWidth={1.8} />
        </button>
        <button className="header-btn" onClick={logout} title="Sign out">
          <LogOut size={16} strokeWidth={1.8} />
        </button>
        <div className="header-avatar" title="Admin">
          FK
        </div>
      </div>
    </header>
  );
}
