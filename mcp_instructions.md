# Blackchid MCP Server Connection Guide

The Blackchid UXR backend now includes a completely local **Model Context Protocol (MCP)** server. This allows AI assistants like Claude Desktop, Claude Code, and Cursor to securely query your research database directly on your machine without sending any of your sensitive UX transcripts or insights to third-party endpoints.

## Tools Exposed
- `search_insights(query)`: Search across UX research insights for a given keyword or topic.
- `get_project_summary(project_id)`: Retrieve high-level statistics (recording counts, tag counts) for a project.
- `get_segments_by_tag(tag)`: Retrieve all raw transcript segments associated with a specific tag name.

## Configuration Instructions

### For Cursor
1. Open Cursor Settings (Cmd+, or Ctrl+,)
2. Go to **Features** > **MCP**
3. Click **Add New MCP Server**
4. Configure as follows:
   - **Type**: `command`
   - **Name**: `blackchid-uxr`
   - **Command**: `path/to/project-root/.venv/bin/python path/to/project-root/backend/mcp_server.py`
     *(Make sure to use absolute paths to your python binary inside the `.venv` and the absolute path to `mcp_server.py`)*

### For Claude Desktop
Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "blackchid-uxr": {
      "command": "/absolute/path/to/project-root/.venv/bin/python",
      "args": ["/absolute/path/to/project-root/backend/mcp_server.py"],
      "env": {
        "DATABASE_URL": "postgresql://volt@127.0.0.1:5432/uxr_db"
      }
    }
  }
}
```

### For Claude Code
Run the following command in your terminal while inside the project root:
```bash
claude mcp add blackchid-uxr -- python backend/mcp_server.py
```

---

> **Note**: The MCP server connects directly to your Postgres database via SQLAlchemy. It operates entirely locally over STDIO and does not expose a network port.
