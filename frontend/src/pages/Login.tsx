import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchApi } from '../api';
import { Spinner, ErrorBanner } from '../components';
import { Mic, Shield, Sparkles } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { checkAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetchApi('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      localStorage.setItem('access_token', response.access_token);
      await checkAuth();
      navigate('/');
    } catch (err: any) {
      setError(err.message === 'UNAUTHORIZED' ? 'Incorrect email or password' : (err.message || 'Connection failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── Left: Brand showcase ─────────────────────────────────────────── */}
      <div className="login-showcase">
        <div className="login-showcase-brand">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#sc-grad)" />
            <text x="50%" y="53%" textAnchor="middle" dominantBaseline="central" fill="#0a0a0a" fontWeight="700" fontSize="18" fontFamily="Inter, sans-serif">P</text>
            <defs>
              <linearGradient id="sc-grad" x1="0" y1="0" x2="40" y2="40">
                <stop offset="0%" stopColor="#c08a3e" />
                <stop offset="100%" stopColor="#e0b060" />
              </linearGradient>
            </defs>
          </svg>
          <span className="login-showcase-brand-text">Papom</span>
        </div>

        <div className="login-showcase-hero">
          <h1 className="login-showcase-headline">
            The UX research platform <span className="accent">built for teams</span> who ship.
          </h1>
          <p className="login-showcase-sub">
            Record interviews, auto-transcribe, redact PII, and surface insights — all in one workspace your whole team can use.
          </p>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon"><Mic size={18} strokeWidth={1.5} /></div>
              <div className="login-feature-text">
                <div className="login-feature-title">Automatic transcription</div>
                <div className="login-feature-desc">Speaker-aware transcripts with whisperx, ready in minutes.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon"><Shield size={18} strokeWidth={1.5} /></div>
              <div className="login-feature-text">
                <div className="login-feature-title">PII redaction built-in</div>
                <div className="login-feature-desc">Detect and redact sensitive data before it leaves the room.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon"><Sparkles size={18} strokeWidth={1.5} /></div>
              <div className="login-feature-text">
                <div className="login-feature-title">AI-assisted insights</div>
                <div className="login-feature-desc">Tag, search, and cluster themes across every recording.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="login-showcase-footer">
          <div className="login-showcase-stat">
            <div className="login-showcase-stat-num">10k+</div>
            <div className="login-showcase-stat-label">Hours transcribed</div>
          </div>
          <div className="login-showcase-stat">
            <div className="login-showcase-stat-num">99.9%</div>
            <div className="login-showcase-stat-label">Uptime SLA</div>
          </div>
          <div className="login-showcase-stat">
            <div className="login-showcase-stat-num">SOC 2</div>
            <div className="login-showcase-stat-label">Ready</div>
          </div>
        </div>
      </div>

      {/* ── Right: Form panel ───────────────────────────────────────────── */}
      <div className="login-form-panel">
        <div className="login-glow" />
        
        <div className="login-container">
          {/* Mobile logo */}
          <div className="login-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
              <text x="50%" y="53%" textAnchor="middle" dominantBaseline="central" fill="#0a0a0a" fontWeight="700" fontSize="18" fontFamily="Inter, sans-serif">P</text>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#c08a3e" />
                  <stop offset="100%" stopColor="#e0b060" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h1 className="login-title">Welcome to Papom</h1>
          <p className="login-subtitle">Sign in to your UX research workspace</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label htmlFor="email">Email Address</label>
              <input 
                id="email"
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="you@company.com"
                autoFocus
                autoComplete="email"
              />
            </div>
            
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input 
                id="password"
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <ErrorBanner message={error} />
            )}

            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : null}
              {isLoading ? 'Signing in...' : 'Continue'}
            </button>
          </form>

          <div className="login-footer">
            <span className="text-muted">Don't have an account?</span>
            <button className="ghost login-register-link">Create one</button>
          </div>
        </div>

        <p className="login-branding text-muted">
          Papom — Open-source UX Research Platform
        </p>
      </div>
    </div>
  );
}
