"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRecording, Recording } from "@/lib/api";

const STATUS_CONFIG = {
  pending: {
    icon: "⏳",
    label: "Queued",
    description: "Your file is in the transcription queue.",
    color: "var(--warning)",
    pulse: true,
  },
  processing: {
    icon: "🧠",
    label: "Transcribing",
    description:
      "WhisperX is running — transcription, alignment, and speaker diarization in progress.",
    color: "var(--accent-hover)",
    pulse: true,
  },
  done: {
    icon: "✅",
    label: "Ready",
    description: "Transcription complete! Your recording is ready to review.",
    color: "var(--success)",
    pulse: false,
  },
  error: {
    icon: "❌",
    label: "Failed",
    description:
      "Something went wrong during transcription. Check backend logs.",
    color: "var(--error)",
    pulse: false,
  },
} as const;

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES = new Set(["done", "error"]);

export default function RecordingStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling loop
  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await getRecording(id);
        if (!active) return;
        setRecording(data);
        if (TERMINAL_STATUSES.has(data.status)) {
          clearInterval(intervalRef.current!);
          clearInterval(timerRef.current!);
        }
      } catch (e) {
        if (!active) return;
        setFetchError(e instanceof Error ? e.message : "Network error");
        clearInterval(intervalRef.current!);
      }
    }

    // Initial fetch immediately
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Elapsed seconds timer
    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    return () => {
      active = false;
      clearInterval(intervalRef.current!);
      clearInterval(timerRef.current!);
    };
  }, [id]);

  const status = recording?.status ?? "pending";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  function formatElapsed(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 70%)",
      }}
    >
      {/* Brand / back */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <button
          id="back-btn"
          onClick={() => router.push("/")}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-muted)",
            padding: "8px 14px",
            fontSize: 13,
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "var(--accent)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--border)")
          }
        >
          ← Back
        </button>
      </div>

      {/* Status card */}
      <div
        style={{
          background: "var(--surface)",
          border: `1px solid var(--border)`,
          borderRadius: 20,
          padding: 40,
          width: "100%",
          maxWidth: 500,
          textAlign: "center",
        }}
      >
        {fetchError ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--error)", marginBottom: 8 }}>
              Connection Error
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
              {fetchError}
            </p>
            <button
              id="retry-btn"
              onClick={() => window.location.reload()}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </>
        ) : (
          <>
            {/* Animated status icon */}
            <div
              style={{
                position: "relative",
                display: "inline-block",
                marginBottom: 24,
              }}
            >
              {cfg.pulse && (
                <div
                  style={{
                    position: "absolute",
                    inset: -12,
                    borderRadius: "50%",
                    background: cfg.color,
                    opacity: 0.15,
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
              )}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "var(--surface-2)",
                  border: `2px solid ${cfg.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  position: "relative",
                }}
              >
                {cfg.icon}
              </div>
            </div>

            {/* Status label */}
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 99,
                background: `${cfg.color}1a`,
                border: `1px solid ${cfg.color}55`,
                color: cfg.color,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              {cfg.label}
            </div>

            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text)",
                margin: "0 0 8px",
              }}
            >
              {recording?.filename ?? "Loading…"}
            </h2>

            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                margin: "0 0 28px",
                lineHeight: 1.6,
              }}
            >
              {cfg.description}
            </p>

            {/* Metadata grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: recording?.status === "done" ? 28 : 0,
              }}
            >
              <Stat label="Recording ID" value={id.slice(0, 8) + "…"} />
              <Stat label="Elapsed" value={formatElapsed(elapsed)} />
              {recording?.duration_seconds && (
                <Stat
                  label="Duration"
                  value={`${recording.duration_seconds.toFixed(1)}s`}
                />
              )}
              <Stat label="Status" value={status} highlight={cfg.color} />
            </div>

            {/* Progress bar for active states */}
            {cfg.pulse && (
              <div
                style={{
                  marginTop: 24,
                  height: 3,
                  background: "var(--surface-2)",
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: "40%",
                    background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
                    borderRadius: 99,
                    animation: "shimmer 1.8s ease-in-out infinite",
                  }}
                />
              </div>
            )}

            {/* CTA when done */}
            {recording?.status === "done" && (
              <button
                id="view-transcript-btn"
                onClick={() => router.push(`/recordings/${id}/transcript`)}
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "13px 24px",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--accent-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--accent)")
                }
              >
                View Transcript →
              </button>
            )}

            {recording?.status === "error" && (
              <button
                id="upload-again-btn"
                onClick={() => router.push("/")}
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "12px 24px",
                  background: "transparent",
                  color: "var(--error)",
                  border: "1px solid var(--error)",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ← Try Again
              </button>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.4); opacity: 0.06; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-250%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-subtle)",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: highlight ?? "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
