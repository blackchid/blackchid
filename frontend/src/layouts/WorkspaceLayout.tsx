import { useState, useEffect, type ReactNode } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Folder, Settings, Menu, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../AuthContext';
import './WorkspaceLayout.css';

export default function WorkspaceLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [path]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close mobile sidebar on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      {/* Mobile top bar */}
      <header className="mobile-bar">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={18} />
        </button>
        <Link to="/" className="mobile-brand">
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#mg)" />
            <text x="50%" y="53%" textAnchor="middle" dominantBaseline="central" fill="#0a0a0a" fontWeight="700" fontSize="18" fontFamily="Inter">B</text>
            <defs><linearGradient id="mg" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stopColor="#c08a3e"/><stop offset="100%" stopColor="#e0b060"/></linearGradient></defs>
          </svg>
          <span>BlackChid</span>
        </Link>
        <div className="mobile-bar-spacer" />
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <Link to="/" className="sidebar-brand" aria-label="BlackChid home">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#sg)" />
              <text x="50%" y="53%" textAnchor="middle" dominantBaseline="central" fill="#0a0a0a" fontWeight="700" fontSize="18" fontFamily="Inter">B</text>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stopColor="#c08a3e"/><stop offset="100%" stopColor="#e0b060"/></linearGradient></defs>
            </svg>
            <span className="sidebar-brand-text">BlackChid</span>
          </Link>

          {/* Mobile close button */}
          <button
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <SidebarLink to="/" icon={<Home size={15}/>} label="Home" active={path === '/'} />
          </nav>

          <div className="sidebar-divider" />

          <div className="sidebar-section-label">Workspace</div>
          <nav className="sidebar-nav" aria-label="Workspace navigation">
            <SidebarLink to="/" icon={<Folder size={15}/>} label="Projects" active={path.startsWith('/projects')} />
          </nav>
        </div>

        <div className="sidebar-bottom">
          <SidebarLink to="/settings" icon={<Settings size={15}/>} label="Settings" active={path === '/settings'} />
          <div className="sidebar-user">
            <div className="sidebar-avatar-wrap">
              <div className="sidebar-avatar">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="sidebar-status-dot" />
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name truncate">{user?.full_name || 'User'}</div>
              <div className="sidebar-user-email truncate">{user?.email || ''}</div>
            </div>
            <ChevronRight size={14} className="sidebar-user-chevron" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarLink({ to, icon, label, active, tag }: { 
  to: string; icon: ReactNode; label: string; active?: boolean; tag?: string;
}) {
  return (
    <Link 
      to={to} 
      className={`sidebar-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sidebar-item-icon">{icon}</span>
      <span className="sidebar-item-label">{label}</span>
      {tag && <span className="sidebar-tag">{tag}</span>}
    </Link>
  );
}
