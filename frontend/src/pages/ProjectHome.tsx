import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Upload, FileVideo, Plus, MoreHorizontal, Mic, Clock, Shield } from 'lucide-react';
import { fetchApi } from '../api';
import { Badge, Spinner, EmptyState, ErrorBanner, Skeleton, useToast } from '../components';
import './ProjectHome.css';

interface Recording {
  id: string;
  project_id: string;
  storage_path: string | null;
  filename: string;
  duration_seconds: number | null;
  status: string;
  consent_recording: boolean;
  consent_external_sharing: boolean;
  consent_ai_processing: boolean;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProjectHome() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('recordings');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const load = async () => {
    setFetchError('');
    try {
      const [proj, recs] = await Promise.all([
        fetchApi(`/projects/${projectId}`).catch(() => null),
        fetchApi(`/projects/${projectId}/recordings`),
      ]);
      setProject(proj);
      setRecordings(recs);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await fetchApi(`/projects/${projectId}/recordings`, { method: 'POST', body: fd });
      toast('Upload started', 'success');
      await load();
    } catch (err: any) {
      const msg = err.message || 'Upload failed';
      toast(msg, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const fmt = (s: number | null) => {
    if (!s) return '--:--';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const ago = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const tabs = [
    { key: 'recordings', label: 'Recordings', count: recordings.length },
    { key: 'documents', label: 'Documents' },
    { key: 'imports', label: 'Imports' },
  ];

  const statusBadge = (status: string) => {
    if (status === 'processing') return <Badge variant="blue" dot pulse>Processing</Badge>;
    if (status === 'pending') return <Badge variant="gray" dot pulse>Pending</Badge>;
    if (status === 'error') return <Badge variant="red" dot>Error</Badge>;
    if (status === 'done') return <Badge variant="green" dot>Ready</Badge>;
    return <Badge>{status}</Badge>;
  };

  return (
    <div className="ph" style={{animation: 'pageEnter var(--dur-slow) var(--ease-out) both'}}>
      {/* Project header */}
      <div className="ph-project-head">
        <div className="ph-project-info">
          <h1 className="ph-project-name">{project?.name || 'Project'}</h1>
          {project?.description && <p className="ph-project-desc">{project.description}</p>}
        </div>
        <div className="ph-project-stats">
          <div className="ph-stat">
            <Mic size={14} />
            <span>{recordings.length} recordings</span>
          </div>
          <div className="ph-stat">
            <Clock size={14} />
            <span>{recordings.filter(r => r.status === 'done').length} ready</span>
          </div>
        </div>
      </div>

      {/* Header: Tabs + Actions */}
      <div className="ph-head">
        <div className="ph-tabs">
          {tabs.map(t => (
            <button 
              key={t.key} 
              className={`ph-tab ${activeTab === t.key ? 'active' : ''}`} 
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ph-tab-badge">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ph-actions">
          <button className="primary" onClick={() => document.getElementById('file-up')?.click()} disabled={uploading}>
            {uploading ? <><Spinner size="sm" /> Uploading...</> : <><Upload size={14}/> Upload</>}
          </button>
          <input type="file" id="file-up" hidden accept="audio/*,video/*" onChange={handleUpload} />
        </div>
      </div>

      {/* Search */}
      <div className="ph-search">
        <Search size={14} className="ph-search-icon" />
        <input placeholder={`Search ${activeTab}...`} className="ph-search-input" />
      </div>

      {/* Table */}
      <div className="ph-table-wrap">
        {activeTab === 'recordings' ? (
          isLoading ? (
            <div className="ph-skeleton-list">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="ph-skeleton-row">
                  <Skeleton width={16} height={16} radius="4px" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skeleton width={`${40 + i * 10}%`} height={13} />
                    <Skeleton width="25%" height={11} />
                  </div>
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <ErrorBanner message={fetchError} onRetry={load} />
          ) : recordings.length === 0 ? (
            <EmptyState
              icon={<FileVideo size={28} strokeWidth={1.2} />}
              title="No recordings"
              description="Upload your first audio or video file to begin."
              action={
                <button className="secondary mt-4" onClick={() => document.getElementById('file-up')?.click()}>
                  <Upload size={14}/> Upload file
                </button>
              }
            />
          ) : (
            <table className="ph-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{width: 80}}>Duration</th>
                  <th style={{width: 100}}>Uploaded</th>
                  <th style={{width: 110}}>Status</th>
                  <th style={{width: 40}}></th>
                </tr>
              </thead>
              <tbody>
                {recordings.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/projects/${projectId}/recordings/${r.id}`)}>
                    <td>
                      <div className="ph-name-cell">
                        <FileVideo size={14} className="text-muted" />
                        <span className="ph-filename truncate">{r.filename}</span>
                      </div>
                    </td>
                    <td className="mono text-muted">{fmt(r.duration_seconds)}</td>
                    <td className="text-muted">{ago(r.created_at)}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td>
                      <div className="ph-row-actions">
                        {r.status === 'done' && (
                          <button
                            className="ph-row-action-btn"
                            title="Review PII"
                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${projectId}/recordings/${r.id}/pii`); }}
                          >
                            <Shield size={13} />
                          </button>
                        )}
                        <button className="ph-row-more" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <EmptyState
            icon={<Plus size={28} strokeWidth={1.2} />}
            title="Coming soon"
            description="This section is not yet available."
          />
        )}
      </div>
    </div>
  );
}
