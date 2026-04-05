/**
 * Installer: MCP Server
 * Crea .mcp.json en el proyecto con la config del server.
 */

import { existsSync } from "node:fs"
import { join } from "node:path"
import { readJson, writeJson, confirm, log, success, PKG_NAME } from "../helpers.js"
import type { InstallerContext, InstallerResult } from "../types.js"

function createProjectMcpConfig(projectRoot: string): void {
  const mcpPath = join(projectRoot, ".mcp.json")
  const config = readJson(mcpPath)
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>

  servers.project = {
    command: "npx",
    args: ["-y", PKG_NAME],
    env: { MCP_PROJECT_ROOT: "." }
  }

  config.mcpServers = servers
  writeJson(mcpPath, config)
}

export async function installMcpServer(ctx: InstallerContext): Promise<InstallerResult> {
  const mcpPath = join(ctx.projectRoot, ".mcp.json")
  const alreadyExists = existsSync(mcpPath)

  if (alreadyExists) {
    const existing = readJson(mcpPath)
    const servers = existing.mcpServers as Record<string, unknown> | undefined
    if (servers?.project) {
      const overwrite = await confirm("  Ya existe .mcp.json con 'project' configurado. Sobreescribir?", false)
      if (!overwrite) {
        return { component: "MCP Server", success: true, message: "Sin cambios (ya configurado)" }
      }
    }
  }

  createProjectMcpConfig(ctx.projectRoot)

  const verb = alreadyExists ? "actualizado" : "creado"
  success(`.mcp.json ${verb}`)
  log("")
  log("Commitea .mcp.json al repo para que todo el equipo lo tenga.")

  return { component: "MCP Server", success: true, message: `.mcp.json ${verb}` }
}
