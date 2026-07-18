"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectInsights, Insight, getProjects, Project, createInsight, updateInsight, deleteInsight } from "@/lib/api";
import InsightEditor from "@/components/InsightEditor";
import ReactMarkdown from "react-markdown";

export default function ProjectInsightsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Editor state
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    try {
      const [projects, i] = await Promise.all([
        getProjects(),
        getProjectInsights(projectId),
      ]);
      setProject(projects.find((p) => p.id === projectId) ?? null);
      setInsights(i);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
  }, [projectId]);

  async function handleCreate(title: string, description: string) {
    await createInsight(projectId, title, description);
    setIsCreating(false);
    await load();
  }

  async function handleUpdate(id: string, title: string, description: string) {
    await updateInsight(id, title, description);
    setEditingId(null);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this insight?")) return;
    await deleteInsight(id);
    await load();
  }

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/")}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>←</button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{project?.name ?? "Project"}</div>
              <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>Insights</div>
            </div>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 16px", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + New Insight
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 80px", display: "flex", flexDirection: "column", gap: 32 }}>
        {isCreating && (
          <InsightEditor
            onSave={handleCreate}
            onCancel={() => setIsCreating(false)}
          />
        )}

        {insights.length === 0 && !isCreating ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-subtle)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>💡</div>
            <p style={{ fontSize: 15 }}>No insights yet.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Write down your findings and attach evidence from transcripts.</p>
          </div>
        ) : (
          insights.map((insight) => (
            <div key={insight.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {editingId === insight.id ? (
                <InsightEditor
                  initialTitle={insight.title}
                  initialDescription={insight.description ?? ""}
                  onSave={(t, d) => handleUpdate(insight.id, t, d)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>{insight.title}</h2>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setEditingId(insight.id)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--text-muted)" }}>Edit</button>
                        <button onClick={() => handleDelete(insight.id)} style={{ background: "transparent", border: "1px solid var(--error)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--error)" }}>Delete</button>
                      </div>
                    </div>
                    <div className="markdown-preview" style={{ color: "var(--text)", lineHeight: 1.6, fontSize: 15 }}>
                      {insight.description ? <ReactMarkdown>{insight.description}</ReactMarkdown> : <span style={{ fontStyle: "italic", color: "var(--text-subtle)" }}>No description.</span>}
                    </div>
                  </div>
                  
                  {/* Evidence Section */}
                  <div style={{ background: "var(--surface-2)", padding: "16px 24px" }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>Evidence ({insight.evidence.length})</h3>
                    {insight.evidence.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--text-subtle)", fontStyle: "italic" }}>No transcript segments attached yet.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {insight.evidence.map(ev => (
                          <div 
                            key={ev.id} 
                            onClick={() => {
                              if (ev.segment?.recording_id) {
                                router.push(`/recordings/${ev.segment.recording_id}/transcript#segment-${ev.segment_id}`);
                              }
                            }}
                            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, cursor: "pointer", transition: "border-color 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                          >
                            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>
                              {ev.segment?.speaker_label ?? "Speaker"}
                            </div>
                            <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5, marginBottom: ev.note ? 8 : 0 }}>
                              &quot;{ev.segment?.text}&quot;
                            </div>
                            {ev.note && (
                              <div style={{ fontSize: 13, color: "var(--text-muted)", background: "var(--background)", padding: "6px 10px", borderRadius: 6, borderLeft: "2px solid var(--accent)" }}>
                                {ev.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
