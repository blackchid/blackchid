import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder, BarChart3, Zap, FileText, Clock, ArrowUpRight, Mic, TrendingUp, Users, Activity } from 'lucide-react';
import { fetchApi } from '../api';
import { Modal, Skeleton, Spinner, ErrorBanner, useToast } from '../components';
import './Home.css';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

const THEMES = [
  { gradient: 'linear-gradient(135deg, #1e1b4b 0%, #0f0b2e 100%)', accent: '#818cf8' },
  { gradient: 'linear-gradient(135deg, #052e16 0%, #031a0d 100%)', accent: '#4ade80' },
  { gradient: 'linear-gradient(135deg, #2a1709 0%, #1a0e04 100%)', accent: '#fb923c' },
  { gradient: 'linear-gradient(135deg, #042f2e 0%, #021a19 100%)', accent: '#2dd4bf' },
  { gradient: 'linear-gradient(135deg, #2e0a24 0%, #1a0616 100%)', accent: '#e879f9' },
  { gradient: 'linear-gradient(135deg, #1e1a00 0%, #0f0d00 100%)', accent: '#fbbf24' },
];

const ICONS = [Zap, BarChart3, FileText, Folder, Zap, BarChart3];

export default function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    fetchApi('/projects')
      .then(data => setProjects(data))
      .catch(err => { setFetchError(err.message || 'Failed to load projects'); })
      .finally(() => setIsLoading(false));
  }, []);

  const timeAgo = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';

  return (
    <div className="home">
      {/* Hero section */}
      <div className="home-hero">
        <div className="home-hero-text">
          <h1>Good {greeting}</h1>
          <p className="home-hero-sub">Here's what's happening in your workspace.</p>
        </div>
        <div className="home-hero-actions">
          <button className="secondary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> New project
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="home-stats stagger">
        <StatCard icon={<Folder size={16} />} label="Projects" value={isLoading ? '—' : String(projects.length)} accent="#818cf8" />
        <StatCard icon={<Mic size={16} />} label="Recordings" value="0" accent="#4ade80" />
        <StatCard icon={<Clock size={16} />} label="Hours analyzed" value="0" accent="#fb923c" />
        <StatCard icon={<TrendingUp size={16} />} label="Insights" value="0" accent="#2dd4bf" />
      </div>

      {/* Projects section */}
      <div className="home-section">
        <div className="home-section-head">
          <h2>Projects</h2>
          <button className="ghost text-sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> New
          </button>
        </div>

        {fetchError && (
          <ErrorBanner
            message={fetchError}
            onRetry={() => { setFetchError(''); setIsLoading(true); fetchApi('/projects').then(data => setProjects(data)).catch(err => setFetchError(err.message)).finally(() => setIsLoading(false)); }}
          />
        )}

        {isLoading ? (
          <div className="home-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="pcard pcard-skeleton">
                <Skeleton height={120} radius="0" />
                <div className="pcard-body">
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="40%" height={11} className="mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="home-grid stagger">
            {projects.map((p, i) => {
              const theme = THEMES[i % THEMES.length];
              const Icon = ICONS[i % ICONS.length];
              return (
                <div key={p.id} className="pcard lift shimmer-hover" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="pcard-visual" style={{ background: theme.gradient }}>
                    <div className="pcard-icon-wrap">
                      <Icon size={22} color={theme.accent} strokeWidth={1.5} />
                    </div>
                    <div className="pcard-arrow">
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                  <div className="pcard-body">
                    <div className="pcard-name">{p.name}</div>
                    <div className="pcard-meta">
                      <Clock size={10} />
                      {timeAgo(p.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pcard pcard-new" onClick={() => setModalOpen(true)}>
              <div className="pcard-new-inner">
                <Plus size={20} strokeWidth={1.5} />
                <span>New project</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity section */}
      <div className="home-section mt-12">
        <div className="home-section-head">
          <h2>Recent Activity</h2>
        </div>
        <div className="home-activity-empty">
          <div className="home-activity-icon">
            <Activity size={24} strokeWidth={1.2} />
          </div>
          <p className="home-activity-title">No recent activity</p>
          <p className="home-activity-desc">Create a project and upload recordings to get started.</p>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <CreateProjectModal 
          onClose={() => setModalOpen(false)} 
          onComplete={(p) => { setModalOpen(false); toast('Project created', 'success'); navigate(`/projects/${p.id}`); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="stat-card lift">
      <div className="stat-card-icon" style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}33` }}>
        {icon}
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}

function CreateProjectModal({ onClose, onComplete }: { onClose: () => void; onComplete: (p: Project) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await fetchApi('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: desc }),
      });
      onComplete(data);
    } catch (err: any) {
      const msg = err.message || 'Failed to create project';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Create project"
      footer={
        <>
          <button className="ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="primary" onClick={() => submit()} disabled={submitting || !name.trim()}>
            {submitting ? <Spinner size="sm" /> : null}
            {submitting ? 'Creating...' : 'Create project'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="modal-body">
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q4 User Research" disabled={submitting} />
        </div>
        <div className="field">
          <label>Description <span className="text-muted">(optional)</span></label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description" disabled={submitting} />
        </div>
      </form>
    </Modal>
  );
}
