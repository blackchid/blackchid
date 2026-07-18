"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRecording, Recording } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Segment {
  id: string;
  recording_id: string;
  start_time: number;
  end_time: number;
  speaker_label: string | null;
  text: string;
}

// ── Constants / helpers ───────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchTranscript(id: string): Promise<Segment[]> {
  const res = await fetch(`${API_BASE}/recordings/${id}/transcript`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch transcript");
  return res.json();
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const COLORS: Record<string, { dot: string; bg: string; border: string; activeBg: string }> = {
  SPEAKER_00: { dot: "#818cf8", bg: "rgba(99,102,241,0.06)",  border: "rgba(99,102,241,0.35)",  activeBg: "rgba(99,102,241,0.15)" },
  SPEAKER_01: { dot: "#34d399", bg: "rgba(34,211,165,0.06)",  border: "rgba(34,211,165,0.35)",  activeBg: "rgba(34,211,165,0.15)" },
  SPEAKER_02: { dot: "#fbbf24", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.35)",  activeBg: "rgba(251,191,36,0.15)" },
  SPEAKER_03: { dot: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.35)", activeBg: "rgba(248,113,113,0.15)" },
  SPEAKER_04: { dot: "#a78bfa", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.35)", activeBg: "rgba(167,139,250,0.15)" },
  UNKNOWN:    { dot: "#94a3b8", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.35)", activeBg: "rgba(100,116,139,0.15)" },
};

function c(label: string | null) {
  return COLORS[label ?? "UNKNOWN"] ?? COLORS.UNKNOWN;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TranscriptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Data
  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveReady, setWaveReady] = useState(false);
  const [waveError, setWaveError] = useState(false);

  // Refs
  const waveContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<any>(null);
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoScrollEnabled = useRef(true);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [rec, segs] = await Promise.all([
          getRecording(id),
          fetchTranscript(id),
        ]);
        setRecording(rec);
        setSegments(segs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load transcript");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── Init WaveSurfer after data loaded ─────────────────────────────────────
  useEffect(() => {
    if (!recording || !waveContainerRef.current) return;

    let ws: typeof wsRef.current;

    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (!waveContainerRef.current) return;

      ws = WaveSurfer.create({
        container: waveContainerRef.current,
        url: `${API_BASE}/recordings/${id}/audio`,
        waveColor: "#2a2a40",
        progressColor: "#6366f1",
        cursorColor: "#818cf8",
        cursorWidth: 2,
        height: 72,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        interact: true,
        fillParent: true,
      });

      ws.on("ready", () => {
        setDuration(ws.getDuration());
        setWaveReady(true);
      });

      ws.on("timeupdate", (time: number) => {
        setCurrentTime(time);
      });

      ws.on("play",  () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => { setIsPlaying(false); setCurrentTime(0); });
      ws.on("error",  () => setWaveError(true));

      wsRef.current = ws;
    });

    return () => {
      ws?.destroy();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // ── Auto-scroll active segment into view ──────────────────────────────────
  const activeSegId = segments.find(
    (s) => currentTime >= s.start_time && currentTime < s.end_time
  )?.id ?? null;

  useEffect(() => {
    if (!activeSegId || !autoScrollEnabled.current) return;
    const el = segmentRefs.current[activeSegId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSegId]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const seekTo = useCallback((startTime: number) => {
    if (!wsRef.current || duration === 0) return;
    wsRef.current.seekTo(startTime / duration);
    // Small delay so seek completes before we auto-scroll
    setTimeout(() => { autoScrollEnabled.current = true; }, 300);
  }, [duration]);

  // Keyboard shortcut: Space = play/pause
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const speakers = Array.from(new Set(segments.map((s) => s.speaker_label ?? "UNKNOWN")));

  const filtered = segments.filter((s) => {
    const q = search.toLowerCase();
    return (
      (!q || s.text.toLowerCase().includes(q)) &&
      (!activeSpeaker || (s.speaker_label ?? "UNKNOWN") === activeSpeaker)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <Spinner />;
  if (error)   return <ErrorScreen msg={error} onBack={() => router.push("/")} />;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0 20px",
        flexShrink: 0,
        zIndex: 20,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, height: 56 }}>
          <button
            id="back-btn"
            onClick={() => router.push(`/recordings/${id}`)}
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", padding: "6px 12px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}
          >
            ←
          </button>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {recording?.filename}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
              {segments.length} segments · {speakers.length} speaker{speakers.length !== 1 ? "s" : ""}
              {recording?.duration_seconds ? ` · ${fmt(recording.duration_seconds)}` : ""}
            </div>
          </div>

          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", background: "rgba(34,211,165,0.1)", border: "1px solid rgba(34,211,165,0.3)", borderRadius: 99, padding: "3px 10px", flexShrink: 0 }}>
            ✓ Done
          </span>
        </div>
      </header>

      {/* ══ WAVEFORM PLAYER ═════════════════════════════════════════════════ */}
      <div style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 20px",
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Waveform canvas */}
          <div
            ref={waveContainerRef}
            style={{
              width: "100%",
              borderRadius: 8,
              overflow: "hidden",
              cursor: "pointer",
              opacity: waveReady ? 1 : 0.4,
              transition: "opacity 0.3s",
            }}
          />

          {/* Controls row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            {/* Play/Pause */}
            <button
              id="play-pause-btn"
              onClick={togglePlay}
              disabled={!waveReady}
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                background: waveReady ? "var(--accent)" : "var(--border)",
                border: "none",
                color: "#fff",
                fontSize: 14,
                cursor: waveReady ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* Time */}
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            {/* Progress bar (clickable) */}
            <div
              style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 99, cursor: "pointer", position: "relative" }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                wsRef.current?.seekTo(Math.max(0, Math.min(1, ratio)));
              }}
            >
              <div style={{
                height: "100%",
                width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                background: "var(--accent)",
                borderRadius: 99,
                transition: "width 0.1s linear",
              }} />
            </div>

            {/* Status badge while loading */}
            {!waveReady && !waveError && (
              <span style={{ fontSize: 11, color: "var(--text-subtle)", flexShrink: 0 }}>
                Loading audio…
              </span>
            )}
            {waveError && (
              <span style={{ fontSize: 11, color: "var(--error)", flexShrink: 0 }}>
                Audio unavailable
              </span>
            )}

            {/* Space shortcut hint */}
            <kbd style={{
              fontSize: 10, color: "var(--text-subtle)",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 4, padding: "2px 6px", flexShrink: 0,
            }}>Space</kbd>
          </div>
        </div>
      </div>

      {/* ══ FILTER BAR ══════════════════════════════════════════════════════ */}
      <div style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        padding: "10px 20px",
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
            <input
              id="transcript-search"
              type="text"
              placeholder="Search transcript…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "7px 10px 7px 32px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Speaker filter chips */}
          {speakers.map((spk) => {
            const col = c(spk);
            const on = activeSpeaker === spk;
            return (
              <button
                key={spk}
                id={`spk-${spk}`}
                onClick={() => setActiveSpeaker(on ? null : spk)}
                style={{
                  background: on ? col.bg : "var(--surface)",
                  border: `1px solid ${on ? col.border : "var(--border)"}`,
                  borderRadius: 8, color: on ? col.dot : "var(--text-muted)",
                  padding: "6px 12px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.12s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot, display: "inline-block", flexShrink: 0 }} />
                {spk}
              </button>
            );
          })}

          {(search || activeSpeaker) && (
            <button
              id="clear-filters-btn"
              onClick={() => { setSearch(""); setActiveSpeaker(null); }}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-subtle)", padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
            >
              ✕
            </button>
          )}

          {(search || activeSpeaker) && (
            <span style={{ fontSize: 12, color: "var(--text-subtle)", marginLeft: "auto" }}>
              {filtered.length} / {segments.length}
            </span>
          )}
        </div>
      </div>

      {/* ══ TRANSCRIPT ══════════════════════════════════════════════════════ */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: "20px 20px 80px" }}
        onWheel={() => { autoScrollEnabled.current = false; }}
        onTouchMove={() => { autoScrollEnabled.current = false; }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-subtle)", fontSize: 14 }}>
              No segments match.
            </div>
          ) : (
            filtered.map((seg, idx) => {
              const col = c(seg.speaker_label);
              const prev = idx > 0 ? (filtered[idx - 1].speaker_label ?? "UNKNOWN") : null;
              const isNewSpeaker = (seg.speaker_label ?? "UNKNOWN") !== prev;
              const isActive = seg.id === activeSegId;

              return (
                <div key={seg.id}>
                  {/* Speaker label — only on speaker change */}
                  {isNewSpeaker && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: idx > 0 ? 22 : 4, marginBottom: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: col.dot, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                        {seg.speaker_label ?? "Unknown"}
                      </span>
                    </div>
                  )}

                  {/* Segment row */}
                  <div
                    id={`seg-${seg.id}`}
                    ref={(el) => { segmentRefs.current[seg.id] = el; }}
                    onClick={() => {
                      autoScrollEnabled.current = true;
                      seekTo(seg.start_time);
                    }}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "9px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: isActive ? col.activeBg : "transparent",
                      border: `1px solid ${isActive ? col.border : "transparent"}`,
                      transition: "all 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--surface)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Active indicator stripe */}
                    {isActive && (
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                        background: col.dot, borderRadius: "8px 0 0 8px",
                      }} />
                    )}

                    {/* Timestamp (clickable seek hint) */}
                    <span style={{
                      fontSize: 11,
                      color: isActive ? col.dot : "var(--text-subtle)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 40,
                      paddingTop: 3,
                      flexShrink: 0,
                      fontWeight: isActive ? 700 : 400,
                    }}>
                      {fmt(seg.start_time)}
                    </span>

                    {/* Text */}
                    <p style={{
                      margin: 0,
                      fontSize: 15,
                      color: isActive ? "var(--text)" : "var(--text-muted)",
                      lineHeight: 1.65,
                      flex: 1,
                      fontWeight: isActive ? 500 : 400,
                    }}>
                      {search ? highlight(seg.text, search) : seg.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: var(--surface-2); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function highlight(text: string, query: string) {
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
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
        <button onClick={onBack} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          ← Home
        </button>
      </div>
    </div>
  );
}
