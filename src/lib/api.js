const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fantasy-backend-oune.onrender.com';

export async function adminFetch(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error: ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

// ── Matches ───────────────────────────────────────────────────────────────────
export const getMatches = () => adminFetch('/api/admin/matches');

export const createMatch = (body) =>
  adminFetch('/api/admin/matches', { method: 'POST', body: JSON.stringify(body) });

export const startMatch = (id) =>
  adminFetch(`/api/admin/matches/${id}/start`, { method: 'POST' });

export const completeMatch = (id) =>
  adminFetch(`/api/admin/matches/${id}/complete`, { method: 'POST' });

// Bulk alternative to giveSingleEvent — submit every player's events for the
// match in one call. Not currently wired to a page (the Matches page drives
// scoring one event at a time via giveSingleEvent + giveAppearancePoints),
// but the endpoint contract is correct if a bulk-entry UI is added later.
export const submitResult = (matchId, events) =>
  adminFetch(`/api/admin/matches/${matchId}/result`, {
    method: 'POST',
    body: JSON.stringify(events),
  });

export const giveAppearancePoints = (matchId, playerIds) =>
  adminFetch(`/api/admin/matches/${matchId}/appearance`, {
    method: 'POST',
    body: JSON.stringify(playerIds),
  });

// ── Not live on the backend yet — see PointsService proposal below ──────────
// Neither giveSinglePlayerEvent (hardcodes minutesPlayed=0) nor
// giveAppearancePoints (hardcodes cleanSheet=false) can ever award the clean
// sheet bonus. The only endpoint that honors minutesPlayed + cleanSheet is
// the bulk /result endpoint, but that one skips any player who already has an
// event for the match AND marks the match completed as a side effect — both
// wrong for a standalone "give the clean sheet bonus" action. This calls a
// new endpoint shaped exactly like giveAppearancePoints (matchId + player id
// list) so it's a small, consistent addition once wired server-side:
//
//   @PostMapping("/matches/{matchId}/clean-sheet")
//   public ResponseEntity<?> giveCleanSheetBonus(
//           @PathVariable Long matchId, @RequestBody List<Long> playerIds) {
//       pointsService.giveCleanSheetBonus(matchId, playerIds);
//       return ResponseEntity.ok(Map.of("message", "CLEAN_SHEET_BONUS_GIVEN"));
//   }
//
//   // PointsService — same shape as giveAppearancePoints, cleanSheet(true)
//   // instead of a fixed point value, and calculatePoints(event, false) so it
//   // doesn't also re-award appearance points for players who never got them.
//   @Transactional
//   public void giveCleanSheetBonus(Long matchId, List<Long> playerIds) {
//       Match match = matchRepository.findById(matchId)
//               .orElseThrow(() -> new RuntimeException("MATCH_NOT_FOUND"));
//       if (match.isCompleted()) throw new RuntimeException("MATCH_ALREADY_PROCESSED");
//       for (Long playerId : playerIds) {
//           if (playerEventRepository.existsByPlayerIdAndMatchId(playerId, matchId)) continue;
//           Player player = playerRepository.findById(playerId)
//                   .orElseThrow(() -> new RuntimeException("PLAYER_NOT_FOUND"));
//           if (!playsInMatch(player, match)) continue;
//           PlayerEvent event = PlayerEvent.builder()
//                   .player(player).match(match)
//                   .goals(0).assists(0).minutesPlayed(90)
//                   .yellowCards(0).redCards(0)
//                   .cleanSheet(true)
//                   .build();
//           int pts = calculatePoints(event, false);
//           event.setPointsEarned(pts);
//           playerEventRepository.save(event);
//           award(player, pts);
//       }
//       wsPublisher.publishPointsUpdated(matchId);
//       evictAllCaches();
//   }
//
// Until that exists server-side this call 404s — the Finalize Match modal
// catches that and still completes the match so admins aren't blocked on it.
export const giveCleanSheetBonus = (matchId, playerIds) =>
  adminFetch(`/api/admin/matches/${matchId}/clean-sheet`, {
    method: 'POST',
    body: JSON.stringify(playerIds),
  });

export const giveSingleEvent = (matchId, event) =>
  adminFetch(`/api/admin/matches/${matchId}/event`, {
    method: 'POST',
    body: JSON.stringify(event),
  });

// gameweekNumber is required server-side — omitting it used to silently target
// GW1 (the old hardcoded default). Always pass it explicitly.
export const setDeadline = (gameweekNumber, kickoffTime) =>
  adminFetch('/api/admin/set-deadline', {
    method: 'POST',
    body: JSON.stringify({ gameweekNumber: String(gameweekNumber), kickoffTime }),
  });

// ── Players ───────────────────────────────────────────────────────────────────
export const getPlayers = () => adminFetch('/api/players');

// ── Leagues ───────────────────────────────────────────────────────────────────
export const getMyLeagues = () => adminFetch('/api/leagues/my-leagues');
export const getLeagueStandings = (id) => adminFetch(`/api/leagues/${id}/standings`);
export const createLeague = (name) =>
  adminFetch('/api/leagues/create', { method: 'POST', body: JSON.stringify({ name }) });

// ── Gameweek ──────────────────────────────────────────────────────────────────
export const getCurrentGameweek = () => adminFetch('/api/gameweek/current');

// ── Tournament ────────────────────────────────────────────────────────────────
export const recalculatePoints = () =>
  adminFetch('/api/admin/recalculate', { method: 'POST' });

// Banks the CURRENT gameweek (not the whole season) — server endpoint was
// renamed from /finalize-tournament to /finalize-gameweek because it never
// finalized a tournament, just one gameweek. Keeping the old path here would
// 404 against the live backend.
export const finalizeGameweek = () =>
  adminFetch('/api/admin/finalize-gameweek', { method: 'POST' });

// Opens the next gameweek. Pairs with finalizeGameweek(): finalize banks the
// current one, this opens the next, with a window in between to verify results.
export const startGameweek = (gameweekId, deadline) =>
  adminFetch('/api/admin/start-gameweek', {
    method: 'POST',
    body: JSON.stringify({ gameweekId: String(gameweekId), deadline }),
  });

// ── Broadcast ─────────────────────────────────────────────────────────────────
export const broadcastDeadline = (body) =>
  adminFetch('/api/admin/broadcast/deadline', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const broadcastAnnouncement = (body) =>
  adminFetch('/api/admin/broadcast/announcement', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ── Users ─────────────────────────────────────────────────────────────────────
export const getTeamSquad = (teamId) => adminFetch(`/api/teams/${teamId}/squad`);
