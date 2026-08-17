import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.tsx"
with open(path, "r") as f:
    content = f.read()

# Make sure we import createPortal
if "createPortal" not in content:
    content = content.replace("import { useState, useEffect, useCallback, useRef } from 'react';", 
    "import { useState, useEffect, useCallback, useRef } from 'react';\nimport { createPortal } from 'react-dom';")

# Wrap the final return inside createPortal(..., document.body)
content = content.replace("  return (\n    <>\n      <div className=\"tv2-backdrop\"", 
"  return createPortal(\n    <>\n      <div className=\"tv2-backdrop\"")

content = content.replace("    </div>\n    </>\n  );\n}", "    </div>\n    </>,\n    document.body\n  );\n}")

with open(path, "w") as f:
    f.write(content)
