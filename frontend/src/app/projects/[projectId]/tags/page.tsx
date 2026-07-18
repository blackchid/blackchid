"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectTags, Tag, getProjects, Project } from "@/lib/api";

export default function ProjectTagsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [tags, setTags] = useState<Tag[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [projects, t] = await Promise.all([
        getProjects(),
        getProjectTags(projectId),
      ]);
      setProject(projects.find((p) => p.id === projectId) ?? null);
      setTags(t);
      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, height: 60 }}>
          <button onClick={() => router.push("/")}
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>←</button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{project?.name ?? "Project"}</div>
            <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>All tags</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 80px" }}>
        {tags.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-subtle)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏷</div>
            <p style={{ fontSize: 15 }}>No tags yet.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Open a transcript, select a segment, and create your first tag.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {tags.map((tag) => {
              const c = tag.color ?? "#6366f1";
              return (
                <button key={tag.id} id={`tag-card-${tag.id}`}
                  onClick={() => router.push(`/projects/${projectId}/tags/${tag.id}`)}
                  style={{ background: "var(--surface)", border: `1px solid var(--border)`, borderRadius: 12, padding: "20px 18px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = c; e.currentTarget.style.boxShadow = `0 0 0 1px ${c}44`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{tag.name}</span>
                  </div>
                  <div style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: `${c}18`, border: `1px solid ${c}44`, color: c, display: "inline-block" }}>
                    View segments →
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
