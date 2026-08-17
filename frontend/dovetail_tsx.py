import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.tsx"
with open(path, "r") as f:
    content = f.read()

# Remove breadcrumb from header (Dovetail header is just actions and back)
content = re.sub(r'<div className="tv2-breadcrumb">.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<span className=\{`tv2-status-badge.*?</span>', '', content, flags=re.DOTALL)
content = re.sub(r'\{recording\?\.duration_seconds.*?</span>\}', '', content, flags=re.DOTALL)
content = re.sub(r'\{wordCount > 0.*?words</span>\}', '', content, flags=re.DOTALL)

# Add Big Title inside tv2-main, right before view-toggle
main_start = '<main className="tv2-main">'
new_main_start = '<main className="tv2-main">\n          <h1 className="tv2-big-title">{recording?.filename || \'Untitled recording\'}</h1>'
content = content.replace(main_start, new_main_start)

# Move the toggle pills below the title, change style slightly
content = content.replace('<button className={`tv2-view-pill ${highlightMode===\'original\'?\'active\':\'\'}`} onClick={() => setHighlightMode(\'original\')}><AlignLeft size={11}/> Transcript</button>', '<button className={`tv2-view-pill ${highlightMode===\'original\'?\'active\':\'\'}`} onClick={() => setHighlightMode(\'original\')}>Original</button>')
content = content.replace('<button className={`tv2-view-pill ${highlightMode===\'highlights\'?\'active\':\'\'}`} onClick={() => setHighlightMode(\'highlights\')}><Bookmark size={11}/> Highlights</button>', '<button className={`tv2-view-pill ${highlightMode===\'highlights\'?\'active\':\'\'}`} onClick={() => setHighlightMode(\'highlights\')}>Highlights only</button>')

with open(path, "w") as f:
    f.write(content)
