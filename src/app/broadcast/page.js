'use client';
import { useState } from 'react';
import { Radio, Clock, Megaphone, Send, Hexagon } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { broadcastDeadline, broadcastAnnouncement } from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const BADGE_OPTS = ['DEADLINE', 'LIVE UPDATE', 'ANNOUNCEMENT', 'NEWS', 'URGENT'];

export default function BroadcastPage() {
  const { addToast } = useToast();

  const [deadlineForm, setDeadlineForm] = useState({ timeLeft: '60', message: '' });
  const [announcementForm, setAnnouncementForm] = useState({ subject: '', message: '', badgeText: 'ANNOUNCEMENT' });
  const [saving, setSaving] = useState(null);
  const [history, setHistory] = useState([]);

  const handleDeadline = async () => {
    if (!deadlineForm.message.trim()) { addToast('Enter a message', 'error'); return; }
    setSaving('deadline');
    try {
      await broadcastDeadline({
        timeLeft: `${deadlineForm.timeLeft} Minutes Remaining`,
        message: deadlineForm.message,
      });
      addToast('Deadline alert sent to all users', 'success');
      setHistory(prev => [{
        type: 'DEADLINE',
        headline: `GW Deadline in ${deadlineForm.timeLeft}m`,
        body: deadlineForm.message,
        time: new Date(),
      }, ...prev.slice(0, 9)]);
      setDeadlineForm({ timeLeft: '60', message: '' });
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleAnnouncement = async () => {
    if (!announcementForm.subject.trim() || !announcementForm.message.trim()) {
      addToast('Fill in subject and message', 'error'); return;
    }
    setSaving('announcement');
    try {
      await broadcastAnnouncement({
        subject: announcementForm.subject,
        message: announcementForm.message,
        badgeText: announcementForm.badgeText,
      });
      addToast('Announcement sent', 'success');
      setHistory(prev => [{
        type: 'ANNOUNCE',
        headline: announcementForm.subject,
        body: announcementForm.message,
        time: new Date(),
      }, ...prev.slice(0, 9)]);
      setAnnouncementForm({ subject: '', message: '', badgeText: 'ANNOUNCEMENT' });
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppShell title="Broadcast">
      <div className="page-header">
        <h1 className="page-title font-syne">Broadcast</h1>
        <p className="page-subtitle">Send alerts and announcements to all app users in real time.</p>
      </div>

      <div className="grid-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Deadline Alert */}
          <div className="card animate-in">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={18} style={{ color: 'var(--warning)' }} strokeWidth={1.8} />
                <span className="card-title" style={{ color: 'var(--warning)' }}>Deadline Alert</span>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Time Remaining (mins)</label>
                <input
                  className="form-input"
                  type="number"
                  value={deadlineForm.timeLeft}
                  onChange={e => setDeadlineForm(p => ({ ...p, timeLeft: e.target.value }))}
                  min={1}
                  max={240}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Broadcast Message</label>
                <textarea
                  className="form-textarea"
                  value={deadlineForm.message}
                  onChange={e => setDeadlineForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Finalize your squads before the lockout begins..."
                  style={{ minHeight: 80 }}
                />
              </div>
              <button
                className={`btn btn-brand ${saving === 'deadline' ? 'btn-loading' : ''}`}
                onClick={handleDeadline}
                disabled={!!saving}
              >
                {saving !== 'deadline' && <><Send size={15} /> Push Alert</>}
              </button>
            </div>
          </div>

          {/* Announcement */}
          <div className="card animate-in" style={{ animationDelay: '80ms' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Megaphone size={18} style={{ color: 'var(--accent)' }} strokeWidth={1.8} />
                <span className="card-title">General Announcement</span>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Badge Label (Live, Update, News)</label>
                <select
                  className="form-select"
                  value={announcementForm.badgeText}
                  onChange={e => setAnnouncementForm(p => ({ ...p, badgeText: e.target.value }))}
                >
                  {BADGE_OPTS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Headline</label>
                <input
                  className="form-input"
                  value={announcementForm.subject}
                  onChange={e => setAnnouncementForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="New Transfers Available"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Detail Content</label>
                <textarea
                  className="form-textarea"
                  value={announcementForm.message}
                  onChange={e => setAnnouncementForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Check out the new players added to the database for the mid-season window..."
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className={`btn btn-primary flex-1 ${saving === 'announcement' ? 'btn-loading' : ''}`}
                  onClick={handleAnnouncement}
                  disabled={!!saving}
                >
                  {saving !== 'announcement' && <><Send size={15} /> Publish Now</>}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setAnnouncementForm({ subject: '', message: '', badgeText: 'ANNOUNCEMENT' })}
                  disabled={!!saving}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right col — preview + history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Live preview */}
          <div className="card animate-in" style={{ animationDelay: '40ms' }}>
            <div className="card-header">
              <span className="card-title">Live App Preview</span>
            </div>
            <div style={{ padding: 20 }}>
              <div className="preview-phone">
                <div className="preview-status-bar">09:41</div>
                <div className="preview-notification">
                  <div className="preview-app-icon">
                    <Hexagon size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        background: 'var(--accent-dim)',
                        color: 'var(--accent)',
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'DM Mono, monospace',
                      }}>
                        {announcementForm.badgeText || 'ANNOUNCEMENT'}
                      </span>
                    </div>
                    <div className="preview-title">
                      {announcementForm.subject || 'Notification headline'}
                    </div>
                    <div className="preview-body">
                      {announcementForm.message || 'Message body will appear here...'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="card animate-in" style={{ animationDelay: '120ms' }}>
            <div className="card-header">
              <span className="card-title">Broadcast History</span>
            </div>
            <div>
              {history.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                  No broadcasts sent yet
                </div>
              ) : (
                history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: 'DM Mono, monospace',
                      background: h.type === 'DEADLINE' ? 'var(--warning-dim)' : 'var(--accent-dim)',
                      color: h.type === 'DEADLINE' ? 'var(--warning)' : 'var(--accent)',
                      alignSelf: 'flex-start',
                      whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}>{h.type}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.headline}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.body}</div>
                    </div>
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
