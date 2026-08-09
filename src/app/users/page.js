'use client';
import { useEffect, useState } from 'react';
import { Search, Shield, Users, Star, ChevronRight, X } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { getPlayers, getMyLeagues, getLeagueStandings, getTeamSquad } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { useWebSocket } from '../../hooks/useWebSocket';

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const POS_CLASS = { GK: 'pos-gk', DEF: 'pos-def', MID: 'pos-mid', FWD: 'pos-fwd' };

export default function UsersPage() {
  const { addToast } = useToast();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('PLAYERS');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [squad, setSquad] = useState(null);
  const [loadingSquad, setLoadingSquad] = useState(false);

  const load = async () => {
    try {
      const [pData, lData] = await Promise.all([getPlayers(), getMyLeagues()]);
      setPlayers(Array.isArray(pData) ? pData : []);

      // Get standings from global league for team list
      const globalLeague = (Array.isArray(lData) ? lData : []).find(l => l.isGlobal);
      if (globalLeague) {
        const s = await getLeagueStandings(globalLeague.id);
        setTeams(s?.standings || []);
      }
    } catch (e) {
      addToast('Could not load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useWebSocket({
    // Fired after finalize-gameweek banks season totals — this team list and
    // the currently-open squad panel would otherwise show pre-finalize points.
    onLeaderboardUpdated: () => {
      load();
      if (selectedTeam) {
        getTeamSquad(selectedTeam.id).then(d => setSquad(d?.squadPlayers || [])).catch(() => {});
      }
    },
  });

  const handleTeamClick = async (team) => {
    setSelectedTeam(team);
    setLoadingSquad(true);
    setSquad(null);
    try {
      const data = await getTeamSquad(team.id);
      setSquad(data?.squadPlayers || []);
    } catch (e) {
      addToast('Could not load squad', 'error');
    } finally {
      setLoadingSquad(false);
    }
  };

  const filteredPlayers = players.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.realClub?.toLowerCase().includes(q);
  });

  const filteredTeams = teams.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.teamName?.toLowerCase().includes(q) || t.managerName?.toLowerCase().includes(q);
  });

  return (
    <AppShell title="Users & Teams">
      <div className="page-header">
        <h1 className="page-title font-syne">Users & Teams</h1>
        <p className="page-subtitle">Monitor all registered managers and their squads.</p>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--surface-2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {['PLAYERS', 'USERS & TEAMS'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 8, border: 'none' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-bar mb-6" style={{ maxWidth: 400 }}>
        <Search size={15} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search entries..."
        />
      </div>

      <div className="grid-sidebar">
        <div>
          {loading ? (
            [1,2,3,4,5].map(i => <div key={i} className="skeleton mb-3" style={{ height: 72, borderRadius: 12 }} />)
          ) : activeTab === 'PLAYERS' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredPlayers.map((p, i) => (
                <div key={p.id} className="player-card" style={{ animationDelay: `${i * 20}ms` }}>
                  <div className="player-avatar">
                    <Star size={16} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
                  </div>
                  <div className="player-info">
                    <div className="player-name">{p.name}</div>
                    <div className="player-club">{p.realClub}</div>
                  </div>
                  <span className={`position-badge ${POS_CLASS[p.position] || ''}`}>{p.position}</span>
                  <span className="player-price">₵{p.price?.toFixed(1)}m</span>
                  <span className="player-points">{p.totalPoints ?? 0}</span>
                </div>
              ))}
              {filteredPlayers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-2)' }}>No players found</div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTeams.map((t, i) => (
                <button
                  key={t.id || i}
                  className="player-card"
                  style={{
                    animationDelay: `${i * 20}ms`,
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: selectedTeam?.id === t.id ? 'var(--accent-dim2)' : 'var(--surface)',
                    borderColor: selectedTeam?.id === t.id ? 'var(--accent)' : undefined,
                  }}
                  onClick={() => handleTeamClick(t)}
                >
                  <div className="player-avatar" style={{ background: 'var(--brand)' }}>
                    <Shield size={16} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
                  </div>
                  <div className="player-info">
                    <div className="player-name">{t.teamName}</div>
                    <div className="player-club">Managed by {t.managerName || '—'}</div>
                  </div>
                  <span className="player-points">{t.totalPoints ?? 0}</span>
                  <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
                </button>
              ))}
              {filteredTeams.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-2)' }}>No teams found</div>
              )}
            </div>
          )}
        </div>

        {/* Team detail panel */}
        <div>
          {selectedTeam ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">TEAM IDENTITY</div>
                </div>
                <button className="modal-close" onClick={() => { setSelectedTeam(null); setSquad(null); }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={32} strokeWidth={1} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800 }}>{selectedTeam.teamName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Managed by {selectedTeam.managerName || '—'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 16px' }}>
                    <div className="stat-card-label">RANK</div>
                    <div className="font-syne" style={{ fontSize: 20, fontWeight: 800 }}>—</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 16px' }}>
                    <div className="stat-card-label">POINTS</div>
                    <div className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
                      {selectedTeam.totalPoints?.toLocaleString() ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Squad list */}
              {loadingSquad ? (
                <div style={{ padding: 20 }}>
                  {[1,2,3,4,5].map(i => <div key={i} className="skeleton mb-2" style={{ height: 36, borderRadius: 6 }} />)}
                </div>
              ) : squad && squad.length > 0 ? (
                <div>
                  <div style={{ padding: '0 20px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>
                    STARTING XI
                  </div>
                  {POSITIONS.map(pos => {
                    const rowPlayers = squad.filter(p => p.isOnPitch && p.position === pos);
                    return rowPlayers.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', width: 28, flexShrink: 0 }}>{pos}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                        {p.pointsThisGw > 0 && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Star size={10} />
                            {p.pointsThisGw}
                          </span>
                        )}
                      </div>
                    ));
                  })}
                </div>
              ) : squad !== null ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                  No squad data
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card" style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>
                <Users size={24} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
                <p className="text-sm">Select a team to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
