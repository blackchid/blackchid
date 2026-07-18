const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  project_id: string;
  filename: string;
  duration_seconds: number | null;
  status: "pending" | "processing" | "done" | "error";
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface TagApplication {
  id: string;
  segment_id: string;
  tag_id: string;
  tag_name: string;
  tag_color: string | null;
  note: string | null;
}

export interface TranscriptSegment {
  id: string;
  recording_id: string;
  start_time: number;
  end_time: number;
  speaker_label: string | null;
  text: string;
  created_at: string;
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function getProjectTags(projectId: string): Promise<Tag[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tags`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load tags");
  return res.json();
}

export async function getProjectRecordings(projectId: string): Promise<Recording[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/recordings`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load recordings");
  return res.json();
}

// ── Recordings ────────────────────────────────────────────────────────────────
export async function uploadRecording(projectId: string, file: File): Promise<Recording> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/projects/${projectId}/recordings`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Failed to upload recording");
  return res.json();
}

export async function getRecording(recordingId: string): Promise<Recording> {
  const res = await fetch(`${API_BASE}/recordings/${recordingId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch recording");
  return res.json();
}

export async function getRecordingTagApplications(recordingId: string): Promise<TagApplication[]> {
  const res = await fetch(`${API_BASE}/recordings/${recordingId}/tag-applications`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load tag applications");
  return res.json();
}

// ── Tags ──────────────────────────────────────────────────────────────────────
export async function createTag(projectId: string, name: string, color?: string): Promise<Tag> {
  const res = await fetch(`${API_BASE}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, name, color }),
  });
  if (!res.ok) throw new Error("Failed to create tag");
  return res.json();
}

export async function applyTag(tagId: string, segmentId: string, note?: string): Promise<TagApplication> {
  const res = await fetch(`${API_BASE}/tags/${tagId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segment_id: segmentId, note }),
  });
  if (!res.ok) throw new Error("Failed to apply tag");
  return res.json();
}

export async function removeTag(tagId: string, segmentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tags/${tagId}/apply/${segmentId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove tag");
}

// ── Tag-filtered segments ─────────────────────────────────────────────────────
export async function getSegmentsByTag(projectId: string, tagId: string): Promise<TranscriptSegment[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tags/${tagId}/segments`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load segments");
  return res.json();
}
