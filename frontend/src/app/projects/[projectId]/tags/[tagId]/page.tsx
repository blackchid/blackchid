"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getProjectTags, Tag,
  getProjectRecordings, Recording,
  getSegmentsByTag, TranscriptSegment,
  removeTag,
} from "@/lib/api";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function TagFilteredPage() {
  const { projectId, tagId } = useParams<{ projectId: string; tagId: string }>();
  const router = useRouter();

  const [tag, setTag] = useState<Tag | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [tags, segs, recs] = await Promise.all([
          getProjectTags(projectId),
          getSegmentsByTag(projectId, tagId),
          getProjectRecordings(projectId),
        ]);
        const found = tags.find((t) => t.id === tagId) ?? null;
        setTag(found);
        setSegments(segs);
        setRecordings(recs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, tagId]);

  function recordingFor(seg: TranscriptSegment) {
    return recordings.find((r) => r.id === seg.recording_id);
  }

  async function handleRemove(segmentId: string) {
    if (busy) return;
    setBusy(true);
    setSegments((prev) => prev.filter((s) => s.id !== segmentId));
    try {
      await removeTag(tagId, segmentId);
    } catch {
      // Restore on failure
      const fresh = await getSegmentsByTag(projectId, tagId);
      setSegments(fresh);
    } finally {
      setBusy(false);
    }
  }

  const tagColor = tag?.color ?? "#6366f1";

  if (loading) return <Spinner />;
  if (error) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <p style={{ color: "var(--error)" }}>{error}</p>
    </div>
  );

  // Group segments by recording
  const byRecording = recordings
    .map((rec) => ({ rec, segs: segments.filter((s) => s.recording_id === rec.id) }))
    .filter(({ segs }) => segs.length > 0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, height: 60 }}>
          <button onClick={() => router.push(`/projects/${projectId}/tags`)}
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>←</button>

          {/* Tag badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: tagColor, display: "inline-block" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{tag?.name ?? tagId}</span>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 99,
              background: `${tagColor}22`, border: `1px solid ${tagColor}55`, color: tagColor,
            }}>
              {segments.length} segment{segments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 80px" }}>

        {segments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-subtle)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏷</div>
            <p style={{ fontSize: 15 }}>No segments tagged with <strong>{tag?.name}</strong> yet.</p>
            <p style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 8 }}>
              Open a transcript, click a segment, and apply this tag from the sidebar.
            </p>
          </div>
        ) : (
          byRecording.map(({ rec, segs }) => (
            <section key={rec.id} style={{ marginBottom: 36 }}>
              {/* Recording header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>🎤</span>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {rec.filename}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                    {segs.length} tagged segment{segs.length !== 1 ? "s" : ""}
                    {rec.duration_seconds ? ` · ${fmt(rec.duration_seconds)}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/recordings/${rec.id}/transcript`)}
                  style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--accent-hover)", padding: "5px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                  Open →
                </button>
              </div>

              {/* Segments */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {segs.map((seg) => (
                  <div key={seg.id}
                    style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", transition: "border-color 0.12s", cursor: "pointer" }}
                    onClick={() => router.push(`/recordings/${rec.id}/transcript`)}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = tagColor)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    {/* Colored left strip */}
                    <div style={{ width: 3, borderRadius: 99, background: tagColor, flexShrink: 0 }} />

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--text-subtle)", fontVariantNumeric: "tabular-nums" }}>{fmt(seg.start_time)} → {fmt(seg.end_time)}</span>
                        {seg.speaker_label && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-subtle)", background: "var(--surface-2)", padding: "1px 7px", borderRadius: 99 }}>
                            {seg.speaker_label}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>{seg.text}</p>
                    </div>

                    {/* Remove tag button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(seg.id); }}
                      title="Remove tag from this segment"
                      style={{ background: "transparent", border: "none", color: "var(--text-subtle)", fontSize: 16, cursor: "pointer", flexShrink: 0, alignSelf: "flex-start", padding: "0 4px", opacity: 0.5 }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                    >×</button>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
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
