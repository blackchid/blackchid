import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.css"
with open(path, "r") as f:
    content = f.read()

# Fix player card flex issues
content = content.replace(".tv2-player-card {\n  border-radius: 12px;\n  overflow: hidden;\n  border: 1px solid var(--border);\n  background: #1e1e24;\n  flex-shrink: 0;\n}", 
".tv2-player-card {\n  border-radius: 12px;\n  overflow: hidden;\n  border: 1px solid var(--border);\n  background: #1e1e24;\n  flex-shrink: 0;\n  width: 100%;\n}")

# Make video area strictly responsive
content = content.replace("height: auto; aspect-ratio: 16/9; max-height: 40vh;", "width: 100%; height: auto; aspect-ratio: 16/9; max-height: 45vh;")

with open(path, "w") as f:
    f.write(content)
