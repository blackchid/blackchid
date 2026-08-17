import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.tsx"
with open(path, "r") as f:
    content = f.read()

# Add the breadcrumbs back to the header!
header_start = '<header className="tv2-header">\n        <div className="tv2-header-left">\n          <Link to={`/projects/${projectId}`} className="tv2-back-btn"><X size={16} /></Link>'
header_new = '<header className="tv2-header" style={{ padding: "16px 24px", borderBottom: "none" }}>\n        <div className="tv2-header-left">\n          <Link to={`/projects/${projectId}`} className="tv2-back-btn"><X size={16} /></Link>\n          <div className="tv2-breadcrumb" style={{ fontSize: "0.85rem", color: "var(--fg-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>\n            <span>Project</span> <span style={{opacity: 0.5}}>/</span> <span style={{color: "var(--fg)"}}>{recording?.filename}</span>\n          </div>'
content = content.replace(header_start, header_new)

with open(path, "w") as f:
    f.write(content)
