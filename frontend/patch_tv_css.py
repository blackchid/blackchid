path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.css"
with open(path, "r") as f:
    content = f.read()

# Replace tv2-shell to be a floating modal / drawer
content = content.replace(".tv2-shell {\n  position: fixed;\n  inset: 0;\n  left: 240px; /* sidebar width */\n  display: flex;\n  flex-direction: column;\n  background: var(--bg);\n  overflow: hidden;\n  z-index: 10;\n}",
".tv2-shell {\n  position: fixed;\n  top: 16px;\n  bottom: 16px;\n  right: 16px;\n  left: 280px; /* offset over project home */\n  display: flex;\n  flex-direction: column;\n  background: var(--bg);\n  overflow: hidden;\n  z-index: 100;\n  border-radius: 12px;\n  border: 1px solid var(--border);\n  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);\n  animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);\n}\n\n@keyframes slideIn {\n  from { opacity: 0; transform: translateY(20px) scale(0.98); }\n  to { opacity: 1; transform: translateY(0) scale(1); }\n}")

with open(path, "w") as f:
    f.write(content)
