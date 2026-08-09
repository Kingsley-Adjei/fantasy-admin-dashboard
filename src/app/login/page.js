'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hexagon, AtSign, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { login } from '../../lib/api';
import { useToast } from '../../hooks/useToast';

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data?.token) {
        localStorage.setItem('adminToken', data.token);
        addToast('Access granted. Welcome back.', 'success');
        router.push('/dashboard');
      } else if (data?.message === 'NEW_USER_OTP_SENT') {
        addToast('OTP sent — admin accounts should not require OTP', 'error');
      } else {
        addToast('Invalid credentials', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Hexagon size={28} strokeWidth={1.5} />
          </div>
          <div>
            <div className="login-brand font-syne">FANTASY KNUST</div>
            <div className="login-subtitle">ADMIN CONSOLE ACCESS</div>
          </div>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              System Entry
            </div>
            <div style={{ width: 40, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
          </div>

          <div className="form-group">
            <label className="form-label">Identifier (Email)</label>
            <div className="search-bar">
              <AtSign size={15} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fantasyknust.edu"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Access Code</label>
            <div className="search-bar">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                autoComplete="current-password"
                style={{ letterSpacing: showPass ? 'normal' : '0.2em' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-brand btn-lg w-full ${loading ? 'btn-loading' : ''}`}
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {!loading && (
              <>
                <span>SIGN IN</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <span className="status-live-dot" />
          DATABASE LIVE &nbsp;·&nbsp; KNUST CORE SERVERS
          <span className="status-live-dot" style={{ marginLeft: 8 }} />
        </div>

        <div className="login-status-bar">
          <span>
            <span className="status-live-dot" />
            DATABASE LIVE
          </span>
          <span>
            KNUST CORE SERVERS
            <span className="status-live-dot" style={{ marginLeft: 6 }} />
          </span>
        </div>
      </div>
    </div>
  );
}
