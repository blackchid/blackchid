path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/ProjectHome.tsx"
with open(path, "r") as f:
    content = f.read()

# Append Outlet before the last closing div of ProjectHome
content = content.replace("    </div>\n  );\n}", "      <Outlet />\n    </div>\n  );\n}")

with open(path, "w") as f:
    f.write(content)
