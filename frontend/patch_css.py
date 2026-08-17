import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.css"
with open(path, "r") as f:
    content = f.read()

# Make the player height larger so the video looks good
content = content.replace("height: 180px;", "height: 400px;")

# Hide overlays when playing. We will use a wrapper class for this later, but for now just improve the overlays.
content = content.replace("background: rgba(255,255,255,.12);", "background: rgba(0,0,0,.4);")
content = content.replace("backdrop-filter: blur(8px);", "backdrop-filter: blur(4px);")

with open(path, "w") as f:
    f.write(content)
