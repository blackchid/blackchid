import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Tags as TagsIcon, Plus, Hash, ChevronRight, AlignLeft, X } from 'lucide-react';
import { fetchApi } from '../api';
import { Badge, Spinner, EmptyState, ErrorBanner, Modal, useToast } from '../components';
import './Tags.css';

interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

interface Segment {
  id: string;
  recording_id: string;
  start_time: number;
  end_time: number;
  text: string;
  speaker_label: string | null;
}

const TAG_COLORS = [
  '#818cf8', '#4ade80', '#fb923c', '#2dd4bf', '#e879f9',
  '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#34d399',
];

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export default function Tags() {
  const { projectId } = useParams();
  const { toast } = useToast();

  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Tag | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segsLoading, setSegsLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal
  const [isModalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const loadTags = useCallback(async () => {
    setError('');
    try {
      const data = await fetchApi(`/projects/${projectId}/tags`);
      setTags(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadTags(); }, [loadTags]);

  const loadSegments = async (tag: Tag) => {
    setSelected(tag);
    setSegsLoading(true);
    setSegments([]);
    try {
      const data = await fetchApi(`/projects/${projectId}/tags/${tag.id}/segments`);
      setSegments(data);
    } catch (err: any) {
      toast(err.message || 'Failed to load segments', 'error');
    } finally {
      setSegsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetchApi('/tags', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          name: newName.trim().toLowerCase(),
          color: newColor,
        }),
      });
      toast('Tag created', 'success');
      setModalOpen(false);
      setNewName('');
      setNewColor(TAG_COLORS[0]);
      await loadTags();
    } catch (err: any) {
      toast(err.message || 'Failed to create tag', 'error');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <Spinner size="md" />
        <span className="text-muted">Loading tags…</span>
      </div>
    );
  }

  return (
    <div className="tags-page">
      {/* Master */}
      <div className="tags-master">
        <div className="tags-head">
          <div>
            <h1 className="page-title">Tags</h1>
            <p className="page-sub">{tags.length} {tags.length === 1 ? 'tag' : 'tags'} in this project</p>
          </div>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> New tag
          </button>
        </div>

        {error && <ErrorBanner message={error} onRetry={loadTags} />}

        {!error && tags.length === 0 && (
          <EmptyState
            icon={<TagsIcon size={28} strokeWidth={1.5} />}
            title="No tags yet"
            description="Create tags to categorize transcript segments. Apply them from the Transcript Viewer."
            action={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={14} /> New tag</button>}
          />
        )}

        <div className="tag-list">
          {tags.map((tag) => (
            <button
              key={tag.id}
              className={`tag-row ${selected?.id === tag.id ? 'active' : ''}`}
              onClick={() => loadSegments(tag)}
            >
              <div
                className="tag-dot"
                style={{ backgroundColor: tag.color || '#888' }}
              />
              <div className="tag-row-name">
                <Hash size={11} className="text-muted" />
                {tag.name}
              </div>
              <ChevronRight size={14} className="tag-row-chevron" />
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <aside className="tags-detail">
          <div className="tags-detail-head">
            <div className="tags-detail-title-wrap">
              <div
                className="tag-dot-lg"
                style={{ backgroundColor: selected.color || '#888' }}
              />
              <h2 className="tags-detail-title">#{selected.name}</h2>
            </div>
            <button
              className="tags-detail-close"
              onClick={() => { setSelected(null); setSegments([]); }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="tags-detail-section">
            <h3 className="tags-section-label">
              <AlignLeft size={13} />
              Segments ({segsLoading ? '…' : segments.length})
            </h3>

            {segsLoading ? (
              <div className="tags-segs-loading">
                <Spinner size="sm" />
                <span className="text-muted text-sm">Loading segments…</span>
              </div>
            ) : segments.length === 0 ? (
              <p className="tags-no-segs">
                No segments tagged yet. Apply this tag from the Transcript Viewer.
              </p>
            ) : (
              <div className="tag-seg-list">
                {segments.map((seg) => (
                  <div key={seg.id} className="tag-seg-card">
                    <div className="tag-seg-meta">
                      <span className="tag-seg-time mono">{fmtTime(seg.start_time)}</span>
                      {seg.speaker_label && (
                        <Badge variant="gray">{seg.speaker_label}</Badge>
                      )}
                    </div>
                    <p className="tag-seg-text">{seg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Create modal */}
      <Modal open={isModalOpen} onClose={() => setModalOpen(false)} title="New tag">
        <div className="modal-form">
          <label className="form-label">
            Name
            <input
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toLowerCase())}
              placeholder="e.g. pricing, onboarding, ui-issue"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </label>

          <div className="form-label">
            Color
            <div className="tag-color-picker">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  className={`tag-color-swatch ${newColor === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          {newName && (
            <div className="tag-preview">
              <span className="tag-preview-label">Preview</span>
              <span
                className="tag-chip"
                style={{
                  backgroundColor: `${newColor}22`,
                  color: newColor,
                  borderColor: `${newColor}44`,
                }}
              >
                <Hash size={10} />
                {newName}
              </span>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? <Spinner size="sm" /> : 'Create tag'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
