import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def run():
    # Define the parameters to start the server over stdio
    server_params = StdioServerParameters(
        command="python",
        args=["mcp_server.py"],
        env={"DATABASE_URL": "postgresql://volt@127.0.0.1:5432/uxr_db"}
    )
    
    print("Starting MCP Server over STDIO...")
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            print("Connected! Fetching available tools...\n")
            tools = await session.list_tools()
            for t in tools.tools:
                print(f"- Tool: {t.name}")
                
            print("\nCalling 'search_insights' tool via MCP Protocol...")
            result = await session.call_tool("search_insights", arguments={"query": "test"})
            print("\nResult:")
            print(result.content[0].text)

if __name__ == "__main__":
    asyncio.run(run())
