import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.tsx"
with open(path, "r") as f:
    content = f.read()

# Make the transcript title match Dovetail exactly
content = content.replace('<span className="tv2-transcript-title"><Activity size={13}/> Transcript {segments.length>0&&<span className="tv2-seg-count">{segments.length} segments</span>}</span>', 
'<span className="tv2-transcript-title" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Transcript</span>')

with open(path, "w") as f:
    f.write(content)
