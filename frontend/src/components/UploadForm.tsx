"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createProject, getProjects, uploadRecording, Project } from "@/lib/api";

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects on first interaction
  async function loadProjects() {
    if (projectsLoaded) return;
    try {
      const data = await getProjects();
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(data[0].id);
    } catch {
      setError("Could not load projects from API. Is the backend running?");
    }
    setProjectsLoaded(true);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }
  function handleDragLeave() { setDragging(false); }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    try {
      const proj = await createProject(newProjectName.trim());
      setProjects((prev) => [...prev, proj]);
      setSelectedProjectId(proj.id);
      setNewProjectName("");
      setShowNewProject(false);
    } catch {
      setError("Failed to create project.");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!file) { setError("Please select an audio file."); return; }
    if (!selectedProjectId) { setError("Please select or create a project."); return; }

    setUploading(true);
    try {
      const recording = await uploadRecording(selectedProjectId, file);
      router.push(`/recordings/${recording.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  }

  const ACCEPTED = "audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,audio/webm,.mp3,.mp4,.wav,.ogg,.flac,.m4a";

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: 32,
      width: "100%",
      maxWidth: 560,
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px", color: "var(--text)" }}>
        New Recording
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        Upload an audio interview and we'll automatically transcribe and diarize it.
      </p>

      {/* ── Project selector ─────────────────────────────── */}
      <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
        Project
      </label>
      {!showNewProject ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <select
            id="project-select"
            value={selectedProjectId}
            onFocus={loadProjects}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              flex: 1,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              padding: "10px 12px",
              fontSize: 14,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">— Select a project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            id="new-project-btn"
            onClick={() => { setShowNewProject(true); loadProjects(); }}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--accent-hover)",
              padding: "10px 14px",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            + New
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            id="project-name-input"
            autoFocus
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") setShowNewProject(false); }}
            placeholder="Project name…"
            style={{
              flex: 1,
              background: "var(--surface-2)",
              border: "1px solid var(--accent)",
              borderRadius: 8,
              color: "var(--text)",
              padding: "10px 12px",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            id="create-project-btn"
            onClick={handleCreateProject}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create
          </button>
          <button
            id="cancel-project-btn"
            onClick={() => setShowNewProject(false)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-muted)",
              padding: "10px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Drag-and-drop zone ────────────────────────────── */}
      <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
        Audio File
      </label>
      <div
        id="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : file ? "var(--success)" : "var(--border)"}`,
          borderRadius: 12,
          padding: "32px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(99,102,241,0.05)" : file ? "rgba(34,211,165,0.04)" : "var(--surface-2)",
          transition: "all 0.2s",
          marginBottom: 20,
        }}
      >
        <input ref={fileInputRef} type="file" accept={ACCEPTED} style={{ display: "none" }} onChange={handleFileChange} id="file-input" />
        {file ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>{file.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎤</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
              {dragging ? "Drop it!" : "Drop audio here or click to browse"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 6 }}>
              MP3, WAV, MP4, M4A, FLAC, OGG
            </div>
          </>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: "rgba(248,113,113,0.1)",
          border: "1px solid var(--error)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--error)",
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────── */}
      <button
        id="upload-btn"
        onClick={handleSubmit}
        disabled={uploading}
        style={{
          width: "100%",
          padding: "13px 24px",
          background: uploading ? "var(--surface-2)" : "var(--accent)",
          color: uploading ? "var(--text-muted)" : "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 600,
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
        onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = "var(--accent-hover)"; }}
        onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.background = "var(--accent)"; }}
      >
        {uploading ? (
          <>
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--text-muted)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Uploading…
          </>
        ) : (
          "Upload & Transcribe →"
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
