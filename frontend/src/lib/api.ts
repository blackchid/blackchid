const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Auth & Fetch Wrapper ──────────────────────────────────────────────────────
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
}

export function removeAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  
  if (res.status === 401) {
    // Basic redirect to login if token expires or is invalid
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      removeAuthToken();
      window.location.href = "/login";
    }
  }
  
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.detail) msg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
    } catch {}
    throw new Error(msg);
  }
  
  return res;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string | null;
}

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

export interface InsightEvidence {
  id: string;
  insight_id: string;
  segment_id: string;
  note: string | null;
  created_at: string;
  segment?: TranscriptSegment;
}

export interface Insight {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  evidence: InsightEvidence[];
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<string> {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);
  
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();
  setAuthToken(data.access_token);
  return data.access_token;
}

export async function getCurrentUser(): Promise<User> {
  const res = await apiFetch("/auth/me");
  return res.json();
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  const res = await apiFetch(`/projects`, { cache: "no-store" });
  return res.json();
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await apiFetch(`/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  return res.json();
}

export async function getProjectTags(projectId: string): Promise<Tag[]> {
  const res = await apiFetch(`/projects/${projectId}/tags`, { cache: "no-store" });
  return res.json();
}

export async function getProjectRecordings(projectId: string): Promise<Recording[]> {
  const res = await apiFetch(`/projects/${projectId}/recordings`, { cache: "no-store" });
  return res.json();
}

// ── Recordings ────────────────────────────────────────────────────────────────
export async function uploadRecording(projectId: string, file: File): Promise<Recording> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`/projects/${projectId}/recordings`, { method: "POST", body: form });
  return res.json();
}

export async function getRecording(recordingId: string): Promise<Recording> {
  const res = await apiFetch(`/recordings/${recordingId}`, { cache: "no-store" });
  return res.json();
}

export async function getRecordingTagApplications(recordingId: string): Promise<TagApplication[]> {
  const res = await apiFetch(`/recordings/${recordingId}/tag-applications`, { cache: "no-store" });
  return res.json();
}

// ── Tags ──────────────────────────────────────────────────────────────────────
export async function createTag(projectId: string, name: string, color?: string): Promise<Tag> {
  const res = await apiFetch(`/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, name, color }),
  });
  return res.json();
}

export async function applyTag(tagId: string, segmentId: string, note?: string): Promise<TagApplication> {
  const res = await apiFetch(`/tags/${tagId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segment_id: segmentId, note }),
  });
  return res.json();
}

export async function removeTag(tagId: string, segmentId: string): Promise<void> {
  await apiFetch(`/tags/${tagId}/apply/${segmentId}`, { method: "DELETE" });
}

export async function getSegmentsByTag(projectId: string, tagId: string): Promise<TranscriptSegment[]> {
  const res = await apiFetch(`/projects/${projectId}/tags/${tagId}/segments`, { cache: "no-store" });
  return res.json();
}

// ── Insights ──────────────────────────────────────────────────────────────────
export async function getProjectInsights(projectId: string): Promise<Insight[]> {
  const res = await apiFetch(`/projects/${projectId}/insights`, { cache: "no-store" });
  return res.json();
}

export async function createInsight(projectId: string, title: string, description?: string): Promise<Insight> {
  const res = await apiFetch(`/projects/${projectId}/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  return res.json();
}

export async function getInsight(insightId: string): Promise<Insight> {
  const res = await apiFetch(`/insights/${insightId}`, { cache: "no-store" });
  return res.json();
}

export async function updateInsight(insightId: string, title?: string, description?: string): Promise<Insight> {
  const res = await apiFetch(`/insights/${insightId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  return res.json();
}

export async function deleteInsight(insightId: string): Promise<void> {
  await apiFetch(`/insights/${insightId}`, { method: "DELETE" });
}

export async function addInsightEvidence(insightId: string, segmentId: string, note?: string): Promise<InsightEvidence> {
  const res = await apiFetch(`/insights/${insightId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segment_id: segmentId, note }),
  });
  return res.json();
}

export async function removeInsightEvidence(insightId: string, segmentId: string): Promise<void> {
  await apiFetch(`/insights/${insightId}/evidence/${segmentId}`, { method: "DELETE" });
}
