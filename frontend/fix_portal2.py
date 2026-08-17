import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace(
"  if (isLoading) return (\n    <div className=\"tv2-shell\"><div className=\"tv2-center\"><Spinner size=\"md\" /><span className=\"tv2-load-txt\">Loading…</span></div></div>\n  );",
"  if (isLoading) return createPortal(\n    <>\n      <div className=\"tv2-backdrop\" onClick={() => navigate(`/projects/${projectId}`)} />\n      <div className=\"tv2-shell\"><div className=\"tv2-center\"><Spinner size=\"md\" /><span className=\"tv2-load-txt\">Loading…</span></div></div>\n    </>,\n    document.body\n  );"
)

content = content.replace(
"  if (error) return (\n    <div className=\"tv2-shell\"><div className=\"tv2-center\">\n      <div className=\"tv2-err-box\">\n        <span className=\"tv2-err-icon\">⚠</span>\n        <p className=\"tv2-err-title\">Could not load recording</p>\n        <p className=\"tv2-err-body\">{error}</p>\n        <button className=\"tv2-btn-primary\" onClick={() => window.location.reload()}>Reload</button>\n      </div>\n    </div></div>\n  );",
"  if (error) return createPortal(\n    <>\n      <div className=\"tv2-backdrop\" onClick={() => navigate(`/projects/${projectId}`)} />\n      <div className=\"tv2-shell\"><div className=\"tv2-center\">\n        <div className=\"tv2-err-box\">\n          <span className=\"tv2-err-icon\">⚠</span>\n          <p className=\"tv2-err-title\">Could not load recording</p>\n          <p className=\"tv2-err-body\">{error}</p>\n          <button className=\"tv2-btn-primary\" onClick={() => window.location.reload()}>Reload</button>\n        </div>\n      </div></div>\n    </>,\n    document.body\n  );"
)

with open(path, "w") as f:
    f.write(content)
