'use client';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopHeader from './TopHeader';
import { useAuth } from '../../hooks/useAuth';

export default function AppShell({ children, title, liveMatch }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopHeader title={title} liveMatch={liveMatch} />
        <main className="page-wrapper">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
