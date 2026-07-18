"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getRecording, Recording,
  getProjectTags, Tag,
  getRecordingTagApplications, TagApplication,
  createTag, applyTag, removeTag,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Segment {
  id: string;
  recording_id: string;
  start_time: number;
  end_time: number;
  speaker_label: string | null;
  text: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchTranscript(id: string): Promise<Segment[]> {
  const res = await fetch(`${API_BASE}/recordings/${id}/transcript`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch transcript");
  return res.json();
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const SPEAKER_PALETTE: Record<string, { dot: string; activeBg: string; border: string }> = {
  SPEAKER_00: { dot: "#818cf8", activeBg: "rgba(99,102,241,0.14)", border: "rgba(99,102,241,0.4)" },
  SPEAKER_01: { dot: "#34d399", activeBg: "rgba(34,211,165,0.12)", border: "rgba(34,211,165,0.4)" },
  SPEAKER_02: { dot: "#fbbf24", activeBg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.4)" },
  SPEAKER_03: { dot: "#f87171", activeBg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.4)" },
  SPEAKER_04: { dot: "#a78bfa", activeBg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.4)" },
  UNKNOWN:    { dot: "#94a3b8", activeBg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.4)" },
};
function sc(label: string | null) {
  return SPEAKER_PALETTE[label ?? "UNKNOWN"] ?? SPEAKER_PALETTE.UNKNOWN;
}

// Tag colour presets
const TAG_PRESETS = [
  "#6366f1", "#34d399", "#fbbf24", "#f87171",
  "#a78bfa", "#38bdf8", "#fb923c", "#e879f9",
];

// ── Main component ────────────────────────────────────────────────────────────
export default function TranscriptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Data
  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectTags, setProjectTags] = useState<Tag[]>([]);
  const [applications, setApplications] = useState<TagApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveReady, setWaveReady] = useState(false);
  const [waveError, setWaveError] = useState(false);

  // Tagging
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  const [tagBusy, setTagBusy] = useState(false);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_PRESETS[0]);

  const waveContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<any>(null);
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoScroll = useRef(true);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [rec, segs, apps] = await Promise.all([
          getRecording(id),
          fetchTranscript(id),
          getRecordingTagApplications(id),
        ]);
        setRecording(rec);
        setSegments(segs);
        setApplications(apps);
        const tags = await getProjectTags(rec.project_id);
        setProjectTags(tags);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── WaveSurfer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recording || !waveContainerRef.current) return;
    let ws: typeof wsRef.current;
    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (!waveContainerRef.current) return;
      ws = WaveSurfer.create({
        container: waveContainerRef.current,
        url: `${API_BASE}/recordings/${id}/audio`,
        waveColor: "#2a2a40", progressColor: "#6366f1",
        cursorColor: "#818cf8", cursorWidth: 2,
        height: 68, barWidth: 2, barGap: 1, barRadius: 2,
        normalize: true, interact: true, fillParent: true,
      });
      ws.on("ready", () => { setDuration(ws.getDuration()); setWaveReady(true); });
      ws.on("timeupdate", (t: number) => setCurrentTime(t));
      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => { setIsPlaying(false); setCurrentTime(0); });
      ws.on("error", () => setWaveError(true));
      wsRef.current = ws;
    });
    return () => { ws?.destroy(); wsRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // ── Active segment auto-scroll ─────────────────────────────────────────────
  const activeSegId = segments.find(
    (s) => currentTime >= s.start_time && currentTime < s.end_time
  )?.id ?? null;

  useEffect(() => {
    if (!activeSegId || !autoScroll.current) return;
    segmentRefs.current[activeSegId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSegId]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => wsRef.current?.playPause(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault(); togglePlay();
      }
      if (e.code === "Escape") setSelectedSegId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // ── Tag operations (optimistic updates) ───────────────────────────────────
  async function handleApplyTag(tag: Tag) {
    if (!selectedSegId || tagBusy) return;
    const alreadyApplied = applications.some(
      (a) => a.tag_id === tag.id && a.segment_id === selectedSegId
    );
    if (alreadyApplied) return;
    setTagBusy(true);
    try {
      const app = await applyTag(tag.id, selectedSegId);
      // The API returns TagApplicationResponse; we convert to TagApplication
      setApplications((prev) => [
        ...prev,
        { id: app.id, segment_id: selectedSegId, tag_id: tag.id, tag_name: tag.name, tag_color: tag.color, note: app.note ?? null },
      ]);
    } catch (e) {
      console.error("Failed to apply tag", e);
    } finally {
      setTagBusy(false);
    }
  }

  async function handleRemoveTag(tagId: string, segmentId: string) {
    if (tagBusy) return;
    setTagBusy(true);
    // Optimistic remove
    setApplications((prev) =>
      prev.filter((a) => !(a.tag_id === tagId && a.segment_id === segmentId))
    );
    try {
      await removeTag(tagId, segmentId);
    } catch (e) {
      console.error("Failed to remove tag", e);
      // Rollback: re-fetch
      const fresh = await getRecordingTagApplications(id);
      setApplications(fresh);
    } finally {
      setTagBusy(false);
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim() || !recording || tagBusy) return;
    setTagBusy(true);
    try {
      const tag = await createTag(recording.project_id, newTagName.trim(), newTagColor);
      setProjectTags((prev) => [...prev, tag]);
      setNewTagName("");
      setShowNewTagForm(false);
      // Auto-apply the new tag to the selected segment
      if (selectedSegId) await handleApplyTag(tag);
    } catch (e) {
      console.error("Failed to create tag", e);
    } finally {
      setTagBusy(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const speakers = Array.from(new Set(segments.map((s) => s.speaker_label ?? "UNKNOWN")));

  const filtered = segments.filter((s) => {
    const q = search.toLowerCase();
    return (
      (!q || s.text.toLowerCase().includes(q)) &&
      (!speakerFilter || (s.speaker_label ?? "UNKNOWN") === speakerFilter)
    );
  });

  const selectedSeg = segments.find((s) => s.id === selectedSegId) ?? null;

  function appsForSeg(segId: string) {
    return applications.filter((a) => a.segment_id === segId);
  }

  function unappliedTags(segId: string) {
    const applied = new Set(applications.filter((a) => a.segment_id === segId).map((a) => a.tag_id));
    return projectTags.filter((t) => !applied.has(t.id));
  }

  if (loading) return <Spinner />;
  if (error)   return <ErrorScreen msg={error} onBack={() => router.push("/")} />;

  const sidebarOpen = selectedSegId !== null;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 20px", flexShrink: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, height: 56 }}>
          <button id="back-btn" onClick={() => router.push(`/recordings/${id}`)}
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", padding: "6px 12px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recording?.filename}</div>
            <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
              {segments.length} segments · {speakers.length} speaker{speakers.length !== 1 ? "s" : ""}
              {recording?.duration_seconds ? ` · ${fmt(recording.duration_seconds)}` : ""}
            </div>
          </div>
          {/* Tag view link */}
          {projectTags.length > 0 && (
            <button
              id="tag-view-btn"
              onClick={() => recording && router.push(`/projects/${recording.project_id}/tags`)}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", padding: "6px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
            >
              🏷 Tags
            </button>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", background: "rgba(34,211,165,0.1)", border: "1px solid rgba(34,211,165,0.3)", borderRadius: 99, padding: "3px 10px", flexShrink: 0 }}>
            ✓ Done
          </span>
        </div>
      </header>

      {/* ── WAVEFORM ── */}
      <div style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", padding: "12px 20px", flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div ref={waveContainerRef} style={{ width: "100%", borderRadius: 8, overflow: "hidden", cursor: "pointer", opacity: waveReady ? 1 : 0.4, transition: "opacity 0.3s" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <button id="play-pause-btn" onClick={togglePlay} disabled={!waveReady}
              style={{ width: 34, height: 34, borderRadius: "50%", background: waveReady ? "var(--accent)" : "var(--border)", border: "none", color: "#fff", fontSize: 13, cursor: waveReady ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(currentTime)} / {fmt(duration)}</span>
            <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 99, cursor: "pointer" }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); wsRef.current?.seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}>
              <div style={{ height: "100%", width: duration ? `${(currentTime / duration) * 100}%` : "0%", background: "var(--accent)", borderRadius: 99, transition: "width 0.1s linear" }} />
            </div>
            {!waveReady && !waveError && <span style={{ fontSize: 11, color: "var(--text-subtle)", flexShrink: 0 }}>Loading waveform…</span>}
            {waveError && <span style={{ fontSize: 11, color: "var(--error)", flexShrink: 0 }}>Audio unavailable</span>}
            <kbd style={{ fontSize: 10, color: "var(--text-subtle)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>Space</kbd>
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "10px 20px", flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 180px" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
            <input id="transcript-search" type="text" placeholder="Search transcript…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "7px 10px 7px 32px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          {speakers.map((spk) => {
            const col = sc(spk); const on = speakerFilter === spk;
            return (
              <button key={spk} id={`spk-${spk}`} onClick={() => setSpeakerFilter(on ? null : spk)}
                style={{ background: on ? col.activeBg : "var(--surface)", border: `1px solid ${on ? col.border : "var(--border)"}`, borderRadius: 8, color: on ? col.dot : "var(--text-muted)", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot, display: "inline-block" }} />
                {spk}
              </button>
            );
          })}
          {(search || speakerFilter) && (
            <button id="clear-filters" onClick={() => { setSearch(""); setSpeakerFilter(null); }}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-subtle)", padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>✕</button>
          )}
          {sidebarOpen && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--accent-hover)", fontWeight: 500 }}>
              ← click to tag
            </span>
          )}
        </div>
      </div>

      {/* ── BODY: transcript + tag sidebar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Transcript list */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: "20px 20px 80px" }}
          onWheel={() => { autoScroll.current = false; }}
        >
          <div style={{ maxWidth: sidebarOpen ? "100%" : 900, margin: "0 auto" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-subtle)", fontSize: 14 }}>No segments match.</div>
            ) : (
              filtered.map((seg, idx) => {
                const col = sc(seg.speaker_label);
                const prev = idx > 0 ? (filtered[idx - 1].speaker_label ?? "UNKNOWN") : null;
                const isNewSpk = (seg.speaker_label ?? "UNKNOWN") !== prev;
                const isActive = seg.id === activeSegId;
                const isSelected = seg.id === selectedSegId;
                const segApps = appsForSeg(seg.id);

                return (
                  <div key={seg.id}>
                    {isNewSpk && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: idx > 0 ? 20 : 4, marginBottom: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: col.dot, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                          {seg.speaker_label ?? "Unknown"}
                        </span>
                      </div>
                    )}

                    <div
                      id={`seg-${seg.id}`}
                      ref={(el) => { segmentRefs.current[seg.id] = el; }}
                      onClick={() => {
                        // Left-click: seek + select
                        autoScroll.current = true;
                        if (duration > 0) wsRef.current?.seekTo(seg.start_time / duration);
                        setSelectedSegId((prev) => prev === seg.id ? null : seg.id);
                      }}
                      style={{
                        display: "flex", gap: 12, padding: "9px 12px", borderRadius: 8,
                        cursor: "pointer",
                        background: isSelected
                          ? "var(--surface-2)"
                          : isActive ? col.activeBg : "transparent",
                        border: `1px solid ${isSelected ? "var(--accent)" : isActive ? col.border : "transparent"}`,
                        transition: "all 0.12s",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => { if (!isSelected && !isActive) e.currentTarget.style.background = "var(--surface)"; }}
                      onMouseLeave={(e) => { if (!isSelected && !isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Active stripe */}
                      {isActive && !isSelected && (
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: col.dot, borderRadius: "8px 0 0 8px" }} />
                      )}
                      {/* Selected stripe */}
                      {isSelected && (
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--accent)", borderRadius: "8px 0 0 8px" }} />
                      )}

                      <span style={{ fontSize: 11, color: isActive ? col.dot : "var(--text-subtle)", fontVariantNumeric: "tabular-nums", minWidth: 40, paddingTop: 3, flexShrink: 0, fontWeight: isActive ? 700 : 400 }}>
                        {fmt(seg.start_time)}
                      </span>

                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 15, color: isActive ? "var(--text)" : "var(--text-muted)", lineHeight: 1.65, fontWeight: isActive ? 500 : 400 }}>
                          {search ? highlight(seg.text, search) : seg.text}
                        </p>
                        {/* Tag chips inline */}
                        {segApps.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                            {segApps.map((app) => (
                              <span
                                key={app.tag_id}
                                onClick={(e) => { e.stopPropagation(); handleRemoveTag(app.tag_id, seg.id); }}
                                title="Click to remove"
                                style={{
                                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                                  background: app.tag_color ? `${app.tag_color}22` : "rgba(99,102,241,0.15)",
                                  border: `1px solid ${app.tag_color ?? "#6366f1"}55`,
                                  color: app.tag_color ?? "#818cf8",
                                  cursor: "pointer", transition: "opacity 0.1s",
                                }}
                              >
                                {app.tag_name} ×
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── TAG SIDEBAR ── */}
        {sidebarOpen && (
          <aside style={{
            width: 280, flexShrink: 0,
            background: "var(--surface)",
            borderLeft: "1px solid var(--border)",
            overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            {/* Sidebar header */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Tag Segment</span>
              <button onClick={() => setSelectedSegId(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>
                ×
              </button>
            </div>

            {/* Selected segment preview */}
            {selectedSeg && (
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div style={{ fontSize: 11, color: "var(--text-subtle)", marginBottom: 4 }}>
                  {selectedSeg.speaker_label ?? "Unknown"} · {fmt(selectedSeg.start_time)}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {selectedSeg.text}
                </p>
              </div>
            )}

            <div style={{ flex: 1, padding: "14px 16px", overflowY: "auto" }}>
              {/* Applied tags */}
              {selectedSegId && appsForSeg(selectedSegId).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Applied</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {appsForSeg(selectedSegId).map((app) => (
                      <div key={app.tag_id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 99, background: `${app.tag_color ?? "#6366f1"}22`, border: `1px solid ${app.tag_color ?? "#6366f1"}55` }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: app.tag_color ?? "#818cf8" }}>{app.tag_name}</span>
                        <button onClick={() => handleRemoveTag(app.tag_id, selectedSegId!)}
                          style={{ background: "transparent", border: "none", color: app.tag_color ?? "#818cf8", fontSize: 13, cursor: "pointer", padding: "0 2px", lineHeight: 1, opacity: 0.7 }}>×</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Available tags */}
              {selectedSegId && unappliedTags(selectedSegId).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Add Tag</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                    {unappliedTags(selectedSegId).map((tag) => (
                      <button key={tag.id} id={`apply-tag-${tag.id}`}
                        onClick={() => handleApplyTag(tag)} disabled={tagBusy}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", textAlign: "left", transition: "border-color 0.12s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = tag.color ?? "var(--accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: tag.color ?? "#6366f1", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{tag.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Create new tag */}
              {!showNewTagForm ? (
                <button id="new-tag-btn" onClick={() => setShowNewTagForm(true)}
                  style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "1px dashed var(--border)", borderRadius: 8, color: "var(--accent-hover)", fontSize: 13, cursor: "pointer", transition: "border-color 0.12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                  + New tag
                </button>
              ) : (
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Create Tag</div>

                  {/* Name */}
                  <input id="new-tag-name" autoFocus type="text" placeholder="Tag name…" value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); if (e.key === "Escape") setShowNewTagForm(false); }}
                    style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />

                  {/* Color swatches */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {TAG_PRESETS.map((c) => (
                      <button key={c} onClick={() => setNewTagColor(c)}
                        style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: newTagColor === c ? "2px solid white" : "2px solid transparent", outline: newTagColor === c ? `2px solid ${c}` : "none", cursor: "pointer", padding: 0 }} />
                    ))}
                  </div>

                  {/* Preview */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>Preview:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 99, background: `${newTagColor}22`, border: `1px solid ${newTagColor}55`, color: newTagColor }}>
                      {newTagName || "tag name"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button id="create-tag-btn" onClick={handleCreateTag} disabled={!newTagName.trim() || tagBusy}
                      style={{ flex: 1, padding: "8px", background: "var(--accent)", border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 600, cursor: newTagName.trim() ? "pointer" : "default", opacity: newTagName.trim() ? 1 : 0.5 }}>
                      Create &amp; apply
                    </button>
                    <button onClick={() => setShowNewTagForm(false)}
                      style={{ padding: "8px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function highlight(text: string, query: string) {
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safe})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: "rgba(99,102,241,0.35)", color: "var(--text)", borderRadius: 3 }}>{p}</mark>
      : p
  );
}

function Spinner() {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div>
        <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>Loading…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorScreen({ msg, onBack }: { msg: string; onBack: () => void }) {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
        <h2 style={{ color: "var(--error)", marginBottom: 8, fontSize: 18 }}>Failed to load</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 22, fontSize: 14 }}>{msg}</p>
        <button onClick={onBack} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>← Home</button>
      </div>
    </div>
  );
}
