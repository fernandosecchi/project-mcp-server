#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerProjectTools } from "./tools/project/index.js"
import { registerEnvTools } from "./tools/env/index.js"
import { registerGenerateTools } from "./tools/generate/index.js"
import { config } from "./config.js"

const server = new McpServer({
  name: "project-mcp-server",
  version: "2.0.0"
})

registerProjectTools(server)
registerEnvTools(server)
registerGenerateTools(server)

async function main(): Promise<void> {
  console.error(`✓ project-mcp-server v2.0.0 iniciado`)
  console.error(`  Proyecto: ${config.projectRoot}`)
  console.error(`  Tools: project_scan, project_routes, project_actions, project_models,`)
  console.error(`         env_status, env_run_check, env_prisma_status,`)
  console.error(`         generate_action, generate_page, generate_component`)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err: unknown) => {
  console.error("Error fatal:", err)
  process.exit(1)
})
