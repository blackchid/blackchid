import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Play, Pause, X, FileText, Tag, Sparkles, Check,
  Hash, MoreHorizontal, ThumbsUp, ThumbsDown,
  Activity, Volume2, Bookmark, Download, Share2,
  Users, Clock, BarChart2, MessageSquare, Scissors,
  FolderOpen, FileVideo
} from 'lucide-react';
import { fetchApi } from '../api';
import { Spinner, useToast } from '../components';
import './TranscriptViewer.css';

interface WordStamp { word: string; start: number; end: number; score?: number; }
interface Segment {
  id: string; recording_id: string; start_time: number; end_time: number;
  text: string; speaker_label: string | null;
  word_timestamps: WordStamp[] | null; created_at: string;
}
interface Recording {
  id: string; project_id: string; filename: string;
  duration_seconds: number | null; status: string;
  error_message?: string | null;
  created_at: string; updated_at: string;
  consent_recording: boolean; consent_external_sharing: boolean; consent_ai_processing: boolean;
}
interface TagModel { id: string; name: string; color: string | null; }
interface TagApplication {
  id: string; segment_id: string; tag_id: string;
  tag_name: string; tag_color: string | null; note: string | null;
}

const SPEAKER_COLORS = ['#818cf8','#4ade80','#fb923c','#2dd4bf','#e879f9','#fbbf24','#f87171','#60a5fa'];
const SPEAKER_BG = ['rgba(129,140,248,0.12)','rgba(74,222,128,0.12)','rgba(251,146,60,0.12)','rgba(45,212,180,0.12)','rgba(232,121,249,0.12)','rgba(251,191,36,0.12)'];
const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
type RightTab = 'summary' | 'ai' | 'tags' | 'clips';

const fmtTime = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const speakerName = (l: string) => l.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

// Approximate pipeline steps shown in the transcribing popup. `at` is the
// elapsed-seconds threshold after which the step is shown as in-progress —
// the backend doesn't report fine-grained progress, so these are estimates.
const PROC_STEPS = [
  { label: 'Upload complete', at: 0 },
  { label: 'Transcribing with WhisperX', at: 1 },
  { label: 'Aligning words & diarizing speakers', at: 30 },
  { label: 'Embedding & saving segments', at: 90 },
];

export default function TranscriptViewer() {
  const { projectId, recordingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const close = useCallback(() => navigate(`/projects/${projectId}`), [navigate, projectId]);

  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectTags, setProjectTags] = useState<TagModel[]>([]);
  const [tagApps, setTagApps] = useState<TagApplication[]>([]);
  const [projectName, setProjectName] = useState('');
  const [rate, setRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rightTab, setRightTab] = useState<RightTab>('summary');
  const [highlightMode, setHighlightMode] = useState<'original'|'highlights'>('original');
  const [retrying, setRetrying] = useState(false);

  const videoRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  // Callback ref shared by <video> and <audio> so audio-only recordings
  // still get a playable media element behind the waveform visual.
  const attachMedia = useCallback((el: HTMLVideoElement | HTMLAudioElement | null) => { videoRef.current = el; }, []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const [activeWordKey, setActiveWordKey] = useState<string | null>(null);
  const [activeSegId, setActiveSegId] = useState<string | null>(null);
  const activeSegRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagPickerSegId, setTagPickerSegId] = useState<string | null>(null);
  const [applyingTag, setApplyingTag] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectionToolbar, setSelectionToolbar] = useState<{x:number;y:number;segId:string;text:string}|null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const loadTags = useCallback(async () => {
    if (!projectId || !recordingId) return;
    try {
      const [tags, apps] = await Promise.all([
        fetchApi(`/projects/${projectId}/tags`),
        fetchApi(`/recordings/${recordingId}/tag-applications`),
      ]);
      setProjectTags(tags); setTagApps(apps);
    } catch { /* non-fatal */ }
  }, [projectId, recordingId]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const rec = await fetchApi(`/recordings/${id}`);
        setRecording(rec);
        if (rec.status === 'done') {
          stopPolling();
          const segs = await fetchApi(`/recordings/${id}/transcript`).catch(() => []);
          setSegments(segs);
          // Tag applications from a previous transcription were cascade-deleted
          // on re-transcribe — refresh so no stale chips remain.
          loadTags();
          toast('Transcription complete', 'success');
        } else if (rec.status === 'error') { stopPolling(); }
      } catch { /* ignore */ }
    }, 3000);
  }, [stopPolling, loadTags, toast]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Escape closes the tag picker first (if open), otherwise the whole modal.
  const tagPickerOpenRef = useRef(false);
  tagPickerOpenRef.current = showTagPicker;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (tagPickerOpenRef.current) { setShowTagPicker(false); return; }
      setSelectionToolbar(null);
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const isTranscribing = recording?.status === 'processing' || recording?.status === 'pending';

  // Elapsed-time ticker for the transcribing popup. The start time comes from
  // recording.updated_at (set server-side when processing began) so the
  // counter stays accurate after a page refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isTranscribing) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isTranscribing]);

  useEffect(() => {
    setError(''); setIsLoading(true);
    Promise.all([
      fetchApi(`/recordings/${recordingId}`),
      fetchApi(`/recordings/${recordingId}/transcript`).catch(() => []),
    ]).then(([rec, segs]) => {
      setRecording(rec); setSegments(segs);
      if (rec.status === 'processing' || rec.status === 'pending') startPolling(recordingId!);
    }).catch((e: any) => setError(e.message || 'Failed to load'))
      .finally(() => setIsLoading(false));
    loadTags();
    fetchApi(`/projects/${projectId}`).then(p => setProjectName(p?.name || '')).catch(() => {});
  }, [recordingId, loadTags, startPolling, projectId]);

  const mediaSrc = (() => {
    if (!recordingId || recording?.status !== 'done') return null;
    const token = localStorage.getItem('access_token') || '';
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
    return `${baseUrl}/recordings/${recordingId}/audio?token=${encodeURIComponent(token)}`;
  })();
  // Force the <video> to remount when the source becomes available so it
  // re-fetches (a stale src attribute won't reload once the element exists).
  const videoKey = mediaSrc ?? 'empty';

  // Audio-only recordings get a waveform visual instead of a black video box.
  const isVideo = /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(recording?.filename || '');
  const waveBars = useMemo(
    () => Array.from({ length: 96 }, (_, i) =>
      16 + Math.round(Math.abs(Math.sin(i * 0.35) * 0.6 + Math.sin(i * 0.13) * 0.4) * 64)
    ),
    []
  );

  const cycleSpeed = useCallback(() => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
    const a = videoRef.current; if (a) a.playbackRate = next;
  }, [rate]);

  // Keep latest segments in a ref so the <video> onTimeUpdate handler always
  // sees current data (the element captures the first render's callback).
  const segmentsRef = useRef<Segment[]>([]);
  segmentsRef.current = segments;

  const handleTimeUpdate = useCallback(() => {
    const a = videoRef.current;
    if (!a) return;
    const t = a.currentTime;
    setCurrentTime(t);
    const segs = segmentsRef.current;
    const seg = segs.find(s => t >= s.start_time && t < s.end_time);
    setActiveSegId(prev => (seg && seg.id !== prev) ? seg.id : prev);
    if (seg?.word_timestamps?.length) {
      // Use <= on the end boundary so the last word stays highlighted until
      // the next word/segment begins, instead of flickering off.
      const wIdx = seg.word_timestamps.findIndex(w => t >= (w.start ?? 0) && t <= (w.end ?? seg.end_time));
      setActiveWordKey(wIdx >= 0 ? `${seg.id}-${wIdx}` : null);
    } else {
      setActiveWordKey(null);
    }
  }, []);

  useEffect(() => {
    // Defer to next frame so the ref has attached to the new active segment.
    const id = requestAnimationFrame(() => {
      if (activeSegRef.current) activeSegRef.current.scrollIntoView({behavior:'smooth',block:'center'});
    });
    return () => cancelAnimationFrame(id);
  }, [activeSegId]);

  const seekTo = useCallback((t: number) => {
    const a = videoRef.current;
    if (!a) return;
    // Guard: don't play until the element is ready, otherwise the play()
    // promise rejects silently and nothing happens.
    const ready = a.readyState >= 2; // HAVE_CURRENT_DATA
    a.currentTime = t;
    setCurrentTime(t);
    if (ready) { a.play().catch(() => { /* autoplay block — ignore */ }); }
  }, []);

  // Mirror duration in a ref so the progress-click handler always sees the
  // latest value without re-creating the callback each render.
  const durRef = useRef<number | null>(null);
  durRef.current = mediaDuration ?? recording?.duration_seconds ?? null;

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    const track = progressRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const dur = durRef.current ?? 0;
    if (dur > 0) seekTo(Math.max(0, Math.min(pct * dur, dur)));
  }, [seekTo]);

  const handleApplyTag = async (tagId: string) => {
    if (!tagPickerSegId) return;
    setApplyingTag(true);
    try {
      await fetchApi(`/tags/${tagId}/apply`, { method:'POST', body: JSON.stringify({segment_id: tagPickerSegId}) });
      toast('Tag applied', 'success'); setShowTagPicker(false); setTagPickerSegId(null); await loadTags();
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setApplyingTag(false); }
  };

  const handleRemoveTag = async (tagId: string, segmentId: string) => {
    try {
      await fetchApi(`/tags/${tagId}/apply/${segmentId}`, { method: 'DELETE' });
      await loadTags(); toast('Tag removed', 'info');
    } catch (e: any) { toast(e.message || 'Failed to remove tag', 'error'); }
  };

  const handleRetranscribe = async () => {
    if (!recordingId) return;
    setRetrying(true);
    setMediaError(false); // reset so the player recovers after re-transcribe
    // Old segments are deleted server-side — drop any derived UI state too.
    setTagApps([]); setSuggestions([]); setActiveSegId(null); setActiveWordKey(null);
    try {
      const rec = await fetchApi(`/recordings/${recordingId}/retranscribe`, {method:'POST'});
      setRecording(rec); setSegments([]); toast('Queued for re-transcription','success'); startPolling(recordingId);
    } catch (e: any) { toast(e.message||'Failed','error'); }
    finally { setRetrying(false); }
  };

  const handleTextSelect = useCallback((segId: string) => {
    // Defer so the browser has finalized the selection after mouseup.
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSelectionToolbar(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelectionToolbar({ x: rect.left + rect.width/2, y: rect.top - 8, segId, text: sel.toString().trim() });
    });
  }, []);

  useEffect(() => {
    const hide = () => setSelectionToolbar(null);
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const wordCount = segments.reduce((n,s) => n + s.text.split(/\s+/).length, 0);
  const speakers = [...new Set(segments.map(s=>s.speaker_label).filter(Boolean))] as string[];
  const getSegTags = (id: string) => tagApps.filter(a => a.segment_id === id);
  const taggedIds = new Set(tagApps.map(a => a.segment_id));
  const highlightedSegs = highlightMode === 'highlights'
    ? segments.filter(s => taggedIds.has(s.id))
    : segments;
  const dur = mediaDuration ?? recording?.duration_seconds;
  const safeDur = dur && dur > 0 ? dur : null;
  const pct = safeDur ? Math.min((currentTime / safeDur) * 100, 100) : 0;

  // Progress-step state for the transcribing popup
  const procStartMs = recording?.updated_at ? new Date(recording.updated_at).getTime() : null;
  const elapsed = procStartMs ? Math.max(0, Math.floor((now - procStartMs) / 1000)) : 0;
  const activeStep = Math.max(0, PROC_STEPS.filter(s => elapsed >= s.at).length - 1);

  if (isLoading) return createPortal(
    <>
      <div className="tv2-backdrop" onClick={close} />
      <div className="tv2-shell"><div className="tv2-center"><Spinner size="md" /><span className="tv2-load-txt">Loading…</span></div></div>
    </>,
    document.body
  );
  if (error) return createPortal(
    <>
      <div className="tv2-backdrop" onClick={close} />
      <div className="tv2-shell"><div className="tv2-center">
        <div className="tv2-err-box">
          <span className="tv2-err-icon">⚠</span>
          <p className="tv2-err-title">Could not load recording</p>
          <p className="tv2-err-body">{error}</p>
          <button className="tv2-btn-primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div></div>
    </>,
    document.body
  );

  return createPortal(
    <>
      <div className="tv2-backdrop" onClick={close} />
      <div className="tv2-shell" role="dialog" aria-modal="true" aria-label={`Recording ${recording?.filename || ''}`} onClick={(e) => { /* only close if click hit the shell itself, not a child */ if (e.target === e.currentTarget) setShowTagPicker(false); }}>

      {/* HEADER */}
      <header className="tv2-header">
        <div className="tv2-header-left">
          <button className="tv2-back-btn" onClick={close} title="Close"><X size={16} /></button>
          <div className="tv2-crumb-chip">
            <span className="tv2-crumb-icon"><FolderOpen size={11} /></span>
            <span className="txt">{projectName || 'Project'}</span>
          </div>
          <span className="tv2-crumb-sep">/</span>
          <div className="tv2-crumb-chip">
            <span className="tv2-crumb-icon gold"><FileVideo size={11} /></span>
            <span className="txt">{recording?.filename}</span>
          </div>
        </div>
        <div className="tv2-header-right">
          <button className="tv2-hdr-btn" title="Download"><Download size={15}/></button>
          <button className="tv2-hdr-btn" title="Share"><Share2 size={15}/></button>
          <button className="tv2-hdr-btn" title="More"><MoreHorizontal size={15}/></button>
        </div>
      </header>

      {/* BODY */}
      <div className="tv2-body">
        {/* CENTER */}
        <main className="tv2-main">
        <div className="tv2-content">
          <h1 className="tv2-big-title">{recording?.filename || 'Untitled recording'}</h1>
          <div className="tv2-view-toggle">
            <button className={`tv2-view-pill ${highlightMode==='original'?'active':''}`} onClick={() => setHighlightMode('original')}>Original</button>
            <button className={`tv2-view-pill ${highlightMode==='highlights'?'active':''}`} onClick={() => setHighlightMode('highlights')}>Highlights only</button>
          </div>

          {/* PLAYER */}
          <div className="tv2-player-card">
            <div className={`tv2-video-area${isVideo ? '' : ' audio'}`} onClick={() => { const a=videoRef.current; if(!a) return; if(isPlaying){a.pause();}else{a.play().catch(()=>{});} }}>
              {isVideo && mediaSrc && (
                <video key={videoKey} ref={attachMedia} src={mediaSrc} preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0 }}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => { const a = videoRef.current; if (a) setMediaDuration(a.duration); }}
                  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => { const a = videoRef.current; if (a && a.error && a.error.code !== 0) setMediaError(true); }}
                />
              )}
              {!isVideo && mediaSrc && (
                <audio key={videoKey} ref={attachMedia} src={mediaSrc} preload="metadata" style={{ display: 'none' }}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => { const a = videoRef.current; if (a) setMediaDuration(a.duration); }}
                  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => { const a = videoRef.current; if (a && a.error && a.error.code !== 0) setMediaError(true); }}
                />
              )}
              {!isVideo && (
                <div className="tv2-wave-vis" aria-hidden="true">
                  {waveBars.map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} className={i < Math.round(waveBars.length * pct / 100) ? 'played' : ''} />
                  ))}
                </div>
              )}
              <button className="tv2-speed-chip" title="Playback speed" onClick={e => { e.stopPropagation(); cycleSpeed(); }}>{rate.toFixed(2)}×</button>
              {mediaError && mediaSrc && <div className="tv2-audio-err"><Volume2 size={16}/><span>Audio unavailable</span></div>}
              {activeSegId && (() => {
                const seg = segments.find(s=>s.id===activeSegId);
                const sp = seg?.speaker_label||'Unknown';
                const idx = speakers.indexOf(sp);
                return (
                  <div className="tv2-spk-overlay">
                    <div className="tv2-spk-badge" style={{borderColor:SPEAKER_COLORS[idx%SPEAKER_COLORS.length]}}>
                      <span className="tv2-spk-dot" style={{background:SPEAKER_COLORS[idx%SPEAKER_COLORS.length]}}/>
                      {speakerName(sp)}
                    </div>
                  </div>
                );
              })()}
              <button className={`tv2-big-play${isPlaying?' playing':''}`} onClick={e=>{e.stopPropagation();const a=videoRef.current;if(!a)return;if(isPlaying){a.pause();}else{a.play().catch(()=>{});}}}>
                {isPlaying?<Pause size={24} strokeWidth={1.5}/>:<Play size={24} strokeWidth={1.5} style={{marginLeft:3}}/>}
              </button>
              {activeSegId && (() => {
                const seg = segments.find(s=>s.id===activeSegId);
                if (!seg) return null;
                return (
                  <div className="tv2-word-overlay">
                    {seg.word_timestamps?.length
                      ? seg.word_timestamps.map((w,i) => (
                          <span key={i} className={`tv2-overlay-word${activeWordKey===`${seg.id}-${i}`?' active':''}`}>{w.word}</span>
                        ))
                      : <span>{seg.text.split(' ').slice(0,8).join(' ')}…</span>
                    }
                  </div>
                );
              })()}
              <div className="tv2-speaker-timeline">
                {safeDur && segments.map(seg => {
                  const idx = speakers.indexOf(seg.speaker_label||'');
                  return (
                    <div key={seg.id} className="tv2-timeline-seg"
                      style={{left:`${(seg.start_time/safeDur)*100}%`,width:`${((seg.end_time-seg.start_time)/safeDur)*100}%`,backgroundColor:SPEAKER_COLORS[idx%SPEAKER_COLORS.length]}}
                      onClick={e=>{e.stopPropagation();seekTo(seg.start_time);}} title={speakerName(seg.speaker_label||'Unknown')}/>
                  );
                })}
                <div className="tv2-playhead" style={{left:`${pct}%`}}/>
              </div>
            </div>
            <div className="tv2-controls">
              <button className="tv2-ctrl-play" onClick={() => {const a=videoRef.current;if(!a)return;if(isPlaying){a.pause();}else{a.play().catch(()=>{});}}}>
                {isPlaying?<Pause size={12}/>:<Play size={12} style={{marginLeft:1}}/>}
              </button>
              <div className="tv2-progress" ref={progressRef} onClick={handleProgressClick}>
                <div className="tv2-progress-fill" style={{width:`${pct}%`}}/>
                <div className="tv2-progress-thumb" style={{left:`${pct}%`}}/>
              </div>
              <span className="tv2-time-label">{fmtTime(currentTime)}<span className="tv2-time-total"> / {dur!=null?fmtTime(dur):'--:--'}</span></span>
              <button className="tv2-ctrl-icon" title="Volume"><Volume2 size={12}/></button>
            </div>
          </div>

          {/* TRANSCRIPT */}
          <div className="tv2-transcript-card">
            <div className="tv2-transcript-header">
              <span className="tv2-transcript-title">Transcript{segments.length > 0 && <span className="tv2-seg-count">{segments.length}</span>}</span>
              <div className="tv2-transcript-tools">
                <button className="tv2-tool-btn" title="Mark useful"><ThumbsUp size={13}/></button>
                <button className="tv2-tool-btn" title="Mark not useful"><ThumbsDown size={13}/></button>
                <button className="tv2-tool-btn" title="More"><MoreHorizontal size={13}/></button>
              </div>
            </div>

            {isTranscribing ? (
              <div className="tv2-proc-state tv2-proc-card">
                <div className="tv2-proc-wave" aria-hidden="true">
                  {Array.from({length: 21}).map((_, i) => (
                    <span key={i} style={{ animationDelay: `${(i % 7) * 0.13}s`, animationDuration: `${0.9 + (i % 4) * 0.18}s` }} />
                  ))}
                </div>
                <p className="tv2-proc-title">{recording?.status === 'pending' ? 'Queued for transcription' : 'Transcribing…'}</p>
                <p className="tv2-proc-file">{recording?.filename}</p>
                <p className="tv2-proc-sub">
                  <span className="tv2-proc-timer">{fmtTime(elapsed)}</span> elapsed · this view updates automatically when done
                </p>
                <div className="tv2-proc-steps">
                  {PROC_STEPS.map((step, i) => (
                    <div key={step.label} className={`tv2-step ${i < activeStep ? 'done' : i === activeStep ? 'active' : 'muted'}`}>
                      {i < activeStep ? '✓' : i === activeStep ? <span className="tv2-pulse"/> : '·'} {step.label}
                    </div>
                  ))}
                </div>
                <p className="tv2-proc-hint">You can close this window — processing continues in the background.</p>
              </div>
            ) : recording?.status==='error' ? (
              <div className="tv2-err-inline">
                <div className="tv2-err-icon-wrap">✕</div>
                <p className="tv2-err-title">Transcription failed</p>
                <p className="tv2-err-body">{recording?.error_message || 'Common causes: missing HF_TOKEN, unsupported format, or OOM.'}</p>
                <button className="tv2-retry-btn" onClick={handleRetranscribe} disabled={retrying}>
                  {retrying?<Spinner size="sm"/>:'↺'} {retrying?'Queuing…':'Retry transcription'}
                </button>
              </div>
            ) : highlightedSegs.length===0 ? (
              <div className="tv2-empty-state">
                <FileText size={28} strokeWidth={1} style={{color:'var(--fg-muted)'}}/>
                <p>{highlightMode==='highlights'?'No highlights yet — tag segments to create highlights.':'No transcript segments found.'}</p>
              </div>
            ) : (
              <div className="tv2-doc">
                {highlightedSegs.map((seg) => {
                  const sp = seg.speaker_label||'Unknown';
                  const spIdx = speakers.indexOf(sp);
                  const color = SPEAKER_COLORS[spIdx%SPEAKER_COLORS.length];
                  const isActive = activeSegId===seg.id;
                  const segTags = getSegTags(seg.id);
                  // Compare against the previous segment in the FULL list so
                  // speaker headers stay correct when filtering to highlights.
                  const origIdx = segments.findIndex(s => s.id === seg.id);
                  const prevSeg = origIdx > 0 ? segments[origIdx - 1] : null;
                  const showHdr = !prevSeg || prevSeg.speaker_label !== seg.speaker_label;
                  return (
                    <div key={seg.id}>
                      {showHdr && (
                        <div className="tv2-speaker-header">
                          <div className="tv2-spk-avatar">S{spIdx+1}</div>
                          <span className="tv2-spk-name" style={{color}}>{speakerName(sp)}</span>
                          <button className="tv2-timestamp-btn" onClick={()=>seekTo(seg.start_time)}>
                            <Play size={8} style={{marginLeft:1}}/> {fmtTime(seg.start_time)}
                          </button>
                        </div>
                      )}
                      <div
                        ref={isActive?activeSegRef:null}
                        className={`tv2-seg${isActive?' active':''}`}
                        onClick={()=>{setActiveSegId(seg.id);seekTo(seg.start_time);}}
                        onMouseUp={()=>handleTextSelect(seg.id)}
                      >
                        {isActive && <div className="tv2-seg-accent" style={{background:color}}/>}
                        {segTags.length>0 && (
                          <div className="tv2-seg-markers">
                            {segTags.map(app=>(
                              <span key={app.id} className="tv2-seg-marker" style={{background:app.tag_color||'var(--accent)'}} title={app.tag_name}/>
                            ))}
                          </div>
                        )}
                        <p className="tv2-seg-text">
                          {seg.word_timestamps?.length
                            ? seg.word_timestamps.map((w,wi)=>(
                                <span key={wi}
                                  className={`tv2-word${activeWordKey===`${seg.id}-${wi}`?' active-word':''}`}
                                  onClick={e=>{e.stopPropagation();seekTo(w.start);}}>
                                  {w.word}{' '}
                                </span>
                              ))
                            : seg.text
                          }
                        </p>
                        <div className="tv2-seg-footer">
                          {!showHdr && (
                            <button className="tv2-timestamp-btn small" onClick={e=>{e.stopPropagation();seekTo(seg.start_time);}}>
                              <Play size={7} style={{marginLeft:1}}/> {fmtTime(seg.start_time)}
                            </button>
                          )}
                          {segTags.map(app=>(
                            <span key={app.id} className="tv2-tag-chip" style={{background:app.tag_color?`${app.tag_color}22`:'var(--bg-elevated)',borderColor:app.tag_color||'var(--border)',color:app.tag_color||'var(--fg-secondary)'}}>
                              <Hash size={9}/> {app.tag_name}
                              <button className="tv2-tag-remove" onClick={e=>{e.stopPropagation();handleRemoveTag(app.tag_id, app.segment_id);}}>×</button>
                            </span>
                          ))}
                          <button className="tv2-seg-tag-btn" onClick={e=>{e.stopPropagation();setTagPickerSegId(seg.id);setShowTagPicker(true);}}>
                            <Tag size={10}/> Tag
                          </button>
                        </div>
                        {showTagPicker && tagPickerSegId===seg.id && (
                          <div className="tv2-tag-picker" onClick={e=>e.stopPropagation()}>
                            <div className="tv2-tag-picker-header">Apply tag</div>
                            {projectTags.length===0
                              ? <p className="tv2-tag-picker-empty">No tags yet</p>
                              : projectTags.map(tag=>(
                                  <button key={tag.id} className="tv2-tag-option" onClick={()=>handleApplyTag(tag.id)} disabled={applyingTag}>
                                    <span className="tv2-tag-dot" style={{background:tag.color||'#888'}}/> {tag.name}
                                  </button>
                                ))
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </main>

        {/* SIDEBAR: panel + vertical icon rail */}
        <aside className="tv2-aside">
          <div className="tv2-aside-body">
            {rightTab==='summary' && <>
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><Users size={11}/> Participants</p>
                <p className="tv2-aside-value">{speakers.length} speaker{speakers.length!==1?'s':''} detected</p>
                <div className="tv2-spk-list">
                  {speakers.map((sp,i)=>(
                    <div key={sp} className="tv2-spk-row">
                      <div className="tv2-spk-avatar sm" style={{background:SPEAKER_BG[i%SPEAKER_BG.length],borderColor:SPEAKER_COLORS[i%SPEAKER_COLORS.length]}}>
                        <span style={{color:SPEAKER_COLORS[i%SPEAKER_COLORS.length]}}>{speakerName(sp).charAt(0)}</span>
                      </div>
                      <span className="tv2-spk-row-name">{speakerName(sp)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><Activity size={11}/> Coverage</p>
                <p className="tv2-aside-value">{segments.length} segments spanning {recording?.duration_seconds?fmtTime(recording.duration_seconds):'--:--'} of audio</p>
              </div>
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><BarChart2 size={11}/> Density</p>
                <p className="tv2-aside-value">Approximately {wordCount} words transcribed</p>
              </div>
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><Clock size={11}/> Recorded</p>
                <p className="tv2-aside-value">{recording?.created_at?fmtDate(recording.created_at):'—'}</p>
              </div>
            </>}
            {rightTab==='ai' && <>
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><Sparkles size={11}/> AI Tools</p>
                <button className="tv2-ai-tool-btn" disabled={suggesting}
                  onClick={async()=>{if(!projectId)return;setSuggesting(true);try{const seg=segments.find(s=>s.id===activeSegId)||segments[0];if(!seg)return;const data=await fetchApi(`/projects/${projectId}/tags/suggest`,{method:'POST',body:JSON.stringify({segment_id:seg.id})});setSuggestions(data.suggestions||[]);if(!data.suggestions?.length)toast('No suggestions','info');}catch(e:any){toast(e.message||'AI failed','error');}finally{setSuggesting(false);}}}>
                  {suggesting?<Spinner size="sm"/>:<Sparkles size={12}/>} Suggest tags for active segment
                </button>
              </div>
              {suggestions.length>0 && <div className="tv2-aside-section">
                <p className="tv2-aside-label">Suggestions</p>
                <div className="tv2-suggestions">
                  {suggestions.map((s:any)=>(
                    <div key={s.id} className="tv2-suggestion-row">
                      <span className="tv2-suggestion-name">{s.suggested_name}</span>
                      <button className="tv2-sugg-accept" onClick={async()=>{try{await fetchApi(`/tags/suggestions/${s.id}/accept`,{method:'POST'});setSuggestions(p=>p.filter(x=>x.id!==s.id));await loadTags();toast('Tag accepted','success');}catch{/**/}}}>
                        <Check size={11}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>}
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><MessageSquare size={11}/> Chat with this recording</p>
                <div className="tv2-chat-placeholder">
                  <Sparkles size={16} style={{color:'var(--accent)'}}/>
                  <span>Ask anything about this transcript…</span>
                  <input type="text" className="tv2-chat-input" placeholder="e.g. Summarize the key points"
                    onKeyDown={e=>{if(e.key==='Enter')toast('AI chat coming soon!','info');}}/>
                </div>
              </div>
            </>}
            {rightTab==='tags' && <>
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><Tag size={11}/> Project tags</p>
                {projectTags.length===0?<p className="tv2-aside-empty">No tags yet</p>:(
                  <div className="tv2-tag-list">
                    {projectTags.map(tag=>{const count=tagApps.filter(a=>a.tag_id===tag.id).length;return(
                      <div key={tag.id} className="tv2-tag-list-row">
                        <span className="tv2-tag-dot-lg" style={{background:tag.color||'#888'}}/>
                        <span className="tv2-tag-list-name">{tag.name}</span>
                        <span className="tv2-tag-list-count">{count}</span>
                      </div>
                    );})}
                  </div>
                )}
              </div>
              <div className="tv2-aside-section">
                <p className="tv2-aside-label"><Hash size={11}/> Applied ({tagApps.length})</p>
                {tagApps.length===0?<p className="tv2-aside-empty">No tags applied yet. Click "Tag" on any segment.</p>:(
                  <div className="tv2-applied-list">
                    {tagApps.slice(0,20).map(app=>{const seg=segments.find(s=>s.id===app.segment_id);return(
                      <div key={app.id} className="tv2-applied-row">
                        <span className="tv2-tag-chip sm" style={{background:app.tag_color?`${app.tag_color}22`:'var(--bg-elevated)',borderColor:app.tag_color||'var(--border)',color:app.tag_color||'var(--fg-secondary)'}}>{app.tag_name}</span>
                        <span className="tv2-applied-text">{seg?.text.slice(0,40)}…</span>
                      </div>
                    );})}
                  </div>
                )}
              </div>
            </>}
            {rightTab==='clips' && <div className="tv2-aside-section">
              <p className="tv2-aside-label"><Scissors size={11}/> Clips</p>
              <p className="tv2-aside-empty">Select text in the transcript to create clips.</p>
              <button className="tv2-ai-tool-btn" style={{marginTop:8}}><Scissors size={12}/> Create clip from current position</button>
            </div>}
          </div>
          <div className="tv2-rail">
            {([{id:'summary',icon:<BarChart2 size={16}/>,label:'Summary'},{id:'ai',icon:<Sparkles size={16}/>,label:'AI'},{id:'tags',icon:<Tag size={16}/>,label:'Tags'},{id:'clips',icon:<Scissors size={16}/>,label:'Clips'}] as const).map(tab=>(
              <button key={tab.id} className={`tv2-rail-btn${rightTab===tab.id?' active':''}`} title={tab.label} onClick={()=>setRightTab(tab.id)}>
                {tab.icon}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* FLOATING SELECTION TOOLBAR */}
      {selectionToolbar && (
        <div className="tv2-sel-toolbar" style={{left:selectionToolbar.x,top:selectionToolbar.y}} onMouseDown={e=>e.stopPropagation()}>
          <button className="tv2-sel-btn" onClick={()=>{setTagPickerSegId(selectionToolbar.segId);setShowTagPicker(true);setSelectionToolbar(null);}}><Tag size={11}/> Tag</button>
          <button className="tv2-sel-btn" onClick={()=>{toast('Highlight saved','success');setSelectionToolbar(null);}}><Bookmark size={11}/> Highlight</button>
          <button className="tv2-sel-btn" onClick={()=>{toast('Clip created','success');setSelectionToolbar(null);}}><Scissors size={11}/> Clip</button>
          <button className="tv2-sel-btn" onClick={()=>{navigator.clipboard.writeText(selectionToolbar.text);toast('Copied','info');setSelectionToolbar(null);}}>Copy</button>
        </div>
      )}
    </div>
    </>,
    document.body
  );
}
