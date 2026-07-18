"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRecording, getRecording as fetchRecording, Recording } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Segment {
  id: string;
  recording_id: string;
  start_time: number;
  end_time: number;
  speaker_label: string | null;
  text: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchTranscript(recordingId: string): Promise<Segment[]> {
  const res = await fetch(`${API_BASE}/recordings/${recordingId}/transcript`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch transcript");
  return res.json();
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Stable, deterministic colour per speaker label
const SPEAKER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SPEAKER_00: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.5)", text: "#818cf8" },
  SPEAKER_01: { bg: "rgba(34,211,165,0.1)",  border: "rgba(34,211,165,0.5)", text: "#34d399" },
  SPEAKER_02: { bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.5)", text: "#fbbf24" },
  SPEAKER_03: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.5)", text: "#f87171" },
  SPEAKER_04: { bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.5)", text: "#a78bfa" },
  UNKNOWN:    { bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.5)", text: "#94a3b8" },
};
function speakerColor(label: string | null) {
  const key = label ?? "UNKNOWN";
  return SPEAKER_COLORS[key] ?? SPEAKER_COLORS.UNKNOWN;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TranscriptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [rec, segs] = await Promise.all([
          fetchRecording(id),
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

  // Unique speakers
  const speakers = Array.from(
    new Set(segments.map((s) => s.speaker_label ?? "UNKNOWN"))
  );

  // Filtered segments
  const filtered = segments.filter((s) => {
    const matchSearch =
      !search || s.text.toLowerCase().includes(search.toLowerCase());
    const matchSpeaker =
      !activeSpeaker || (s.speaker_label ?? "UNKNOWN") === activeSpeaker;
    return matchSearch && matchSpeaker;
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onBack={() => router.push("/")} />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* ── Header ── */}
      <header style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, height: 60 }}>
          <button
            id="back-to-status-btn"
            onClick={() => router.push(`/recordings/${id}`)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 7,
              color: "var(--text-muted)",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ←
          </button>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {recording?.filename ?? "Transcript"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
              {segments.length} segments · {speakers.length} speaker{speakers.length !== 1 ? "s" : ""}
              {recording?.duration_seconds && ` · ${Math.round(recording.duration_seconds / 60)} min`}
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(34,211,165,0.1)",
              border: "1px solid rgba(34,211,165,0.4)",
              borderRadius: 99,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--success)",
              flexShrink: 0,
            }}
          >
            ✓ Done
          </div>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 860, margin: "0 auto", width: "100%", padding: "24px 24px 64px" }}>
        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", fontSize: 14 }}>🔍</span>
            <input
              id="transcript-search"
              type="text"
              placeholder="Search transcript…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 9,
                color: "var(--text)",
                padding: "9px 12px 9px 36px",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Speaker filters */}
          {speakers.map((spk) => {
            const c = speakerColor(spk);
            const active = activeSpeaker === spk;
            return (
              <button
                key={spk}
                id={`speaker-filter-${spk}`}
                onClick={() => setActiveSpeaker(active ? null : spk)}
                style={{
                  background: active ? c.bg : "var(--surface)",
                  border: `1px solid ${active ? c.border : "var(--border)"}`,
                  borderRadius: 9,
                  color: active ? c.text : "var(--text-muted)",
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {spk}
              </button>
            );
          })}

          {(search || activeSpeaker) && (
            <button
              id="clear-filters-btn"
              onClick={() => { setSearch(""); setActiveSpeaker(null); }}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 9,
                color: "var(--text-subtle)",
                padding: "8px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── Segment count ── */}
        {(search || activeSpeaker) && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Showing {filtered.length} of {segments.length} segments
          </div>
        )}

        {/* ── Segments ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-subtle)", fontSize: 14 }}>
              No segments match your search.
            </div>
          ) : (
            filtered.map((seg, idx) => {
              const c = speakerColor(seg.speaker_label);
              const prevSpeaker = idx > 0 ? (filtered[idx - 1].speaker_label ?? "UNKNOWN") : null;
              const isNewSpeaker = (seg.speaker_label ?? "UNKNOWN") !== prevSpeaker;

              return (
                <div key={seg.id}>
                  {/* Speaker header — only shown when speaker changes */}
                  {isNewSpeaker && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: idx > 0 ? 20 : 0, marginBottom: 6 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: c.text, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {seg.speaker_label ?? "Unknown"}
                      </span>
                    </div>
                  )}

                  {/* Segment row */}
                  <div
                    id={`seg-${seg.id}`}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 8,
                      transition: "background 0.1s",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Timestamp */}
                    <span style={{
                      fontSize: 12,
                      color: "var(--text-subtle)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 44,
                      paddingTop: 2,
                      flexShrink: 0,
                    }}>
                      {formatTime(seg.start_time)}
                    </span>

                    {/* Text */}
                    <p style={{
                      margin: 0,
                      fontSize: 15,
                      color: "var(--text)",
                      lineHeight: 1.65,
                      flex: 1,
                    }}>
                      {search
                        ? highlightMatch(seg.text, search)
                        : seg.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} style={{ background: "rgba(99,102,241,0.35)", color: "var(--text)", borderRadius: 3 }}>
        {part}
      </mark>
    ) : part
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading transcript…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: "var(--error)", marginBottom: 8 }}>Failed to load</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>{message}</p>
        <button onClick={onBack} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          ← Go Home
        </button>
      </div>
    </div>
  );
}
