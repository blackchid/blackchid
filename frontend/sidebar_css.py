import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.css"
with open(path, "r") as f:
    content = f.read()

content = re.sub(r'\.tv2-sidebar \{.*?\}', '.tv2-sidebar {\n  width: 320px;\n  background: #141416;\n  border-left: 1px solid rgba(255,255,255,0.06);\n  display: flex;\n  flex-direction: column;\n}', content, flags=re.DOTALL)
content = re.sub(r'\.tv2-sb-nav \{.*?\}', '.tv2-sb-nav {\n  display: flex;\n  padding: 16px 24px 0;\n  gap: 16px;\n  border-bottom: 1px solid rgba(255,255,255,0.06);\n}', content, flags=re.DOTALL)
content = re.sub(r'\.tv2-sb-tab \{.*?\}', '.tv2-sb-tab {\n  background: transparent;\n  border: none;\n  color: var(--fg-muted);\n  font-size: 0.8rem;\n  font-weight: 500;\n  padding: 8px 0;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  transition: all var(--dur-fast);\n}', content, flags=re.DOTALL)

with open(path, "w") as f:
    f.write(content)
