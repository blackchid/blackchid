import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.css"
with open(path, "r") as f:
    content = f.read()

# Fix tv2-main to not be constrained to 800px if they want it responsive/centered nicely.
# Let's make it fluid with some padding.
content = content.replace("max-width: 800px;", "max-width: 1000px;")
content = content.replace("margin: 0 auto;", "margin: 0 auto; align-items: stretch;")

# The video area height
content = content.replace("height: 400px;", "height: auto; aspect-ratio: 16/9; max-height: 40vh;")

# Make the transcript text a bit tighter and more professional
content = content.replace("font-size: 0.9375rem; line-height: 1.75;", "font-size: 0.95rem; line-height: 1.6;")
content = content.replace("padding: 8px 16px 8px 20px;", "padding: 4px 16px 4px 20px;")

with open(path, "w") as f:
    f.write(content)
