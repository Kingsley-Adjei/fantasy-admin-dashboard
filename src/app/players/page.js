'use client';
import { useEffect, useState } from 'react';
import { Search, Star, ChevronUp, ChevronDown } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { getPlayers } from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const POSITIONS = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];

const POS_CLASS = { GK: 'pos-gk', DEF: 'pos-def', MID: 'pos-mid', FWD: 'pos-fwd' };

export default function PlayersPage() {
  const { addToast } = useToast();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState('totalPoints');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    getPlayers()
      .then(data => setPlayers(Array.isArray(data) ? data : []))
      .catch(() => addToast('Could not load players', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = players
    .filter(p => {
      if (posFilter !== 'ALL' && p.position !== posFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name?.toLowerCase().includes(q) || p.realClub?.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const totalVal = players.reduce((s, p) => s + (p.price || 0), 0);
  const avgPts = players.length
    ? Math.round(players.reduce((s, p) => s + (p.totalPoints || 0), 0) / players.length)
    : 0;

  return (
    <AppShell title="Players">
      <div className="page-header">
        <h1 className="page-title font-syne">Player Database</h1>
        <p className="page-subtitle">{players.length} registered players across all teams</p>
      </div>

      {/* Summary row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card animate-in" style={{ animationDelay: '0ms' }}>
          <div className="stat-card-value font-syne">{players.length}</div>
          <div className="stat-card-label">Total Players</div>
        </div>
        <div className="stat-card animate-in" style={{ animationDelay: '50ms' }}>
          <div className="stat-card-value font-syne">₵{totalVal.toFixed(1)}m</div>
          <div className="stat-card-label">Combined Value</div>
        </div>
        <div className="stat-card animate-in" style={{ animationDelay: '100ms' }}>
          <div className="stat-card-value font-syne">{avgPts}</div>
          <div className="stat-card-label">Avg Total Points</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div style={{ padding: '14px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: '1 1 220px' }}>
            <Search size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players or clubs..."
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {POSITIONS.map(p => (
              <button
                key={p}
                onClick={() => setPosFilter(p)}
                className={`btn btn-sm ${posFilter === p ? 'btn-brand' : 'btn-ghost'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-wrapper">
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Club</th>
                <th>Pos</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('price')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Price <SortIcon k="price" /></span>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('pointsThisGw')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>GW Pts <SortIcon k="pointsThisGw" /></span>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalPoints')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Total <SortIcon k="totalPoints" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className="animate-in" style={{ animationDelay: `${i * 15}ms` }}>
                  <td>
                    <span className="text-mono text-muted">{String(i + 1).padStart(2, '0')}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="player-avatar" style={{ width: 36, height: 36 }}>
                        <Star size={14} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-sm text-muted">{p.realClub}</span>
                  </td>
                  <td>
                    <span className={`position-badge ${POS_CLASS[p.position] || ''}`}>{p.position}</span>
                  </td>
                  <td>
                    <span className="text-mono" style={{ fontSize: 13 }}>₵{p.price?.toFixed(1)}m</span>
                  </td>
                  <td>
                    <span className="text-mono" style={{ color: p.pointsThisGw > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
                      {p.pointsThisGw ?? 0}
                    </span>
                  </td>
                  <td>
                    <span className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
                      {p.totalPoints ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>No players found</div>
          )}
        </div>
      )}
    </AppShell>
  );
}
