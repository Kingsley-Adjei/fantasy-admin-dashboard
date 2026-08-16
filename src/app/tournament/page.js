'use client';
import { useState, useEffect } from 'react';
import { Trophy, RefreshCw, AlertTriangle, CheckCircle, Activity, CalendarClock, PlayCircle } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import Modal from '../../components/ui/Modal';
import {
  recalculatePoints, finalizeGameweek, setDeadline, startGameweek,
  getMatches, getLeagues, getTeams, getCurrentGameweek,
} from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { useWebSocket } from '../../hooks/useWebSocket';

const GW_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12];

export default function TournamentPage() {
  const { addToast } = useToast();
  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [gameweek, setGameweek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [leader, setLeader] = useState(null);

  // Set-deadline form
  const [deadlineGw, setDeadlineGw] = useState(1);
  const [deadlineTime, setDeadlineTime] = useState('');
  const [deadlineSaving, setDeadlineSaving] = useState(false);

  // Start-gameweek form
  const [startGwId, setStartGwId] = useState(1);
  const [startGwDeadline, setStartGwDeadline] = useState('');
  const [startGwSaving, setStartGwSaving] = useState(false);

  // allSettled: the deadline and start-gameweek controls below only need the
  // gameweek, so a failure fetching matches or leagues must not disable them.
  const load = async () => {
    const [matchRes, leagueRes, gwRes, teamRes] = await Promise.allSettled([
      getMatches(),
      getLeagues(),
      getCurrentGameweek(),
      getTeams(),
    ]);

    setMatches(
      matchRes.status === 'fulfilled' && Array.isArray(matchRes.value) ? matchRes.value : []
    );
    setLeagues(
      leagueRes.status === 'fulfilled' && Array.isArray(leagueRes.value) ? leagueRes.value : []
    );

    if (gwRes.status === 'fulfilled' && gwRes.value) {
      setGameweek(gwRes.value);
      if (gwRes.value.id) {
        setDeadlineGw(gwRes.value.id);
        setStartGwId(gwRes.value.id + 1);
      }
    }

    // The overall leader is the top-ranked team platform-wide — teams already
    // arrive sorted by season total, so no second standings round-trip.
    if (teamRes.status === 'fulfilled' && teamRes.value?.length > 0) {
      setLeader(teamRes.value[0]);
    }

    const failed = [
      matchRes.status === 'rejected' && 'matches',
      leagueRes.status === 'rejected' && 'leagues',
      gwRes.status === 'rejected' && 'gameweek',
      teamRes.status === 'rejected' && 'teams',
    ].filter(Boolean);

    if (failed.length) addToast(`Could not load ${failed.join(', ')}`, 'error');

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useWebSocket({
    onMatchCompleted: () => load(),
    // Fired after finalize-gameweek banks season totals — the leader card
    // and match counters here would otherwise go stale until manual reload.
    onLeaderboardUpdated: () => load(),
    // set-deadline and start-gameweek both land here. This page's own forms
    // trigger them, so without it the "GW n ACTIVE" badge and the prefilled
    // gameweek numbers kept showing the values from before the action.
    onGameweekUpdated: () => load(),
  });

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      await recalculatePoints();
      addToast('Live gameweek scores refreshed', 'success');
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleFinalize = async () => {
    // Fail fast with a message that explains the fix, instead of letting the
    // server's NO_ACTIVE_GAMEWEEK ("there's no gameweek running right now")
    // contradict the header. Nothing is running until Start Gameweek is used.
    if (!gameweek?.active) {
      addToast('No gameweek is running. Use "Start Next Gameweek" below to open one first.', 'error');
      return;
    }
    if (confirmText !== 'CONFIRM') {
      addToast('Type CONFIRM to proceed', 'error'); return;
    }
    setFinalizeLoading(true);
    try {
      await finalizeGameweek();
      addToast('Gameweek finalized — scores banked', 'success');
      setShowConfirm(false);
      setConfirmText('');
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setFinalizeLoading(false);
    }
  };

  const handleSetDeadline = async () => {
    if (!deadlineTime) { addToast('Pick a kickoff time', 'error'); return; }
    setDeadlineSaving(true);
    try {
      const res = await setDeadline(deadlineGw, deadlineTime);
      addToast(res?.detail || 'Deadline updated', 'success');
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setDeadlineSaving(false);
    }
  };

  const handleStartGameweek = async () => {
    if (!startGwDeadline) { addToast('Pick a deadline', 'error'); return; }
    setStartGwSaving(true);
    try {
      await startGameweek(startGwId, startGwDeadline);
      addToast(`Gameweek ${startGwId} started`, 'success');
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setStartGwSaving(false);
    }
  };

  const incompleteMatches = matches.filter(m => !m.completed && !m.live);
  const completedMatches = matches.filter(m => m.completed);
  const liveLabel = matches.find(m => m.live);

  return (
    <AppShell title="Tournament" liveMatch={liveLabel ? `${liveLabel.homeTeam} vs ${liveLabel.awayTeam}` : null}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title font-syne">Gameweek Control</h1>
            <p className="page-subtitle">Manage deadlines, live scoring, and gameweek transitions.</p>
          </div>
          {gameweek?.active ? (
            <span className="status-pill status-live">
              <span className="live-dot" style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
              GW {gameweek?.id ?? '—'} ACTIVE
            </span>
          ) : (
            <span className="status-pill" style={{ background: 'rgba(255,159,10,0.15)', color: 'var(--warning)', border: '1px solid rgba(255,159,10,0.3)' }}>
              NO ACTIVE GAMEWEEK — start one below
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Leader card */}
          <div className="tournament-leader-card animate-in">
            <div className="card-title" style={{ marginBottom: 8, color: 'rgba(0,255,133,0.6)' }}>Tournament Leader</div>
            <div className="tournament-team-name">
              {leader?.teamName || 'TBD'}
            </div>
            <div className="tournament-meta">
              <div className="tournament-meta-item">
                <label>Total Points</label>
                <span className="tournament-meta-value font-mono">{leader?.totalPoints?.toLocaleString() ?? '—'}</span>
              </div>
              <div className="tournament-meta-item">
                <label>Manager</label>
                <span className="tournament-meta-value" style={{ fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>{leader?.managerName ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid-3 animate-in" style={{ animationDelay: '60ms' }}>
            <div className="card">
              <div style={{ padding: 20 }}>
                <div className="stat-card-label">Matches Completed</div>
                <div className="stat-card-value font-syne">{completedMatches.length}</div>
              </div>
            </div>
            <div className="card">
              <div style={{ padding: 20 }}>
                <div className="stat-card-label">Active Squads</div>
                <div className="stat-card-value font-syne">{leagues.reduce((s, l) => s + (l.memberCount || 0), 0) || '—'}</div>
              </div>
            </div>
            <div className="card">
              <div style={{ padding: 20 }}>
                <div className="stat-card-label">Pending Matches</div>
                <div className="stat-card-value font-syne" style={{ color: incompleteMatches.length > 0 ? 'var(--warning)' : 'var(--accent)' }}>
                  {incompleteMatches.length}
                </div>
              </div>
            </div>
          </div>

          {/* Deadline + Start gameweek */}
          <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="card animate-in" style={{ animationDelay: '100ms' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CalendarClock size={16} style={{ color: 'var(--text-3)' }} />
                  <span className="card-title">Set Kickoff / Deadline</span>
                </div>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="text-muted text-xs">Applies to every match in the chosen gameweek — also acts as the transfer lock for users.</p>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Gameweek</label>
                    <select className="form-select" value={deadlineGw} onChange={e => setDeadlineGw(Number(e.target.value))}>
                      {GW_OPTIONS.map(g => <option key={g} value={g}>GW {g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kickoff Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={deadlineTime}
                      onChange={e => setDeadlineTime(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  className={`btn btn-brand w-full ${deadlineSaving ? 'btn-loading' : ''}`}
                  onClick={handleSetDeadline}
                  disabled={deadlineSaving}
                >
                  {!deadlineSaving && 'Update Deadline'}
                </button>
              </div>
            </div>

            <div className="card animate-in" style={{ animationDelay: '120ms' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <PlayCircle size={16} style={{ color: 'var(--text-3)' }} />
                  <span className="card-title">Start Next Gameweek</span>
                </div>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="text-muted text-xs">Opens the gameweek so transfers/lineups become editable, and sets its deadline.</p>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Gameweek ID</label>
                    <input
                      type="number"
                      className="form-input"
                      min={1}
                      value={startGwId}
                      onChange={e => setStartGwId(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deadline</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={startGwDeadline}
                      onChange={e => setStartGwDeadline(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  className={`btn btn-primary w-full ${startGwSaving ? 'btn-loading' : ''}`}
                  onClick={handleStartGameweek}
                  disabled={startGwSaving}
                >
                  {!startGwSaving && `Start Gameweek ${startGwId}`}
                </button>
              </div>
            </div>
          </div>

          {/* System Actions */}
          <div className="card animate-in" style={{ animationDelay: '140ms' }}>
            <div className="card-header">
              <span className="card-title">System Actions</span>
              <Activity size={16} style={{ color: 'var(--text-3)' }} />
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className={`btn btn-brand btn-lg w-full ${recalcLoading ? 'btn-loading' : ''}`}
                onClick={handleRecalculate}
                disabled={recalcLoading}
              >
                {!recalcLoading && <><RefreshCw size={16} /> Recalculate Live Points</>}
              </button>
              <p className="text-muted text-xs">Refreshes this gameweek's live scores only — banked season totals are untouched.</p>
            </div>
          </div>

          {/* Critical Operations */}
          <div className="card animate-in" style={{ animationDelay: '160ms', borderColor: 'rgba(255,59,48,0.2)' }}>
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--danger)' }}>Critical Operations</span>
              <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {incompleteMatches.length > 0 && (
                <div style={{ background: 'var(--warning-dim)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warning)' }}>
                  <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                  {incompleteMatches.length} match{incompleteMatches.length > 1 ? 'es' : ''} still unfinished. The server refuses to finalize while matches are incomplete.
                </div>
              )}
              {!gameweek?.active && (
                <div style={{ background: 'var(--warning-dim)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warning)' }}>
                  <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                  No gameweek is currently running — matches may exist, but the gameweek itself was never opened. Use "Start Next Gameweek" above, then finalize when its matches are done.
                </div>
              )}
              <button
                className="btn btn-danger btn-lg w-full"
                onClick={() => setShowConfirm(true)}
                disabled={finalizeLoading || !gameweek?.active}
                style={{ borderRadius: 8, opacity: gameweek?.active ? 1 : 0.5 }}
              >
                <AlertTriangle size={16} /> Finalize Gameweek {gameweek?.active ? (gameweek?.id ?? '') : '(none active)'}
              </button>
            </div>
          </div>

          {/* Active Leagues summary */}
          {leagues.length > 0 && (
            <div className="card animate-in" style={{ animationDelay: '200ms' }}>
              <div className="card-header">
                <span className="card-title">Active Leagues</span>
              </div>
              <div style={{ padding: '8px 0' }}>
                {leagues.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trophy size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <span className={`league-type-badge ${l.isGlobal ? 'badge-global' : 'badge-invitational'}`}>
                          {l.isGlobal ? 'GLOBAL' : 'INVITATIONAL'}
                        </span>
                        <span className="text-muted text-xs">{l.memberCount ?? 0} Members</span>
                      </div>
                    </div>
                    {l.joinCode && <span className="join-code">{l.joinCode}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Finalize confirm modal */}
      <Modal
        open={showConfirm}
        onClose={() => { setShowConfirm(false); setConfirmText(''); }}
        title={`Finalize Gameweek ${gameweek?.id ?? ''}`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
            <button
              className={`btn btn-danger ${finalizeLoading ? 'btn-loading' : ''}`}
              onClick={handleFinalize}
              disabled={finalizeLoading || confirmText !== 'CONFIRM'}
            >
              {!finalizeLoading && 'Finalize'}
            </button>
          </>
        }
      >
        <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>This action is irreversible</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            This banks every team's score for GW {gameweek?.id ?? 'current'} into their season total and resets the
            weekly player breakdown. It finalizes this gameweek only — it does not end the season or declare an
            overall winner. Use "Start Next Gameweek" afterwards to open the next one.
            {incompleteMatches.length > 0 && ` ⚠ ${incompleteMatches.length} matches are still unfinished.`}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Type CONFIRM to proceed</label>
          <input
            className="form-input"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value.toUpperCase())}
            placeholder="CONFIRM"
            style={{ fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}
          />
        </div>
      </Modal>
    </AppShell>
  );
}
