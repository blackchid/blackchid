"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface InsightEditorProps {
  initialTitle?: string;
  initialDescription?: string;
  onSave: (title: string, description: string) => Promise<void>;
  onCancel: () => void;
}

export default function InsightEditor({ initialTitle = "", initialDescription = "", onSave, onCancel }: InsightEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(title, description);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Insight Title..."
          style={{ width: "100%", fontSize: 20, fontWeight: 600, background: "transparent", border: "none", color: "var(--text)", outline: "none" }}
        />
      </div>

      <div style={{ borderBottom: "1px solid var(--border)", display: "flex", background: "var(--surface-2)" }}>
        <button 
          onClick={() => setPreview(false)}
          style={{ flex: 1, padding: 12, background: preview ? "transparent" : "var(--surface)", border: "none", borderRight: "1px solid var(--border)", borderBottom: preview ? "1px solid var(--border)" : "none", color: preview ? "var(--text-muted)" : "var(--text)", fontWeight: preview ? 500 : 600, cursor: "pointer" }}
        >
          Write (Markdown)
        </button>
        <button 
          onClick={() => setPreview(true)}
          style={{ flex: 1, padding: 12, background: preview ? "var(--surface)" : "transparent", border: "none", borderBottom: preview ? "none" : "1px solid var(--border)", color: preview ? "var(--text)" : "var(--text-muted)", fontWeight: preview ? 600 : 500, cursor: "pointer" }}
        >
          Preview
        </button>
      </div>

      <div style={{ padding: 20, minHeight: 300, background: "var(--background)" }}>
        {preview ? (
          <div className="markdown-preview" style={{ color: "var(--text)", lineHeight: 1.6 }}>
            {description ? <ReactMarkdown>{description}</ReactMarkdown> : <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Nothing to preview</span>}
          </div>
        ) : (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Write your observations here... Markdown is supported."
            style={{ width: "100%", height: "100%", minHeight: 260, resize: "vertical", background: "transparent", border: "none", color: "var(--text)", outline: "none", fontSize: 15, lineHeight: 1.6, fontFamily: "inherit" }}
          />
        )}
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 12, background: "var(--surface-2)" }}>
        <button onClick={onCancel} disabled={saving} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !title.trim()} style={{ padding: "8px 24px", background: "var(--accent)", border: "none", borderRadius: 8, color: "white", fontWeight: 600, cursor: (saving || !title.trim()) ? "not-allowed" : "pointer", opacity: (saving || !title.trim()) ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Insight"}
        </button>
      </div>
    </div>
  );
}
