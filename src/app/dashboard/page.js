'use client';
import { useEffect, useState } from 'react';
import { Users, Shield, Calendar, Activity, Zap, Plus, Play, Radio, ClipboardList, Trophy } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import StatCard from '../../components/ui/StatCard';
import { getMatches, getCurrentGameweek, getTeams } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast } from '../../hooks/useToast';
import { timeAgo } from '../../components/ui/dateUtils';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [matches, setMatches] = useState([]);
  const [gameweek, setGameweek] = useState(null);
  const [standings, setStandings] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // allSettled, not all. These three are independent sources — a failure in
  // one is not a reason to discard the other two. The previous Promise.all
  // meant a single rejection (getMyLeagues 404s for any account without a
  // fantasy team, which every admin is) threw away the matches and gameweek
  // that had already come back, and the whole dashboard rendered empty.
  const loadData = async () => {
    const [matchRes, gwRes, teamRes] = await Promise.allSettled([
      getMatches(),
      getCurrentGameweek(),
      getTeams(),
    ]);

    const mArr = matchRes.status === 'fulfilled' && Array.isArray(matchRes.value)
      ? matchRes.value : [];
    setMatches(mArr);
    setLiveMatches(mArr.filter(m => m.live));

    if (gwRes.status === 'fulfilled') setGameweek(gwRes.value);

    setStandings(
      teamRes.status === 'fulfilled' && Array.isArray(teamRes.value) ? teamRes.value : []
    );

    // Name what actually failed instead of a blanket "could not load".
    const failed = [
      matchRes.status === 'rejected' && 'matches',
      gwRes.status === 'rejected' && 'gameweek',
      teamRes.status === 'rejected' && 'teams',
    ].filter(Boolean);

    if (failed.length) addToast(`Could not load ${failed.join(', ')}`, 'error');

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useWebSocket({
    // The socket payload keys the match as `matchId`, while every REST match
    // object uses `id` — patching the two together in place silently produced
    // duplicate/stale entries. Just refetch; it's the same source of truth
    // the Matches page already uses for these events.
    onMatchLive: (data) => {
      addToast(`Match went live: ${data.homeTeam} vs ${data.awayTeam}`, 'info');
      loadData();
    },
    onMatchCompleted: () => loadData(),
    onPointsUpdated: () => {
      addToast('Points updated', 'success');
      loadData();
    },
    // Fired by AdminController after finalize-gameweek banks every team's
    // season total, and by recalculate — Top Teams would otherwise stay stale
    // until manual reload.
    onLeaderboardUpdated: () => loadData(),
    // The Gameweek stat card reads /api/gameweek/current; set-deadline and
    // start-gameweek change it.
    onGameweekUpdated: () => loadData(),
  });

  const today = matches.filter(m => {
    if (!m.kickoffTime) return false;
    const d = new Date(m.kickoffTime);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const goalsScored = matches
    .filter(m => m.completed)
    .reduce((acc, m) => acc + (m.homeScore || 0) + (m.awayScore || 0), 0);

  const liveLabel = liveMatches.length > 0
    ? `${liveMatches[0].homeTeam} ${liveMatches[0].homeScore ?? 0} - ${liveMatches[0].awayScore ?? 0} ${liveMatches[0].awayTeam}`
    : null;

  const completedMatches = matches.filter(m => m.completed);
  // Real teams pulled from actual scheduled/played matches, not a hardcoded list.
  const activeTeams = new Set(matches.flatMap(m => [m.homeTeam, m.awayTeam]).filter(Boolean));
  const topTeams = [...standings].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)).slice(0, 5);

  const activities = [
    ...completedMatches.slice(-3).map(m => ({
      icon: ClipboardList,
      iconBg: 'var(--accent-dim)',
      iconColor: 'var(--accent)',
      title: 'Match Results Confirmed',
      sub: `${m.homeTeam} vs ${m.awayTeam}`,
      time: m.kickoffTime ? timeAgo(m.kickoffTime) : '—',
    })),
    ...liveMatches.map(m => ({
      icon: Activity,
      iconBg: 'var(--danger-dim)',
      iconColor: 'var(--danger)',
      title: 'Match Live',
      sub: `${m.homeTeam} vs ${m.awayTeam}`,
      time: 'now',
    })),
  ].slice(0, 5);

  const QUICK_ACTIONS = [
    { icon: Plus, label: 'Create New Match', href: '/matches', primary: true },
    { icon: Play, label: 'Start Live Match', href: '/matches' },
    { icon: Radio, label: 'Send Broadcast', href: '/broadcast' },
    { icon: ClipboardList, label: 'Submit Result', href: '/matches' },
  ];

  return (
    <AppShell title="Dashboard" liveMatch={liveLabel}>
      <div className="page-header">
        <h1 className="page-title font-syne">Dashboard</h1>
        <p className="page-subtitle">Welcome back, Administrator. Here's your daily league overview.</p>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <StatCard
          icon={Users}
          label="Registered Teams"
          value={standings.length}
          delay={0}
        />
        <StatCard
          icon={Shield}
          label="Teams In Play"
          value={activeTeams.size}
          delay={50}
        />
        <StatCard
          icon={Calendar}
          label="Gameweek"
          value={`GW ${String(gameweek?.id || '—').padStart(2, '0')}`}
          badge={gameweek ? 'ACTIVE' : ''}
          badgeClass="badge-green"
          delay={100}
        />
        <StatCard
          icon={Activity}
          label="Matches Today"
          value={today.length || 0}
          delay={150}
        />
        <StatCard
          icon={Trophy}
          label="Goals Scored"
          value={goalsScored}
          delay={200}
        />
      </div>

      <div className="grid-sidebar">
        <div>
          {/* Recent Activity */}
          <div className="card mb-6">
            <div className="card-header">
              <span className="card-title">Recent Activity</span>
              <button
                className="text-sm text-accent"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                onClick={() => router.push('/matches')}
              >
                View All
              </button>
            </div>
            <div className="card-body">
              {loading ? (
                [1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="skeleton" style={{ height: 14, width: '60%' }} />
                      <div className="skeleton" style={{ height: 12, width: '40%' }} />
                    </div>
                  </div>
                ))
              ) : activities.length === 0 ? (
                <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 0' }}>No recent activity</p>
              ) : (
                activities.map((a, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-icon" style={{ background: a.iconBg }}>
                      <a.icon size={16} style={{ color: a.iconColor }} strokeWidth={2} />
                    </div>
                    <div className="activity-body">
                      <div className="activity-title">{a.title}</div>
                      <div className="activity-sub">{a.sub}</div>
                    </div>
                    <div className="activity-time">{a.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stadium card */}
          <div className="stadium-card">
            <div className="stadium-card-bg" />
            <div className="stadium-card-grid" />
            <div className="stadium-card-content">
              <div className="stadium-label">League Partner</div>
              <div className="stadium-title">KNUST Inter-Hall Games 2024</div>
            </div>
          </div>
        </div>

        {/* Quick Controls */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Quick Control</span>
            </div>
            <div style={{ padding: 16 }}>
              <div className="quick-actions">
                {QUICK_ACTIONS.map((a, i) => (
                  <button
                    key={i}
                    className={`quick-action-item ${a.primary ? 'primary' : ''}`}
                    onClick={() => router.push(a.href)}
                  >
                    <div className="quick-action-icon">
                      <a.icon size={16} strokeWidth={2} />
                    </div>
                    {a.label}
                    <Zap size={14} className="quick-action-arrow" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top teams — real standings, not a static roster */}
          <div className="card mt-4">
            <div className="card-header">
              <span className="card-title">Top Teams</span>
              <button
                className="text-sm text-accent"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                onClick={() => router.push('/leagues')}
              >
                View All
              </button>
            </div>
            <div style={{ padding: '8px 16px' }}>
              {loading ? (
                [1,2,3].map(i => <div key={i} className="skeleton mb-2" style={{ height: 40, borderRadius: 8 }} />)
              ) : topTeams.length === 0 ? (
                <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '16px 0' }}>No standings yet</p>
              ) : (
                topTeams.map((t, i) => (
                  <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Shield size={14} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t.teamName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.managerName || '—'}</div>
                      </div>
                    </div>
                    <span className="font-syne" style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>
                      {t.totalPoints?.toLocaleString() ?? 0}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
