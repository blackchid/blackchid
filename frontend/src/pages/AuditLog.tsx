import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, RefreshCw, Shield, Trash2, Eye, Check, X, Scissors } from 'lucide-react';
import { fetchApi } from '../api';
import { Spinner, EmptyState, ErrorBanner } from '../components';
import './AuditLog.css';

interface AuditEntry {
  id: string;
  project_id: string;
  recording_id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; variant: string }> = {
  recording_erased: {
    label: 'Recording erased',
    icon: <Trash2 size={13} />,
    variant: 'red',
  },
  pii_scan_run: {
    label: 'PII scan run',
    icon: <Shield size={13} />,
    variant: 'blue',
  },
  pii_detection_confirmed: {
    label: 'PII confirmed',
    icon: <Check size={13} />,
    variant: 'amber',
  },
  pii_detection_dismissed: {
    label: 'PII dismissed',
    icon: <X size={13} />,
    variant: 'gray',
  },
  redaction_executed: {
    label: 'Redaction executed',
    icon: <Scissors size={13} />,
    variant: 'purple',
  },
};

const fmtDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtRecordingId = (id: string) => id.slice(0, 8) + '…';

export default function AuditLog() {
  const { projectId } = useParams();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    setIsLoading(true);
    try {
      const data = await fetchApi(`/projects/${projectId}/audit-log`);
      setEntries(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit log');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <div className="page-loading">
        <Spinner size="md" />
        <span className="text-muted">Loading audit log…</span>
      </div>
    );
  }

  return (
    <div className="audit-page" style={{ animation: 'pageEnter var(--dur-slow) var(--ease-out) both' }}>
      {/* Header */}
      <div className="audit-head">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-sub">
            Immutable record of all PII, redaction, and erasure events in this project
          </p>
        </div>
        <button className="btn-ghost audit-refresh" onClick={load} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {!error && entries.length === 0 && (
        <EmptyState
          icon={<Shield size={28} strokeWidth={1.5} />}
          title="No audit events yet"
          description="Audit entries are created when recordings are erased, PII is reviewed, or redactions are executed."
        />
      )}

      {entries.length > 0 && (
        <div className="audit-list">
          {entries.map((entry, i) => {
            const meta = ACTION_META[entry.action] || {
              label: entry.action,
              icon: <Eye size={13} />,
              variant: 'gray',
            };
            const isExpanded = expanded === entry.id;

            return (
              <div
                key={entry.id}
                className={`audit-row ${isExpanded ? 'expanded' : ''}`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div
                  className="audit-row-main"
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                >
                  {/* Action icon */}
                  <div className={`audit-icon audit-icon--${meta.variant}`}>
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div className="audit-content">
                    <div className="audit-action">{meta.label}</div>
                    <div className="audit-meta">
                      <span className="mono text-muted" title={entry.recording_id}>
                        rec:{fmtRecordingId(entry.recording_id)}
                      </span>
                      <span className="audit-dot" />
                      <span className="text-muted">{fmtDate(entry.created_at)}</span>
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="audit-toggle">
                    <FileText size={12} className="text-muted" />
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="audit-details">
                    <pre className="audit-json">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                    <div className="audit-ids">
                      <div className="audit-id-row">
                        <span className="audit-id-label">Entry ID</span>
                        <span className="mono text-muted text-xs">{entry.id}</span>
                      </div>
                      <div className="audit-id-row">
                        <span className="audit-id-label">Recording ID</span>
                        <span className="mono text-muted text-xs">{entry.recording_id}</span>
                      </div>
                      {entry.user_id && (
                        <div className="audit-id-row">
                          <span className="audit-id-label">User ID</span>
                          <span className="mono text-muted text-xs">{entry.user_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
