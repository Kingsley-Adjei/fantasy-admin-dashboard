'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import MatchCard from '../../components/matches/MatchCard';
import Modal from '../../components/ui/Modal';
import { getMatches, createMatch, startMatch, completeMatch, getPlayers, giveAppearancePoints, giveSingleEvent, giveCleanSheetBonus, getCurrentGameweek } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { useWebSocket } from '../../hooks/useWebSocket';

const TEAMS = ['CS1', 'CS2', 'CS3', 'CS4', 'IT1', 'IT2'];
const GW_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12];
const EMPTY_EVENT_FORM = { playerId: '', goals: 0, assists: 0, yellowCards: 0, redCards: 0 };

export default function MatchesPage() {
  const { addToast } = useToast();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [gwFilter, setGwFilter] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // Form state
  const [createForm, setCreateForm] = useState({
    homeTeam: '', awayTeam: '', gameweekNumber: 1, kickoffTime: ''
  });
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [appearanceIds, setAppearanceIds] = useState([]);
  const [cleanSheetIds, setCleanSheetIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mData, pData, gwData] = await Promise.all([getMatches(), getPlayers(), getCurrentGameweek().catch(() => null)]);
      setMatches(Array.isArray(mData) ? mData : []);
      setPlayers(Array.isArray(pData) ? pData : []);
      // Keep the create-match form pointed at whatever gameweek is actually
      // live server-side, instead of always defaulting to GW1.
      if (gwData?.id) {
        setCreateForm(p => (p.gameweekNumber === 1 ? { ...p, gameweekNumber: gwData.id } : p));
      }
    } catch (e) {
      addToast('Failed to load matches', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  useWebSocket({
    onMatchLive: () => load(),
    onMatchCompleted: () => load(),
    onPointsUpdated: () => load(),
  });

  const filtered = matches.filter(m => {
    if (filter === 'LIVE' && !m.live) return false;
    if (filter === 'SCHEDULED' && (m.live || m.completed)) return false;
    if (filter === 'COMPLETED' && !m.completed) return false;
    if (gwFilter && String(m.gameweekNumber) !== String(gwFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.homeTeam?.toLowerCase().includes(q) || m.awayTeam?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreateMatch = async () => {
    if (!createForm.homeTeam || !createForm.awayTeam) {
      addToast('Select both teams', 'error'); return;
    }
    if (createForm.homeTeam === createForm.awayTeam) {
      addToast('Teams must be different', 'error'); return;
    }
    setSaving(true);
    try {
      await createMatch({
        ...createForm,
        kickoffTime: createForm.kickoffTime || new Date().toISOString().slice(0,16),
      });
      addToast('Match created', 'success');
      setShowCreate(false);
      setCreateForm({ homeTeam: '', awayTeam: '', gameweekNumber: 1, kickoffTime: '' });
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (match) => {
    setSaving(true);
    try {
      await startMatch(match.id);
      addToast(`${match.homeTeam} vs ${match.awayTeam} is now LIVE`, 'success');
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openFinalize = (match) => {
    setSelectedMatch(match);
    setCleanSheetIds([]);
    setShowFinalize(true);
  };

  const toggleCleanSheet = (id) => {
    setCleanSheetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFinalizeMatch = async () => {
    setFinalizing(true);
    try {
      if (cleanSheetIds.length > 0) {
        try {
          await giveCleanSheetBonus(selectedMatch.id, cleanSheetIds.map(Number));
          addToast(`Clean sheet bonus given to ${cleanSheetIds.length} player${cleanSheetIds.length === 1 ? '' : 's'}`, 'success');
        } catch (e) {
          // /clean-sheet doesn't exist on the backend yet (see api.js) — don't
          // let a missing endpoint block ending the match.
          addToast(`Clean sheet bonus not applied: ${e.message}`, 'error');
        }
      }
      await completeMatch(selectedMatch.id);
      addToast('Match completed', 'success');
      setShowFinalize(false);
      setCleanSheetIds([]);
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setFinalizing(false);
    }
  };

  const handleSubmitEvent = async () => {
    if (!eventForm.playerId) {
      addToast('Select a player', 'error'); return;
    }
    const { goals, assists, yellowCards, redCards } = eventForm;
    if (!goals && !assists && !yellowCards && !redCards) {
      addToast('Enter at least one stat (goal, assist, or card)', 'error'); return;
    }
    setSaving(true);
    try {
      // Shape must match PlayerEventDTO exactly — the backend has no
      // "eventType" field, it reads goals/assists/yellowCards/redCards
      // directly. cleanSheet is deliberately omitted: giveSinglePlayerEvent
      // always scores with minutesPlayed=0, so a clean-sheet bonus (which
      // requires >=60 minutes) can never actually apply through this endpoint.
      await giveSingleEvent(selectedMatch.id, {
        playerId: Number(eventForm.playerId),
        goals: Number(goals) || 0,
        assists: Number(assists) || 0,
        yellowCards: Number(yellowCards) || 0,
        redCards: Number(redCards) || 0,
      });
      addToast('Event submitted', 'success');
      setShowEvent(false);
      setEventForm(EMPTY_EVENT_FORM);
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAppearance = async () => {
    if (appearanceIds.length === 0) {
      addToast('Select at least one player', 'error'); return;
    }
    setSaving(true);
    try {
      await giveAppearancePoints(selectedMatch.id, appearanceIds.map(Number));
      addToast(`Appearance points given to ${appearanceIds.length} players`, 'success');
      setShowAppearance(false);
      setAppearanceIds([]);
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAppearance = (id) => {
    setAppearanceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Mirrors PointsService.playsInMatch (case-insensitive, trimmed club vs.
  // team-code match) so the picker can't offer a player the backend will
  // reject with PLAYER_NOT_IN_THIS_MATCH — or, for appearance points, one it
  // silently skips with no error at all.
  const eligiblePlayers = (match) => {
    if (!match) return [];
    const home = match.homeTeam?.trim().toLowerCase();
    const away = match.awayTeam?.trim().toLowerCase();
    return players.filter(p => {
      const club = p.realClub?.trim().toLowerCase();
      return club && (club === home || club === away);
    });
  };
  const matchPlayers = eligiblePlayers(selectedMatch);

  // Clean sheet bonus only applies to goalkeepers and defenders — see
  // PointsService.calculatePoints (midfielders get a smaller bonus that
  // isn't reachable through any wired endpoint yet; forwards get none).
  const cleanSheetEligible = (team) =>
    matchPlayers.filter(p =>
      (p.position === 'GK' || p.position === 'DEF') &&
      p.realClub?.trim().toLowerCase() === team?.trim().toLowerCase()
    );

  const liveMatch = matches.find(m => m.live);
  const liveLabel = liveMatch ? `${liveMatch.homeTeam} ${liveMatch.homeScore ?? 0} - ${liveMatch.awayScore ?? 0} ${liveMatch.awayTeam}` : null;

  return (
    <AppShell title="Matches" liveMatch={liveLabel}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title font-syne">Match Control</h1>
            <p className="page-subtitle">Schedule, manage, and officiate live fantasy matches.</p>
          </div>
          <button className="btn btn-brand" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Match
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div style={{ padding: '14px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: '1 1 200px', minWidth: 180 }}>
            <Search size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search teams or GW..."
            />
          </div>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 120 }}
            value={gwFilter}
            onChange={e => setGwFilter(e.target.value)}
          >
            <option value="">All GW</option>
            {GW_OPTIONS.map(g => <option key={g} value={g}>GW {g}</option>)}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 130 }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="LIVE">Live</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Match list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-2)' }}>
          <p>No matches found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(m => (
            <MatchCard
              key={m.id}
              match={m}
              onStart={handleStart}
              onComplete={openFinalize}
              onEvent={(match) => { setSelectedMatch(match); setShowEvent(true); }}
              onAppearance={(match) => { setSelectedMatch(match); setShowAppearance(true); }}
            />
          ))}
        </div>
      )}

      {/* Create match modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Match"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className={`btn btn-brand ${saving ? 'btn-loading' : ''}`} onClick={handleCreateMatch} disabled={saving}>
              {!saving && 'Create Match'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Home Team</label>
          <select className="form-select" value={createForm.homeTeam} onChange={e => setCreateForm(p => ({ ...p, homeTeam: e.target.value }))}>
            <option value="">Select team</option>
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Away Team</label>
          <select className="form-select" value={createForm.awayTeam} onChange={e => setCreateForm(p => ({ ...p, awayTeam: e.target.value }))}>
            <option value="">Select team</option>
            {TEAMS.filter(t => t !== createForm.homeTeam).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Gameweek</label>
            <select className="form-select" value={createForm.gameweekNumber} onChange={e => setCreateForm(p => ({ ...p, gameweekNumber: Number(e.target.value) }))}>
              {GW_OPTIONS.map(g => <option key={g} value={g}>GW {g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kickoff Time</label>
            <input
              type="datetime-local"
              className="form-input"
              value={createForm.kickoffTime}
              onChange={e => setCreateForm(p => ({ ...p, kickoffTime: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* Event modal */}
      <Modal
        open={showEvent}
        onClose={() => { setShowEvent(false); setEventForm(EMPTY_EVENT_FORM); }}
        title={`Submit Event — ${selectedMatch?.homeTeam} vs ${selectedMatch?.awayTeam}`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowEvent(false)}>Cancel</button>
            <button className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} onClick={handleSubmitEvent} disabled={saving}>
              {!saving && 'Submit'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Player</label>
          <select className="form-select" value={eventForm.playerId} onChange={e => setEventForm(p => ({ ...p, playerId: e.target.value }))}>
            <option value="">Select player</option>
            {matchPlayers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.realClub} · {p.position})</option>)}
          </select>
          {selectedMatch && matchPlayers.length === 0 && (
            <p className="text-muted text-xs" style={{ marginTop: 6 }}>
              No players found with realClub matching {selectedMatch.homeTeam} or {selectedMatch.awayTeam}.
            </p>
          )}
        </div>
        <p className="text-muted text-xs" style={{ marginBottom: 4 }}>Enter counts for whatever happened on this touch — you can submit goals, assists, and a card together in one event.</p>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Goals</label>
            <input type="number" className="form-input" min={0} value={eventForm.goals} onChange={e => setEventForm(p => ({ ...p, goals: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Assists</label>
            <input type="number" className="form-input" min={0} value={eventForm.assists} onChange={e => setEventForm(p => ({ ...p, assists: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Yellow Cards</label>
            <input type="number" className="form-input" min={0} max={2} value={eventForm.yellowCards} onChange={e => setEventForm(p => ({ ...p, yellowCards: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Red Cards</label>
            <input type="number" className="form-input" min={0} max={1} value={eventForm.redCards} onChange={e => setEventForm(p => ({ ...p, redCards: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Appearance modal */}
      <Modal
        open={showAppearance}
        onClose={() => { setShowAppearance(false); setAppearanceIds([]); }}
        title={`Appearance Points — ${selectedMatch?.homeTeam} vs ${selectedMatch?.awayTeam}`}
        size="xl"
        footer={
          <>
            <span className="text-muted text-sm">{appearanceIds.length} selected</span>
            <button className="btn btn-ghost" onClick={() => setShowAppearance(false)}>Cancel</button>
            <button className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} onClick={handleSubmitAppearance} disabled={saving}>
              {!saving && 'Give Points'}
            </button>
          </>
        }
      >
        <p className="text-muted text-sm" style={{ marginBottom: 8 }}>Select all players who appeared in this match to award appearance points.</p>
        <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {players.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading players...</p>
          ) : matchPlayers.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
              No players found with realClub matching {selectedMatch?.homeTeam} or {selectedMatch?.awayTeam}.
            </p>
          ) : (
            matchPlayers.map(p => (
              <label key={p.id} className="checkbox-item" style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 10px', background: appearanceIds.includes(String(p.id)) ? 'var(--accent-dim)' : 'transparent', transition: 'background 0.15s' }}>
                <input
                  type="checkbox"
                  checked={appearanceIds.includes(String(p.id))}
                  onChange={() => toggleAppearance(String(p.id))}
                />
                <div>
                  <div className="checkbox-label">{p.name}</div>
                  <div className="checkbox-sub">{p.realClub} · {p.position} · ₵{p.price}m</div>
                </div>
              </label>
            ))
          )}
        </div>
      </Modal>

      {/* Finalize match modal — optional clean sheet bonus, then complete */}
      <Modal
        open={showFinalize}
        onClose={() => { setShowFinalize(false); setCleanSheetIds([]); }}
        title={`Finalize Match — ${selectedMatch?.homeTeam} vs ${selectedMatch?.awayTeam}`}
        size="xl"
        footer={
          <>
            <span className="text-muted text-sm">{cleanSheetIds.length} clean sheet{cleanSheetIds.length === 1 ? '' : 's'} selected</span>
            <button className="btn btn-ghost" onClick={() => setShowFinalize(false)}>Cancel</button>
            <button className={`btn btn-primary ${finalizing ? 'btn-loading' : ''}`} onClick={handleFinalizeMatch} disabled={finalizing}>
              {!finalizing && 'Complete Match'}
            </button>
          </>
        }
      >
        <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
          Tick any goalkeepers or defenders who kept a clean sheet — they get the bonus before the match is marked complete. Leave everything unticked to just end the match.
        </p>
        {[selectedMatch?.homeTeam, selectedMatch?.awayTeam].map((team, i) => {
          const eligible = cleanSheetEligible(team);
          return (
            <div key={i} style={{ marginBottom: 14 }}>
              <div className="section-title" style={{ marginBottom: 6 }}>{team || (i === 0 ? 'Home' : 'Away')}</div>
              {eligible.length === 0 ? (
                <p className="text-muted text-xs">No goalkeepers or defenders found for this team.</p>
              ) : (
                eligible.map(p => (
                  <label key={p.id} className="checkbox-item" style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 10px', background: cleanSheetIds.includes(String(p.id)) ? 'var(--accent-dim)' : 'transparent', transition: 'background 0.15s' }}>
                    <input
                      type="checkbox"
                      checked={cleanSheetIds.includes(String(p.id))}
                      onChange={() => toggleCleanSheet(String(p.id))}
                    />
                    <div>
                      <div className="checkbox-label">{p.name}</div>
                      <div className="checkbox-sub">{p.position}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          );
        })}
      </Modal>
    </AppShell>
  );
}
