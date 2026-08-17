import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.tsx"
with open(path, "r") as f:
    content = f.read()

# Make sure X is imported from lucide-react
if " X," not in content and "X " not in content:
    content = content.replace("Play, Pause, ChevronLeft, ", "Play, Pause, ChevronLeft, X, ")

# Also close the fragment at the end of the file
content = content.replace("    </div>\n  );\n}", "    </div>\n    </>\n  );\n}")

with open(path, "w") as f:
    f.write(content)
