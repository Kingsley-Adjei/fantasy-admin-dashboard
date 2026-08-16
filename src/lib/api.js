const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fantasy-backend-oune.onrender.com';

/**
 * Set once we've bounced the user to /login, so a page that fires several
 * requests in parallel doesn't stack up redirects (and so an endpoint that
 * legitimately 403s can't put us in a login loop).
 */
let redirectingToLogin = false;

function sessionExpired() {
  if (typeof window === 'undefined' || redirectingToLogin) return;
  redirectingToLogin = true;
  localStorage.removeItem('adminToken');
  window.location.href = '/login';
}

export async function adminFetch(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (networkError) {
    // Render free tier cold-starts can take ~30s and the fetch simply fails.
    // Surface that as itself rather than as a mystery "Server error".
    const err = new Error('Cannot reach the server. It may still be waking up.');
    err.status = 0;
    throw err;
  }

  // Spring Security has no authentication entry point configured, so an
  // anonymous request is rejected by Http403ForbiddenEntryPoint with 403 —
  // NOT 401. Both therefore have to mean "sign in again" here.
  if (res.status === 401 || res.status === 403) {
    sessionExpired();
    const err = new Error('Your admin session has expired. Please sign in again.');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Callers branch on `status` — notably to tell "this backend build predates
    // the endpoint" (404) apart from a genuine failure.
    const err = new Error(body.error || `Server error: ${res.status}`);
    err.status = res.status;
    err.code = body.code;
    throw err;
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

// Now live on the backend (AdminController + PointsService.giveCleanSheetBonus).
//
// This used to 404: neither giveSinglePlayerEvent (hardcodes minutesPlayed=0,
// and calculatePoints only pays a clean sheet at 60+ minutes) nor
// giveAppearancePoints (hardcodes cleanSheet=false) could award the bonus, and
// the only path that honoured both — the bulk /result endpoint — also marks the
// match completed as a side effect, which is wrong for a standalone action.
//
// The Finalize Match modal still tolerates a failure here and completes the
// match regardless, so an older backend deployment degrades rather than blocks.
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

// ── Leagues & teams ───────────────────────────────────────────────────────────
//
// THIS IS THE BUG THAT BLANKED THE CONSOLE.
//
// Every page here used to call GET /api/leagues/my-leagues. That endpoint is
// player-scoped: LeagueService.getMyLeagues() opens with
//
//     teamRepository.findByUserId(user.getId())
//         .orElseThrow(() -> new RuntimeException("TEAM_NOT_FOUND"));
//
// and ApiErrors maps TEAM_NOT_FOUND to HTTP 404. The admin account does not
// play the game, so it has no Team row and that call returned 404 on every
// load — it could never have succeeded. Because three pages awaited it inside
// Promise.all, the rejection also threw away the matches, gameweek and player
// results fetched alongside it, which is why entire pages rendered empty
// rather than just the league panel.
//
// The console now uses the platform-scoped endpoints added to AdminController.
// They require the matching backend build — these paths do not exist on an
// older deployment, so deploy the backend alongside this frontend.
//
// No compatibility fallback is attempted on purpose. Detecting "this route
// isn't deployed yet" is not reliable here: under Spring Boot 4 an unmatched
// path raises NoResourceFoundException, which GlobalExceptionHandler's
// @ExceptionHandler(Exception.class) turns into a 500, not a 404. A shim
// keying off the status code would therefore mistake genuine server errors for
// a missing endpoint and quietly serve stale data instead of reporting the
// fault. One contract, honestly enforced, beats a guess.

/** Every league on the platform, with member counts. */
export const getLeagues = () => adminFetch('/api/admin/leagues');

/** Standings for any league, whether or not the caller is a member. */
export const getLeagueStandings = (id) =>
  adminFetch(`/api/admin/leagues/${id}/standings`);

/**
 * Every registered team, ranked by season total.
 *
 * Previously derived from the global league's standings, which under-reports:
 * a team only appears there once autoJoinGlobalLeague has run for it.
 */
export const getTeams = () => adminFetch('/api/admin/teams');

/**
 * POST /api/leagues/create enrols the caller's own team as the league's first
 * member, so it requires one and always returned 400 CREATE_TEAM_FIRST for an
 * admin — the console's Create League button could never succeed. The admin
 * endpoint creates the league empty; managers then join with the code.
 */
export const createLeague = (name) =>
  adminFetch('/api/admin/leagues', { method: 'POST', body: JSON.stringify({ name }) });

// ── Gameweek ──────────────────────────────────────────────────────────────────
//
// GameweekController answers with { number, deadline } — it maps gw.getId()
// onto the key "number" and there is no `id` in the payload at all. Every page
// here read `gameweek.id`, which is therefore always undefined:
//
//   · Dashboard   — the Gameweek stat card rendered a permanent "GW —".
//   · Tournament  — `if (gwData?.id)` never fired, so the set-deadline and
//                   start-gameweek forms silently stayed on GW 1 no matter
//                   which gameweek was actually live. Submitting them would
//                   have retimed the wrong gameweek's fixtures.
//   · Matches     — new matches defaulted to gameweek 1.
//
// Normalising once here keeps a single place aware of the wire format. `id` is
// carried as an alias so the existing components keep working unchanged.
export const getCurrentGameweek = async () => {
  const gw = await adminFetch('/api/gameweek/current');
  if (!gw) return null;
  const number = gw.number ?? gw.id ?? null;
  // `active` is the truth about whether a gameweek row is actually running.
  // Older backends omitted it AND silently defaulted number to 1 when nothing
  // was active — which is how the console showed "GW 1 ACTIVE" while
  // finalize-gameweek simultaneously (and correctly) failed with "there's no
  // gameweek running right now". Treat a missing flag as active for backward
  // compatibility, but the current backend always sends it.
  const active = gw.active ?? (number != null);
  return { ...gw, number, id: number, active };
};

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
