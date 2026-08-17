import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Save, Key, Trash2, Copy, Eye, EyeOff, Plus, Shield } from 'lucide-react';
import { fetchApi } from '../api';
import { Spinner, ErrorBanner, useToast, Modal } from '../components';
import { useAuth } from '../AuthContext';
import './SettingsPage.css';

interface PAT {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  token?: string; // only present at creation time
}

interface ProjectSettingsProps {
  projectMode?: boolean;
}

export default function SettingsPage({ projectMode = false }: ProjectSettingsProps) {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [pats, setPats] = useState<PAT[]>([]);
  const [patsLoading, setPatsLoading] = useState(true);
  const [newPATName, setNewPATName] = useState('');
  const [creatingPAT, setCreatingPAT] = useState(false);
  const [newPATModal, setNewPATModal] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<PAT | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');

  // Project settings form
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    if (!projectMode) {
      loadPATs();
    }
    if (projectMode && projectId) {
      fetchApi(`/projects/${projectId}`)
        .then((p) => {
          setProjectName(p.name || '');
          setProjectDesc(p.description || '');
        })
        .catch(() => {});
    }
  }, [projectMode, projectId]);

  const loadPATs = async () => {
    setPatsLoading(true);
    setError('');
    try {
      const data = await fetchApi('/auth/pat');
      setPats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load API tokens');
    } finally {
      setPatsLoading(false);
    }
  };

  const handleCreatePAT = async () => {
    if (!newPATName.trim()) return;
    setCreatingPAT(true);
    try {
      const data = await fetchApi('/auth/pat', {
        method: 'POST',
        body: JSON.stringify({ name: newPATName.trim() }),
      });
      setNewlyCreated(data);
      setNewPATModal(false);
      setNewPATName('');
      await loadPATs();
    } catch (err: any) {
      toast(err.message || 'Failed to create token', 'error');
    } finally {
      setCreatingPAT(false);
    }
  };

  const handleRevokePAT = async (id: string) => {
    if (!confirm('Revoke this API token? This cannot be undone.')) return;
    try {
      await fetchApi(`/auth/pat/${id}`, { method: 'DELETE' });
      toast('Token revoked', 'success');
      await loadPATs();
    } catch (err: any) {
      toast(err.message || 'Failed to revoke token', 'error');
    }
  };

  const handleSaveProject = async () => {
    if (!projectId || !projectName.trim()) return;
    setSavingProject(true);
    try {
      await fetchApi(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: projectName.trim(), description: projectDesc.trim() || null }),
      });
      toast('Project settings saved', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard', 'success'));
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="settings-page" style={{ animation: 'pageEnter var(--dur-slow) var(--ease-out) both' }}>
      <div className="settings-head">
        <Settings size={18} className="text-muted" />
        <div>
          <h1 className="page-title">{projectMode ? 'Project Settings' : 'Workspace Settings'}</h1>
          <p className="page-sub">{projectMode ? 'Manage project details' : 'Manage your account and API tokens'}</p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadPATs} />}

      {/* Project settings */}
      {projectMode && (
        <section className="settings-section">
          <h2 className="settings-section-title">Project Details</h2>
          <div className="settings-card">
            <div className="modal-form" style={{ padding: 0 }}>
              <label className="form-label">
                Project name
                <input
                  className="form-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Q3 User Research"
                />
              </label>
              <label className="form-label">
                Description (optional)
                <textarea
                  className="form-input form-textarea"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Briefly describe the goal of this project…"
                  rows={3}
                />
              </label>
              <div>
                <button
                  className="btn-primary"
                  onClick={handleSaveProject}
                  disabled={savingProject || !projectName.trim()}
                >
                  {savingProject ? <Spinner size="sm" /> : <Save size={14} />}
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Workspace: Account */}
      {!projectMode && (
        <>
          <section className="settings-section">
            <h2 className="settings-section-title">Account</h2>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-label">Name</div>
                <div className="settings-row-value">{user?.full_name || '—'}</div>
              </div>
              <div className="settings-row">
                <div className="settings-row-label">Email</div>
                <div className="settings-row-value mono text-sm">{user?.email || '—'}</div>
              </div>
              <div className="settings-row">
                <div className="settings-row-label">Role</div>
                <div className="settings-row-value">
                  <span className="settings-role-badge">admin</span>
                </div>
              </div>
            </div>
          </section>

          {/* PAT Management */}
          <section className="settings-section">
            <div className="settings-section-head">
              <div>
                <h2 className="settings-section-title">API Tokens (PAT)</h2>
                <p className="settings-section-sub">
                  Use Personal Access Tokens to authenticate the MCP server and external integrations.
                </p>
              </div>
              <button className="btn-primary" onClick={() => setNewPATModal(true)}>
                <Plus size={14} /> New token
              </button>
            </div>

            <div className="settings-card">
              {patsLoading ? (
                <div className="settings-loading">
                  <Spinner size="sm" />
                  <span className="text-muted text-sm">Loading tokens…</span>
                </div>
              ) : pats.length === 0 ? (
                <div className="settings-empty">
                  <Key size={20} className="text-muted" />
                  <p className="text-muted text-sm">No API tokens yet. Create one to use with the MCP server.</p>
                </div>
              ) : (
                <div className="pat-list">
                  {pats.map((pat) => (
                    <div key={pat.id} className="pat-row">
                      <div className="pat-info">
                        <div className="pat-name">
                          <Key size={13} className="text-muted" />
                          {pat.name}
                        </div>
                        <div className="pat-meta">
                          Created {fmtDate(pat.created_at)}
                          {pat.last_used_at && (
                            <> · Last used {fmtDate(pat.last_used_at)}</>
                          )}
                        </div>
                      </div>
                      <button
                        className="pat-revoke"
                        onClick={() => handleRevokePAT(pat.id)}
                        title="Revoke token"
                      >
                        <Trash2 size={13} /> Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* MCP info */}
          <section className="settings-section">
            <h2 className="settings-section-title">MCP Server</h2>
            <div className="settings-card settings-info-card">
              <div className="settings-info-icon">
                <Shield size={16} className="text-accent" />
              </div>
              <div>
                <p className="settings-info-title">Claude / Cursor Integration</p>
                <p className="settings-info-body text-muted text-sm">
                  BlackChid ships an MCP server at <code className="code-inline">backend/mcp_server.py</code>. Configure it in your AI client with your PAT to enable <code className="code-inline">search_insights</code>, <code className="code-inline">get_project_summary</code>, and <code className="code-inline">get_segments_by_tag</code> tools.
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* New PAT modal */}
      <Modal open={newPATModal} onClose={() => setNewPATModal(false)} title="Create API Token">
        <div className="modal-form">
          <label className="form-label">
            Token name
            <input
              className="form-input"
              value={newPATName}
              onChange={(e) => setNewPATName(e.target.value)}
              placeholder="e.g. Claude MCP, CI pipeline"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePAT(); }}
            />
          </label>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setNewPATModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreatePAT} disabled={!newPATName.trim() || creatingPAT}>
              {creatingPAT ? <Spinner size="sm" /> : 'Create token'}
            </button>
          </div>
        </div>
      </Modal>

      {/* New token reveal modal */}
      <Modal open={!!newlyCreated} onClose={() => { setNewlyCreated(null); setShowToken(false); }} title="Token created">
        <div className="modal-form">
          <div className="settings-token-alert">
            <Shield size={15} />
            Copy this token now — it will never be shown again.
          </div>
          <label className="form-label">
            Token
            <div className="settings-token-wrap">
              <input
                className="form-input mono"
                type={showToken ? 'text' : 'password'}
                value={newlyCreated?.token || ''}
                readOnly
              />
              <button className="settings-token-btn" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button className="settings-token-btn" onClick={() => copyToClipboard(newlyCreated?.token || '')}>
                <Copy size={14} />
              </button>
            </div>
          </label>
          <div className="modal-actions">
            <button className="btn-primary" onClick={() => { setNewlyCreated(null); setShowToken(false); }}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
