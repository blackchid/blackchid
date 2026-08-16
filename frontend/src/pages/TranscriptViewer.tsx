import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play, Pause, Plus, ChevronRight, FileText, Tags, Sparkles, Check, X, Hash, Shield, Lightbulb } from 'lucide-react';
import { fetchApi } from '../api';
import { Spinner, EmptyState, ErrorBanner, useToast } from '../components';
import './TranscriptViewer.css';

interface Segment {
  id: string;
  recording_id: string;
  start_time: number;
  end_time: number;
  text: string;
  speaker_label: string | null;
  created_at: string;
}

interface Recording {
  id: string;
  project_id: string;
  filename: string;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  consent_recording: boolean;
  consent_external_sharing: boolean;
  consent_ai_processing: boolean;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface TagApplication {
  id: string;
  segment_id: string;
  tag_id: string;
  tag_name: string;
  tag_color: string | null;
  note: string | null;
}

interface AISuggestion {
  id: string;
  suggested_name: string;
  status: string;
}

interface Insight {
  id: string;
  title: string;
}

const SPEAKER_COLORS = ['#818cf8', '#4ade80', '#fb923c', '#2dd4bf', '#e879f9', '#fbbf24', '#f87171', '#60a5fa'];

export default function TranscriptViewer() {
  const { projectId, recordingId } = useParams();
  const { toast } = useToast();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Tags
  const [projectTags, setProjectTags] = useState<Tag[]>([]);
  const [tagApps, setTagApps] = useState<TagApplication[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [applyingTag, setApplyingTag] = useState(false);

  // AI suggestions
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Add to Insight
  const [insights, setInsights] = useState<Insight[]>([]);
  const [showInsightPicker, setShowInsightPicker] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    if (!projectId) return;
    try {
      const [tags, apps, ins] = await Promise.all([
        fetchApi(`/projects/${projectId}/tags`),
        recordingId ? fetchApi(`/recordings/${recordingId}/tag-applications`) : Promise.resolve([]),
        fetchApi(`/projects/${projectId}/insights`).catch(() => []),
      ]);
      setProjectTags(tags);
      setTagApps(apps);
      setInsights(ins);
    } catch {
      // non-fatal
    }
  }, [projectId, recordingId]);

  useEffect(() => {
    setError('');
    Promise.all([
      fetchApi(`/recordings/${recordingId}`),
      fetchApi(`/recordings/${recordingId}/transcript`).catch(() => []),
    ]).then(([rec, segs]) => {
      setRecording(rec);
      setSegments(segs);
    }).catch((err: any) => {
      setError(err.message || 'Failed to load transcript');
    }).finally(() => setIsLoading(false));
    loadTags();
  }, [recordingId, loadTags]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const getSegmentTags = (segId: string) =>
    tagApps.filter((a) => a.segment_id === segId);

  const handleApplyTag = async (tagId: string) => {
    if (!activeId) return;
    setApplyingTag(true);
    try {
      await fetchApi(`/tags/${tagId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ segment_id: activeId }),
      });
      toast('Tag applied', 'success');
      setShowTagPicker(false);
      await loadTags();
    } catch (err: any) {
      toast(err.message || 'Failed to apply tag', 'error');
    } finally {
      setApplyingTag(false);
    }
  };

  const handleSuggest = async () => {
    if (!activeId || !projectId) return;
    setSuggesting(true);
    try {
      const data = await fetchApi(`/projects/${projectId}/tags/suggest`, {
        method: 'POST',
        body: JSON.stringify({ segment_id: activeId }),
      });
      setSuggestions(data.suggestions || []);
      if (!data.suggestions?.length) {
        toast('No suggestions returned by AI', 'info');
      }
    } catch (err: any) {
      toast(err.message || 'AI suggest failed — is Ollama running?', 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const handleAcceptSuggestion = async (suggId: string) => {
    setAcceptingId(suggId);
    try {
      await fetchApi(`/tags/suggestions/${suggId}/accept`, { method: 'POST' });
      toast('Tag accepted & applied', 'success');
      setSuggestions((prev) => prev.filter((s) => s.id !== suggId));
      await loadTags();
    } catch (err: any) {
      toast(err.message || 'Failed to accept suggestion', 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectSuggestion = async (suggId: string) => {
    try {
      await fetchApi(`/tags/suggestions/${suggId}/reject`, { method: 'POST' });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggId));
    } catch {
      // non-fatal
    }
  };

  if (isLoading) {
    return (
      <div className="tv-loading">
        <Spinner size="md" />
        <span className="text-muted">Loading transcript…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tv-loading" style={{flexDirection: 'column', gap: 12}}>
        <ErrorBanner message={error} />
      </div>
    );
  }

  const speakers = [...new Set(segments.map(s => s.speaker_label).filter(Boolean))] as string[];

  // Tags available to apply to the active segment (not already applied)
  const activeSegTags = activeId ? getSegmentTags(activeId) : [];
  const alreadyApplied = new Set(activeSegTags.map((a) => a.tag_id));
  const availableTags = projectTags.filter((t) => !alreadyApplied.has(t.id));

  return (
    <div className="tv">
      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div className="tv-crumb">
        <Link to={`/projects/${projectId}`} className="tv-crumb-link">Recordings</Link>
        <ChevronRight size={12} className="text-muted" />
        <span className="tv-crumb-file mono truncate">{recording?.filename || 'File'}</span>
        <div className="tv-crumb-spacer" />
        {recording && (
          <Link
            to={`/projects/${projectId}/recordings/${recordingId}/pii`}
            className="tv-crumb-pii-link"
            title="Review PII detections for this recording"
          >
            <Shield size={12} />
            PII Review
          </Link>
        )}
      </div>

      {/* ── Player ───────────────────────────────────────────────────── */}
      <div className="tv-player">
        <button className="tv-play" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause size={14}/> : <Play size={14} style={{marginLeft: 1}}/>}
        </button>

        {/* Waveform (decorative until wavesurfer is installed) */}
        <div className="tv-wave">
          {Array.from({ length: 80 }, (_, i) => {
            const h = 6 + Math.abs(Math.sin(i * 0.4) * 16) + Math.random() * 6;
            return <div key={i} className={`tv-bar ${i < 20 ? 'played' : ''}`} style={{height: h}} />;
          })}
        </div>

        <div className="tv-time mono">
          <span className="text-fg">00:34</span>
          <span className="text-muted">/ {recording && recording.duration_seconds != null ? fmtTime(recording.duration_seconds) : '--:--'}</span>
        </div>
      </div>

      {/* ── Two Pane ─────────────────────────────────────────────────── */}
      <div className="tv-panes">
        {/* Left: Transcript */}
        <div className="tv-left">
          {segments.length === 0 ? (
            <EmptyState
              icon={<FileText size={28} strokeWidth={1.2} />}
              title="No transcript available"
              description="Processing may still be running. Check back shortly."
            />
          ) : (
            <div className="tv-lines">
              {segments.map(seg => {
                const sp = seg.speaker_label || 'Unknown';
                const si = speakers.indexOf(sp);
                const color = SPEAKER_COLORS[si % SPEAKER_COLORS.length];
                const segTags = getSegmentTags(seg.id);
                return (
                  <div 
                    key={seg.id} 
                    className={`tv-line ${activeId === seg.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveId(seg.id);
                      setShowTagPicker(false);
                      setSuggestions([]);
                    }}
                  >
                    <div className="tv-line-time mono">{fmtTime(seg.start_time)}</div>
                    <div className="tv-line-body">
                      <div className="tv-line-speaker" style={{color}}>{sp}</div>
                      <div className="tv-line-text">{seg.text}</div>
                      {/* Tag chips on segment */}
                      {segTags.length > 0 && (
                        <div className="tv-seg-tags">
                          {segTags.map((app) => (
                            <span
                              key={app.id}
                              className="tv-tag-chip"
                              style={{
                                backgroundColor: app.tag_color ? `${app.tag_color}20` : 'var(--bg-elevated)',
                                color: app.tag_color || 'var(--fg-secondary)',
                                borderColor: app.tag_color ? `${app.tag_color}44` : 'var(--border)',
                              }}
                            >
                              <Hash size={9} />
                              {app.tag_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Panel */}
        <div className="tv-right">
          {/* Speakers */}
          <div className="tv-panel">
            <div className="tv-panel-label">Speakers</div>
            {speakers.length > 0 ? (
              <div className="tv-speaker-list">
                {speakers.map((sp, i) => (
                  <div key={sp} className="tv-speaker-item">
                    <div className="tv-speaker-dot" style={{backgroundColor: SPEAKER_COLORS[i % SPEAKER_COLORS.length]}} />
                    <span className="tv-speaker-name">{sp}</span>
                    <span className="text-muted ml-auto text-xs">{segments.filter(s => s.speaker_label === sp).length}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">No speakers detected.</p>
            )}
          </div>

          {/* Tags panel */}
          <div className="tv-panel">
            <div className="tv-panel-label">
              <Tags size={12} />
              Tags
            </div>

            {activeId ? (
              <>
                {/* Applied tags on active segment */}
                {activeSegTags.length > 0 && (
                  <div className="tv-panel-applied-tags">
                    {activeSegTags.map((app) => (
                      <span
                        key={app.id}
                        className="tv-tag-chip"
                        style={{
                          backgroundColor: app.tag_color ? `${app.tag_color}20` : 'var(--bg-elevated)',
                          color: app.tag_color || 'var(--fg-secondary)',
                          borderColor: app.tag_color ? `${app.tag_color}44` : 'var(--border)',
                        }}
                      >
                        <Hash size={9} />
                        {app.tag_name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag picker */}
                {showTagPicker ? (
                  <div className="tv-tag-picker">
                    {availableTags.length === 0 ? (
                      <p className="text-muted text-sm">All tags applied. Create more in Tags →</p>
                    ) : (
                      availableTags.map((tag) => (
                        <button
                          key={tag.id}
                          className="tv-tag-pick-btn"
                          onClick={() => handleApplyTag(tag.id)}
                          disabled={applyingTag}
                        >
                          <span
                            className="tv-tag-pick-dot"
                            style={{ backgroundColor: tag.color || '#888' }}
                          />
                          #{tag.name}
                        </button>
                      ))
                    )}
                    <button
                      className="tv-tag-pick-cancel"
                      onClick={() => setShowTagPicker(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="ghost tv-panel-btn"
                    onClick={() => setShowTagPicker(true)}
                    disabled={projectTags.length === 0}
                    title={projectTags.length === 0 ? 'Create tags first from the Tags page' : ''}
                  >
                    <Plus size={13}/> Apply tag
                  </button>
                )}
              </>
            ) : (
              <p className="text-muted text-sm">Click a transcript line to tag it.</p>
            )}
          </div>

          {/* AI Suggestions */}
          <div className="tv-panel">
            <div className="tv-panel-label">
              <Sparkles size={12} />
              AI Suggestions
            </div>

            {activeId ? (
              <>
                {suggestions.length > 0 ? (
                  <div className="tv-suggestions">
                    {suggestions.map((s) => (
                      <div key={s.id} className="tv-suggestion-row">
                        <span className="tv-suggestion-name">#{s.suggested_name}</span>
                        <div className="tv-suggestion-actions">
                          <button
                            className="tv-sugg-accept"
                            onClick={() => handleAcceptSuggestion(s.id)}
                            disabled={acceptingId === s.id}
                            title="Accept & apply"
                          >
                            {acceptingId === s.id ? <Spinner size="sm" /> : <Check size={12} />}
                          </button>
                          <button
                            className="tv-sugg-reject"
                            onClick={() => handleRejectSuggestion(s.id)}
                            title="Dismiss"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-sm">
                    {suggesting ? 'Asking AI…' : 'Get AI tag suggestions for the selected line.'}
                  </p>
                )}
                <button
                  className="ghost tv-panel-btn"
                  onClick={handleSuggest}
                  disabled={suggesting}
                >
                  {suggesting ? <Spinner size="sm" /> : <Sparkles size={13} />}
                  {suggesting ? 'Thinking…' : 'Suggest tags'}
                </button>
              </>
            ) : (
              <p className="text-muted text-sm">Select a segment to get AI tag suggestions.</p>
            )}
          </div>

          {/* Add to Insight */}
          <div className="tv-panel">
            <div className="tv-panel-label">
              <Lightbulb size={12} />
              Link to Insight
            </div>

            {activeId ? (
              showInsightPicker ? (
                <div className="tv-tag-picker">
                  {insights.length === 0 ? (
                    <p className="text-muted text-sm">No insights yet. Create one on the Insights page first.</p>
                  ) : (
                    insights.map((ins) => (
                      <button
                        key={ins.id}
                        className={`tv-tag-pick-btn ${selectedInsightId === ins.id ? 'selected' : ''}`}
                        onClick={() => setSelectedInsightId(selectedInsightId === ins.id ? null : ins.id)}
                      >
                        <Lightbulb size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span className="truncate">{ins.title}</span>
                      </button>
                    ))
                  )}
                  {selectedInsightId && (
                    <div style={{ paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                      <input
                        className="form-input"
                        style={{ fontSize: '0.75rem', height: 30 }}
                        value={evidenceNote}
                        onChange={(e) => setEvidenceNote(e.target.value)}
                        placeholder="Optional note…"
                      />
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        <button
                          className="tv-tag-pick-btn"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', color: 'var(--fg)' }}
                          onClick={async () => {
                            if (!selectedInsightId || !activeId) return;
                            setAddingEvidence(true);
                            try {
                              await fetchApi(`/insights/${selectedInsightId}/evidence`, {
                                method: 'POST',
                                body: JSON.stringify({ segment_id: activeId, note: evidenceNote || null }),
                              });
                              toast('Linked to insight', 'success');
                              setShowInsightPicker(false);
                              setSelectedInsightId(null);
                              setEvidenceNote('');
                            } catch (err: any) {
                              toast(err.message || 'Failed to link', 'error');
                            } finally {
                              setAddingEvidence(false);
                            }
                          }}
                          disabled={addingEvidence}
                        >
                          {addingEvidence ? <Spinner size="sm" /> : <Check size={11} />}
                          Confirm
                        </button>
                        <button
                          className="tv-tag-pick-cancel"
                          style={{ flex: 1, borderTop: 'none', marginTop: 0 }}
                          onClick={() => { setSelectedInsightId(null); setEvidenceNote(''); }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                  <button className="tv-tag-pick-cancel" onClick={() => setShowInsightPicker(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="ghost tv-panel-btn"
                  onClick={() => setShowInsightPicker(true)}
                  disabled={insights.length === 0}
                  title={insights.length === 0 ? 'Create an insight first' : 'Link this segment as evidence'}
                >
                  <Plus size={13} /> Add as evidence
                </button>
              )
            ) : (
              <p className="text-muted text-sm">Select a segment to link it to an insight.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
