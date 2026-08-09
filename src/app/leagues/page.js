'use client';
import { useEffect, useState } from 'react';
import { Shield, Users, Plus, ChevronRight, Trophy } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import Modal from '../../components/ui/Modal';
import { getMyLeagues, getLeagueStandings, createLeague } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function LeaguesPage() {
  const { addToast } = useToast();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [standings, setStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getMyLeagues();
      setLeagues(Array.isArray(data) ? data : []);
    } catch (e) {
      addToast('Could not load leagues', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useWebSocket({
    // Fired after finalize-gameweek banks season totals. Refresh the league
    // list (member counts can shift) and, if a league is open, its standings
    // — otherwise this view silently shows pre-finalize numbers.
    onLeaderboardUpdated: () => {
      load();
      if (selected) {
        getLeagueStandings(selected.id).then(setStandings).catch(() => {});
      }
    },
  });

  const handleLeagueClick = async (league) => {
    setSelected(league);
    setLoadingStandings(true);
    try {
      const data = await getLeagueStandings(league.id);
      setStandings(data);
    } catch (e) {
      addToast('Could not load standings', 'error');
    } finally {
      setLoadingStandings(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { addToast('Enter a league name', 'error'); return; }
    setSaving(true);
    try {
      const result = await createLeague(newName.trim());
      addToast(`League created! Code: ${result?.joinCode}`, 'success');
      setShowCreate(false);
      setNewName('');
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const global = leagues.filter(l => l.isGlobal);
  const invitational = leagues.filter(l => !l.isGlobal);

  return (
    <AppShell title="Leagues">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title font-syne">Leagues</h1>
            <p className="page-subtitle">{leagues.length} active leagues · {global.length} global · {invitational.length} invitational</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create League
          </button>
        </div>
      </div>

      <div className="grid-sidebar">
        {/* League list */}
        <div>
          {loading ? (
            [1,2,3].map(i => <div key={i} className="skeleton mb-4" style={{ height: 80, borderRadius: 16 }} />)
          ) : (
            <>
              {global.length > 0 && (
                <div className="mb-6">
                  <div className="section-header">
                    <span className="section-title">Global Leagues</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {global.map(l => (
                      <LeagueRow key={l.id} league={l} onClick={handleLeagueClick} active={selected?.id === l.id} />
                    ))}
                  </div>
                </div>
              )}
              {invitational.length > 0 && (
                <div>
                  <div className="section-header">
                    <span className="section-title">Invitational Leagues</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {invitational.map(l => (
                      <LeagueRow key={l.id} league={l} onClick={handleLeagueClick} active={selected?.id === l.id} />
                    ))}
                  </div>
                </div>
              )}
              {leagues.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-2)' }}>
                  <Shield size={32} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p>No leagues yet</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Standings panel */}
        <div>
          {selected ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{selected.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontFamily: 'DM Mono, monospace' }}>
                    CODE: {selected.joinCode}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div style={{ padding: '0 0 8px' }}>
                {loadingStandings ? (
                  [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 44, margin: '4px 16px', borderRadius: 8 }} />)
                ) : standings?.standings?.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Team</th>
                        <th>GW</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.standings.map((row, i) => (
                        <tr key={row.id || i}>
                          <td>
                            {i === 0 ? <Trophy size={14} style={{ color: '#ffd700' }} /> :
                             i === 1 ? <Trophy size={14} style={{ color: '#c0c0c0' }} /> :
                             i === 2 ? <Trophy size={14} style={{ color: '#cd7f32' }} /> :
                             <span className="text-mono text-muted">{i + 1}</span>}
                          </td>
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{row.teamName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.managerName}</div>
                          </td>
                          <td><span className="text-mono">{row.gwPoints ?? 0}</span></td>
                          <td><span className="font-syne" style={{ color: 'var(--accent)', fontWeight: 800 }}>{row.totalPoints ?? 0}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>No standings yet</div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="text-muted text-sm">Select a league to view standings</p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setNewName(''); }}
        title="Create League"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} onClick={handleCreate} disabled={saving}>
              {!saving && 'Create'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">League Name</label>
          <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. KNUST Official" maxLength={30} />
        </div>
      </Modal>
    </AppShell>
  );
}

function LeagueRow({ league, onClick, active }) {
  return (
    <button
      className="league-card"
      onClick={() => onClick(league)}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        borderColor: active ? 'var(--accent)' : undefined,
        background: active ? 'var(--accent-dim2)' : undefined,
      }}
    >
      <div className="league-card-icon">
        <Shield size={20} strokeWidth={1.5} />
      </div>
      <div className="league-info">
        <div className="league-name">{league.name}</div>
        <div className="league-meta">
          <span className={`league-type-badge ${league.isGlobal ? 'badge-global' : 'badge-invitational'}`}>
            {league.isGlobal ? 'GLOBAL' : 'INVITATIONAL'}
          </span>
          <Users size={12} />
          <span>{league.memberCount ?? '—'} members</span>
        </div>
        {league.joinCode && (
          <div className="join-code" style={{ marginTop: 4, fontSize: 11 }}>{league.joinCode}</div>
        )}
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
    </button>
  );
}
