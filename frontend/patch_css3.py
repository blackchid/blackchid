import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.css"
with open(path, "r") as f:
    content = f.read()

# Make the player card look better
content = content.replace("border-radius: var(--r-xl);", "border-radius: 12px;")
content = content.replace("background: var(--bg-card);", "background: #1e1e24;")

# Make the transcript look better
content = content.replace("background: var(--bg-elevated);", "background: #25252d;")
content = content.replace("border: 1px solid var(--border);", "border: 1px solid rgba(255,255,255,0.08);")

with open(path, "w") as f:
    f.write(content)
