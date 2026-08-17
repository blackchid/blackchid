import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.css"
with open(path, "r") as f:
    content = f.read()

# Replace tv2-backdrop
content = re.sub(r'\.tv2-backdrop \{.*?\}', '.tv2-backdrop {\n  position: fixed;\n  inset: 0;\n  background: rgba(0,0,0,0.7);\n  backdrop-filter: blur(8px);\n  z-index: 90;\n  animation: fadeIn 0.2s ease-out;\n}', content, flags=re.DOTALL)

# Replace tv2-shell
content = re.sub(r'\.tv2-shell \{.*?\}', '.tv2-shell {\n  position: fixed;\n  top: 32px;\n  bottom: 32px;\n  left: 50%;\n  transform: translateX(-50%);\n  width: 90%;\n  max-width: 1400px;\n  display: flex;\n  flex-direction: column;\n  background: #141416;\n  overflow: hidden;\n  z-index: 100;\n  border-radius: 16px;\n  border: 1px solid rgba(255,255,255,0.08);\n  box-shadow: 0 40px 80px -20px rgba(0,0,0,0.8);\n  animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);\n}\n\n@keyframes slideInUp {\n  from { opacity: 0; transform: translate(-50%, 20px) scale(0.98); }\n  to { opacity: 1; transform: translate(-50%, 0) scale(1); }\n}', content, flags=re.DOTALL)

# Main layout adjustments
content = re.sub(r'\.tv2-main \{.*?\}', '.tv2-main {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  overflow-y: auto;\n  padding: 40px 60px;\n  gap: 24px;\n  min-width: 0;\n  max-width: 800px;\n  margin: 0 auto;\n  align-items: stretch;\n  width: 100%;\n}', content, flags=re.DOTALL)

# Title adjustments
content = content + "\n\n.tv2-big-title {\n  font-size: 2.25rem;\n  font-weight: 700;\n  color: #fff;\n  margin: 0 0 16px 0;\n  line-height: 1.2;\n  letter-spacing: -0.02em;\n}"

# Remove player card background
content = re.sub(r'\.tv2-player-card \{.*?\}', '.tv2-player-card {\n  border-radius: 12px;\n  overflow: hidden;\n  background: #000;\n  flex-shrink: 0;\n  width: 100%;\n  box-shadow: 0 4px 20px rgba(0,0,0,0.2);\n}', content, flags=re.DOTALL)

# Remove transcript wrap background and border
content = re.sub(r'\.tv2-transcript-wrap \{.*?\}', '.tv2-transcript-wrap {\n  display: flex;\n  flex-direction: column;\n  background: transparent;\n  border: none;\n  padding: 0;\n}', content, flags=re.DOTALL)

# Adjust transcript header
content = re.sub(r'\.tv2-transcript-header \{.*?\}', '.tv2-transcript-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 16px 0;\n  border-bottom: 1px solid rgba(255,255,255,0.06);\n  margin-bottom: 16px;\n}', content, flags=re.DOTALL)

with open(path, "w") as f:
    f.write(content)
