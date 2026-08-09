'use client';
import { Shield, Play, CheckCircle, MoreVertical, Clock } from 'lucide-react';
import { format } from '../ui/dateUtils';

function MatchTeamIcon() {
  return (
    <div className="match-team-icon">
      <Shield size={20} strokeWidth={1.5} />
    </div>
  );
}

export default function MatchCard({ match, onStart, onComplete, onAppearance, onEvent }) {
  const isLive = match.live;
  const isCompleted = match.completed;
  const isScheduled = !isLive && !isCompleted;

  const statusLabel = isLive ? 'LIVE' : isCompleted ? 'COMPLETED' : 'SCHEDULED';
  const statusClass = isLive ? 'status-live' : isCompleted ? 'status-completed' : 'status-scheduled';

  const kickoff = match.kickoffTime
    ? new Date(match.kickoffTime).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className={`match-card ${isLive ? 'live' : ''} animate-in`}>
      <div className={`match-card-header ${isLive ? 'live-header' : ''}`}>
        {isLive && <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 1.4s ease infinite', flexShrink: 0 }} />}
        <span>GW {match.gameweekNumber || '—'}</span>
        <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
        {isLive && <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>
          {match.homeScore} : {match.awayScore}
        </span>}
      </div>

      <div className="match-score-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MatchTeamIcon />
          <div>
            <div className="match-team-name font-syne">{match.homeTeam}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          {isLive || isCompleted ? (
            <div className="match-score font-syne">
              {match.homeScore ?? 0} <span style={{ color: 'var(--text-3)', fontSize: 20 }}>:</span> {match.awayScore ?? 0}
            </div>
          ) : (
            <div className="match-score-vs">VS</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="match-team-name font-syne">{match.awayTeam}</div>
          </div>
          <MatchTeamIcon />
        </div>
      </div>

      <div className="match-card-footer">
        <div className="match-meta">
          <Clock size={12} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} />
          {kickoff}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isScheduled && (
            <button className="btn btn-brand btn-sm" onClick={() => onStart?.(match)}>
              <Play size={13} />
              Start
            </button>
          )}
          {isLive && (
            <>
              <button className="btn btn-outline-accent btn-sm" onClick={() => onEvent?.(match)}>
                Submit Event
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onAppearance?.(match)}>
                Appearance Points
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onComplete?.(match)}>
                Finalize
              </button>
            </>
          )}
          {isCompleted && (
            <button className="btn btn-ghost btn-sm" style={{ opacity: 0.5, cursor: 'default' }}>
              <CheckCircle size={13} />
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
