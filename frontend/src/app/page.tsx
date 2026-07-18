import UploadForm from "@/components/UploadForm";

export default function HomePage() {
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
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 99,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-hover)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          <span>●</span> UXR Platform
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 800,
            margin: "0 0 12px",
            background: "linear-gradient(135deg, #e2e8f0 0%, #818cf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            lineHeight: 1.15,
          }}
        >
          AI-Native Research
          <br />
          Repository
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-muted)",
            margin: 0,
            maxWidth: 440,
          }}
        >
          Upload user interviews. Get automatic transcription, speaker
          diarization, and AI-powered tagging.
        </p>
      </div>

      {/* Upload form */}
      <UploadForm />

      {/* Footer note */}
      <p
        style={{
          marginTop: 32,
          fontSize: 12,
          color: "var(--text-subtle)",
          textAlign: "center",
        }}
      >
        Self-hosted · Open-source · Your data never leaves your server
      </p>
    </main>
  );
}
