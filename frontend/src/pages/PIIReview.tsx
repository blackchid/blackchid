import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield, AlertTriangle, Check, X, Trash2, Scan,
  ChevronRight, Eye, EyeOff, Scissors, Download
} from 'lucide-react';
import { fetchApi } from '../api';
import { Badge, Spinner, EmptyState, ErrorBanner, useToast } from '../components';
import './PIIReview.css';

interface PIIDetection {
  id: string;
  segment_id: string;
  entity_type: string;
  start_char: number;
  end_char: number;
  confidence: number;
  review_status: string; // pending | confirmed | dismissed
  reviewed_by: string | null;
  matched_text: string;
  segment_text: string;
  time_start: number;
  time_end: number;
}

interface Recording {
  id: string;
  filename: string;
  status: string;
  project_id: string;
}

const ENTITY_COLORS: Record<string, string> = {
  PERSON: '#818cf8',
  PHONE_NUMBER: '#4ade80',
  EMAIL_ADDRESS: '#fb923c',
  LOCATION: '#2dd4bf',
  NRP: '#e879f9',
  US_SSN: '#f87171',
  CREDIT_CARD: '#f87171',
  DATE_TIME: '#fbbf24',
  DEFAULT: '#888',
};

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const fmtConfidence = (c: number) => `${Math.round(c * 100)}%`;

function highlightText(text: string, start: number, end: number, color: string) {
  return (
    <span className="pii-text">
      {text.slice(0, start)}
      <mark className="pii-highlight" style={{ '--hl-color': color } as React.CSSProperties}>
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </span>
  );
}

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'dismissed';

export default function PIIReview() {
  const { projectId, recordingId } = useParams();
  const { toast } = useToast();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [detections, setDetections] = useState<PIIDetection[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  // Selection for redaction
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [redacting, setRedacting] = useState(false);

  // Expand/collapse segments
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError('');
    try {
      const [rec, dets] = await Promise.all([
        fetchApi(`/recordings/${recordingId}`),
        fetchApi(`/recordings/${recordingId}/pii${filter !== 'all' ? `?status=${filter}` : ''}`),
      ]);
      setRecording(rec);
      setDetections(dets);
    } catch (err: any) {
      setError(err.message || 'Failed to load PII detections');
    } finally {
      setIsLoading(false);
    }
  }, [recordingId, filter]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await fetchApi(`/recordings/${recordingId}/pii/scan`, { method: 'POST' });
      toast(`Scan complete: ${result.new_detections} new detection${result.new_detections !== 1 ? 's' : ''} found`, 'success');
      setFilter('pending');
      await load();
    } catch (err: any) {
      toast(err.message || 'Scan failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleReview = async (id: string, action: 'confirm' | 'dismiss') => {
    try {
      await fetchApi(`/pii-detections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      toast(action === 'confirm' ? 'Marked as PII — will be redacted' : 'Dismissed as false positive', 'success');
      await load();
    } catch (err: any) {
      toast(err.message || 'Action failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this detection?')) return;
    try {
      await fetchApi(`/pii-detections/${id}`, { method: 'DELETE' });
      toast('Detection deleted', 'success');
      await load();
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const confirmed = detections.filter((d) => d.review_status === 'confirmed').map((d) => d.id);
    setSelected(new Set(confirmed));
  };

  const handleRedact = async () => {
    if (selected.size === 0) return;
    setRedacting(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${BASE_URL}/recordings/${recordingId}/redact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pii_detection_ids: [...selected] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Redaction failed');
      }
      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recording?.filename.replace(/\.[^.]+$/, '')}_redacted.mp3`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Redacted file downloaded', 'success');
      setSelected(new Set());
    } catch (err: any) {
      toast(err.message || 'Redaction failed', 'error');
    } finally {
      setRedacting(false);
    }
  };

  const counts = {
    pending: detections.filter(() => true).length, // will be filtered by API
    confirmed: detections.filter((d) => d.review_status === 'confirmed').length,
    total: detections.length,
  };

  const confirmedIds = new Set(detections.filter((d) => d.review_status === 'confirmed').map((d) => d.id));

  if (isLoading) {
    return (
      <div className="page-loading">
        <Spinner size="md" />
        <span className="text-muted">Loading PII detections…</span>
      </div>
    );
  }

  return (
    <div className="pii-page" style={{ animation: 'pageEnter var(--dur-slow) var(--ease-out) both' }}>
      {/* Header */}
      <div className="pii-head">
        <div className="pii-head-left">
          {/* Breadcrumb */}
          <div className="pii-crumb">
            <Link to={`/projects/${projectId}`} className="pii-crumb-link">Recordings</Link>
            <ChevronRight size={11} className="text-muted" />
            <span className="pii-crumb-file truncate">{recording?.filename}</span>
            <ChevronRight size={11} className="text-muted" />
            <span className="text-muted">PII Review</span>
          </div>
          <h1 className="page-title">PII Review</h1>
          <p className="page-sub">
            Review auto-detected personal information before redacting the audio.
          </p>
        </div>
        <div className="pii-head-actions">
          {selected.size > 0 && (
            <button
              className="btn-danger"
              onClick={handleRedact}
              disabled={redacting}
            >
              {redacting ? <Spinner size="sm" /> : <Scissors size={14} />}
              Redact & Download ({selected.size})
            </button>
          )}
          {confirmedIds.size > 0 && selected.size === 0 && (
            <button className="btn-ghost" onClick={selectAll}>
              <Check size={14} /> Select all confirmed
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleScan}
            disabled={scanning || recording?.status !== 'done'}
            title={recording?.status !== 'done' ? 'Recording must be fully transcribed first' : ''}
          >
            {scanning ? <Spinner size="sm" /> : <Scan size={14} />}
            {scanning ? 'Scanning…' : 'Run PII scan'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Filter tabs */}
      <div className="pii-filters">
        {(['pending', 'confirmed', 'dismissed', 'all'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            className={`pii-filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && counts.pending > 0 && (
              <span className="pii-filter-badge">{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!error && detections.length === 0 && (
        <EmptyState
          icon={<Shield size={28} strokeWidth={1.5} />}
          title={filter === 'pending' ? 'No pending detections' : `No ${filter} detections`}
          description={
            filter === 'pending'
              ? 'Run a PII scan to detect personal information in this recording\'s transcript.'
              : `No detections with "${filter}" status found.`
          }
          action={
            filter === 'pending' ? (
              <button className="btn-primary" onClick={handleScan} disabled={scanning}>
                <Scan size={14} /> Run PII scan
              </button>
            ) : undefined
          }
        />
      )}

      {/* Detection list */}
      {detections.length > 0 && (
        <div className="pii-list">
          {detections.map((det, i) => {
            const color = ENTITY_COLORS[det.entity_type] || ENTITY_COLORS.DEFAULT;
            const isExpanded = expanded.has(det.id);
            const isSelected = selected.has(det.id);

            return (
              <div
                key={det.id}
                className={`pii-card ${det.review_status} ${isSelected ? 'selected' : ''}`}
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <div className="pii-card-top">
                  {/* Selection checkbox (only for confirmed) */}
                  {det.review_status === 'confirmed' && (
                    <input
                      type="checkbox"
                      className="pii-checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(det.id)}
                      title="Select for redaction"
                    />
                  )}

                  {/* Entity badge */}
                  <div
                    className="pii-entity-badge"
                    style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}33` }}
                  >
                    <AlertTriangle size={11} />
                    {det.entity_type.replace(/_/g, ' ')}
                  </div>

                  {/* Matched text */}
                  <div className="pii-matched">
                    <span className="pii-matched-text" style={{ color }}>"{det.matched_text}"</span>
                  </div>

                  {/* Metadata */}
                  <div className="pii-meta">
                    <span className="mono text-muted text-xs">{fmtTime(det.time_start)}</span>
                    <span className="pii-conf">{fmtConfidence(det.confidence)}</span>
                  </div>

                  {/* Status badge */}
                  <div className="pii-status">
                    {det.review_status === 'pending' && <Badge variant="amber">Pending</Badge>}
                    {det.review_status === 'confirmed' && <Badge variant="red">Confirmed PII</Badge>}
                    {det.review_status === 'dismissed' && <Badge variant="gray">Dismissed</Badge>}
                  </div>

                  {/* Toggle context */}
                  <button
                    className="pii-expand-btn"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        next.has(det.id) ? next.delete(det.id) : next.add(det.id);
                        return next;
                      })
                    }
                    title="Toggle context"
                  >
                    {isExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>

                  {/* Actions */}
                  {det.review_status === 'pending' && (
                    <div className="pii-actions">
                      <button
                        className="pii-btn-confirm"
                        onClick={() => handleReview(det.id, 'confirm')}
                        title="Confirm as PII — will be available for redaction"
                      >
                        <Check size={13} /> Confirm
                      </button>
                      <button
                        className="pii-btn-dismiss"
                        onClick={() => handleReview(det.id, 'dismiss')}
                        title="Dismiss as false positive"
                      >
                        <X size={13} /> Dismiss
                      </button>
                    </div>
                  )}
                  {det.review_status !== 'pending' && (
                    <button
                      className="pii-btn-delete"
                      onClick={() => handleDelete(det.id)}
                      title="Delete detection"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Expanded context */}
                {isExpanded && (
                  <div className="pii-context">
                    <div className="pii-context-label">Context</div>
                    <p className="pii-context-text">
                      {highlightText(det.segment_text, det.start_char, det.end_char, color)}
                    </p>
                    <div className="pii-context-meta">
                      <span className="text-muted text-xs mono">
                        {fmtTime(det.time_start)} → {fmtTime(det.time_end)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Redaction action bar (sticky bottom) */}
      {selected.size > 0 && (
        <div className="pii-action-bar">
          <div className="pii-action-bar-content">
            <div className="pii-action-bar-info">
              <Scissors size={15} className="text-accent" />
              <span>
                <strong>{selected.size}</strong> detection{selected.size !== 1 ? 's' : ''} selected for redaction
              </span>
            </div>
            <div className="pii-action-bar-btns">
              <button className="btn-ghost" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
              <button className="btn-danger" onClick={handleRedact} disabled={redacting}>
                {redacting ? <Spinner size="sm" /> : <Download size={14} />}
                {redacting ? 'Processing…' : 'Redact & Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
