import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play, Pause, Plus, ChevronRight, FileText } from 'lucide-react';
import { fetchApi } from '../api';
import { Spinner, EmptyState, ErrorBanner } from '../components';
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

const SPEAKER_COLORS = ['#818cf8', '#4ade80', '#fb923c', '#2dd4bf', '#e879f9', '#fbbf24', '#f87171', '#60a5fa'];

export default function TranscriptViewer() {
  const { projectId, recordingId } = useParams();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');

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
  }, [recordingId]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
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

  return (
    <div className="tv">
      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div className="tv-crumb">
        <Link to={`/projects/${projectId}`} className="tv-crumb-link">Recordings</Link>
        <ChevronRight size={12} className="text-muted" />
        <span className="tv-crumb-file mono truncate">{recording?.filename || 'File'}</span>
      </div>

      {/* ── Player ───────────────────────────────────────────────────── */}
      <div className="tv-player">
        <button className="tv-play" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause size={14}/> : <Play size={14} style={{marginLeft: 1}}/>}
        </button>

        {/* Waveform */}
        <div className="tv-wave">
          {Array.from({ length: 80 }, (_, i) => {
            const h = 6 + Math.abs(Math.sin(i * 0.4) * 16) + Math.random() * 6;
            return <div key={i} className={`tv-bar ${i < 20 ? 'played' : ''}`} style={{height: h}} />;
          })}
        </div>

        <div className="tv-time mono">
          <span className="text-fg">00:34</span>
          <span className="text-muted"> / {recording && recording.duration_seconds != null ? fmtTime(recording.duration_seconds) : '--:--'}</span>
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
                return (
                  <div 
                    key={seg.id} 
                    className={`tv-line ${activeId === seg.id ? 'active' : ''}`}
                    onClick={() => setActiveId(seg.id)}
                  >
                    <div className="tv-line-time mono">{fmtTime(seg.start_time)}</div>
                    <div className="tv-line-body">
                      <div className="tv-line-speaker" style={{color}}>{sp}</div>
                      <div className="tv-line-text">{seg.text}</div>
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

          {/* Tags */}
          <div className="tv-panel">
            <div className="tv-panel-label">Tags</div>
            <p className="text-muted text-sm">Select a transcript line to tag it.</p>
            <button className="ghost tv-panel-btn mt-3"><Plus size={13}/> Add tag</button>
          </div>

          {/* AI Suggestions */}
          <div className="tv-panel">
            <div className="tv-panel-label">AI Suggestions</div>
            <p className="text-muted text-sm">Will appear after processing completes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
