import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { Video, Lightbulb, Search, Tags, FileText, Settings, ChevronRight, Menu, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import './ProjectLayout.css';

export default function ProjectLayout() {
  const location = useLocation();
  const { projectId } = useParams();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: 'Recordings', path: `/projects/${projectId}`, icon: Video, exact: true },
    { name: 'Insights',   path: `/projects/${projectId}/insights`, icon: Lightbulb },
    { name: 'Search',     path: `/projects/${projectId}/search`, icon: Search },
    { name: 'Tags',       path: `/projects/${projectId}/tags`, icon: Tags },
    { name: 'Audit Log',  path: `/projects/${projectId}/audit`, icon: FileText },
    { name: 'Settings',   path: `/projects/${projectId}/settings`, icon: Settings },
  ];

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll when mobile nav open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  return (
    <div className="shell">
      {/* Mobile top bar */}
      <header className="mobile-bar">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">
          <Menu size={18} />
        </button>
        <Link to="/" className="mobile-brand">
          <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#pgm)" />
            <text x="50%" y="53%" textAnchor="middle" dominantBaseline="central" fill="#0a0a0a" fontWeight="700" fontSize="18" fontFamily="Inter">P</text>
            <defs><linearGradient id="pgm" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stopColor="#c08a3e"/><stop offset="100%" stopColor="#e0b060"/></linearGradient></defs>
          </svg>
          <ChevronRight size={11} className="text-muted" />
          <span>Project</span>
        </Link>
        <div className="mobile-bar-spacer" />
      </header>

      {/* Overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu">
          <X size={16} />
        </button>
        <div className="sidebar-top">
          {/* Back to workspace */}
          <Link to="/" className="sidebar-brand">
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#pg)" />
              <text x="50%" y="53%" textAnchor="middle" dominantBaseline="central" fill="#0a0a0a" fontWeight="700" fontSize="18" fontFamily="Inter">P</text>
              <defs><linearGradient id="pg" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stopColor="#c08a3e"/><stop offset="100%" stopColor="#e0b060"/></linearGradient></defs>
            </svg>
            <ChevronRight size={11} className="text-muted" />
            <span className="sidebar-brand-text" style={{fontSize: '0.8125rem'}}>Project</span>
          </Link>

          <div className="sidebar-divider" style={{marginTop: 'var(--sp-1)'}} />

          <nav className="sidebar-nav" style={{marginTop: 'var(--sp-2)'}} aria-label="Project navigation">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = item.exact 
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="sidebar-item-icon"><Icon size={15} /></span>
                  <span className="sidebar-item-label">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.full_name?.[0]?.toUpperCase() || 'U'}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name truncate">{user?.full_name || 'User'}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content" style={{maxWidth: 'none'}}>
        <Outlet />
      </main>
    </div>
  );
}
