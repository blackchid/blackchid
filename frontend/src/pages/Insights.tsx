import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Lightbulb, Trash2, ChevronRight, FileText, Quote } from 'lucide-react';
import { fetchApi } from '../api';
import { Badge, Spinner, EmptyState, ErrorBanner, Modal, useToast } from '../components';
import './Insights.css';

interface Evidence {
  id: string;
  insight_id: string;
  segment_id: string | null;
  clip_id: string | null;
  note: string | null;
  created_at: string;
  segment?: {
    id: string;
    recording_id: string;
    start_time: number;
    end_time: number;
    speaker_label: string | null;
    text: string;
  } | null;
}

interface Insight {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  evidence: Evidence[];
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const fmtDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function Insights() {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selected, setSelected] = useState<Insight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchApi(`/projects/${projectId}/insights`);
      setInsights(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id: string) => {
    try {
      const detail = await fetchApi(`/insights/${id}`);
      setSelected(detail);
    } catch (err: any) {
      toast(err.message || 'Failed to load insight', 'error');
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await fetchApi(`/projects/${projectId}/insights`, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || null }),
      });
      toast('Insight created', 'success');
      setModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      await load();
      setSelected(created);
    } catch (err: any) {
      toast(err.message || 'Failed to create insight', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this insight? This cannot be undone.')) return;
    try {
      await fetchApi(`/insights/${id}`, { method: 'DELETE' });
      toast('Insight deleted', 'success');
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed to delete insight', 'error');
    }
  };

  const handleRemoveEvidence = async (insightId: string, evidenceId: string) => {
    try {
      await fetchApi(`/insights/${insightId}/evidence/${evidenceId}`, { method: 'DELETE' });
      toast('Evidence removed', 'success');
      await loadDetail(insightId);
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed to remove evidence', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <Spinner size="md" />
        <span className="text-muted">Loading insights…</span>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <div className="insights-master">
        <div className="insights-head">
          <div>
            <h1 className="page-title">Insights</h1>
            <p className="page-sub">{insights.length} {insights.length === 1 ? 'insight' : 'insights'} in this project</p>
          </div>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> New insight
          </button>
        </div>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {!error && insights.length === 0 && (
          <EmptyState
            icon={<Lightbulb size={28} strokeWidth={1.5} />}
            title="No insights yet"
            description="Synthesize your research into insights and back them with transcript evidence."
            action={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={14} /> New insight</button>}
          />
        )}

        <div className="insight-list">
          {insights.map((ins) => (
            <button
              key={ins.id}
              className={`insight-row ${selected?.id === ins.id ? 'active' : ''}`}
              onClick={() => loadDetail(ins.id)}
            >
              <div className="insight-row-main">
                <div className="insight-row-title">{ins.title}</div>
                {ins.description && <div className="insight-row-desc">{ins.description}</div>}
              </div>
              <div className="insight-row-meta">
                {ins.evidence?.length > 0 && (
                  <Badge variant="amber"><Quote size={11} /> {ins.evidence.length}</Badge>
                )}
                <span className="insight-row-date">{fmtDate(ins.created_at)}</span>
                <ChevronRight size={14} className="insight-row-chevron" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <aside className="insights-detail">
          <div className="insights-detail-head">
            <div className="insights-detail-title-wrap">
              <h2 className="insights-detail-title">{selected.title}</h2>
              <span className="insights-detail-date">Created {fmtDate(selected.created_at)}</span>
            </div>
            <button className="btn-ghost-danger" onClick={() => handleDelete(selected.id)} title="Delete insight">
              <Trash2 size={15} />
            </button>
          </div>

          {selected.description && (
            <p className="insights-detail-desc">{selected.description}</p>
          )}

          <div className="insights-detail-section">
            <h3 className="insights-section-label">
              <FileText size={13} /> Evidence ({selected.evidence?.length || 0})
            </h3>

            {!selected.evidence || selected.evidence.length === 0 ? (
              <p className="insights-no-evidence">
                No evidence attached. Link transcript segments from the Transcript Viewer to support this insight.
              </p>
            ) : (
              <div className="evidence-list">
                {selected.evidence.map((ev) => (
                  <div key={ev.id} className="evidence-card">
                    {ev.segment && (
                      <Link
                        to={`/projects/${projectId}/recordings/${ev.segment.recording_id}`}
                        className="evidence-segment"
                      >
                        <div className="evidence-segment-meta">
                          <span className="evidence-time">{fmtTime(ev.segment.start_time)}</span>
                          {ev.segment.speaker_label && <Badge variant="gray">{ev.segment.speaker_label}</Badge>}
                        </div>
                        <p className="evidence-text">{ev.segment.text}</p>
                      </Link>
                    )}
                    {ev.note && <p className="evidence-note">{ev.note}</p>}
                    <button
                      className="evidence-remove"
                      onClick={() => handleRemoveEvidence(selected.id, ev.id)}
                      title="Remove evidence"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      <Modal open={isModalOpen} onClose={() => setModalOpen(false)} title="New insight">
        <div className="modal-form">
          <label className="form-label">
            Title
            <input
              className="form-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Pricing confusion is the top onboarding blocker"
              autoFocus
            />
          </label>
          <label className="form-label">
            Description (optional)
            <textarea
              className="form-input form-textarea"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add context, supporting themes, or a summary…"
              rows={4}
            />
          </label>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
              {creating ? <Spinner size="sm" /> : 'Create insight'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
