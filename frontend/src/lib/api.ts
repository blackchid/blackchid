const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(
  name: string,
  description?: string
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function uploadRecording(
  projectId: string,
  file: File
): Promise<Recording> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/projects/${projectId}/recordings`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload recording");
  return res.json();
}

export async function getRecording(recordingId: string): Promise<Recording> {
  const res = await fetch(`${API_BASE}/recordings/${recordingId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch recording");
  return res.json();
}
