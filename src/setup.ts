#!/usr/bin/env node

/**
 * Setup interactivo para project-mcp-server.
 * Detecta agentes instalados, configura el MCP y copia skills.
 *
 * Uso:
 *   npx project-mcp-server setup
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { createInterface } from "node:readline"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = join(__dirname, "..", "skills")
const HOME = homedir()
const PKG_NAME = "project-mcp-server"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]"
  const answer = await ask(`${question} ${hint} `)
  if (answer === "") return defaultYes
  return answer.toLowerCase().startsWith("y")
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeJson(path: string, data: Record<string, unknown>): void {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

function log(msg: string): void {
  console.log(`  ${msg}`)
}

function success(msg: string): void {
  console.log(`  ✓ ${msg}`)
}

function warn(msg: string): void {
  console.log(`  ⚠ ${msg}`)
}

// ─── MCP server config builder ──────────────────────────────────────────────

function mcpServerConfig(projectRoot: string) {
  return {
    command: "npx",
    args: ["-y", PKG_NAME],
    env: { MCP_PROJECT_ROOT: projectRoot }
  }
}

// ─── Agent Detection ─────────────────────────────────────────────────────────

interface AgentConfig {
  id: string
  name: string
  configPath: string
  skillsDir?: string
  detected: boolean
  writeConfig: (projectRoot: string) => void
  copySkills?: () => number
}

function detectAgents(): AgentConfig[] {
  const agents: AgentConfig[] = [
    {
      id: "claude-code",
      name: "Claude Code",
      configPath: join(HOME, ".claude", "mcp", "project.json"),
      skillsDir: join(HOME, ".claude", "skills"),
      detected: existsSync(join(HOME, ".claude")),
      writeConfig(projectRoot) {
        const mcpDir = join(HOME, ".claude", "mcp")
        ensureDir(mcpDir)
        writeJson(join(mcpDir, "project.json"), mcpServerConfig(projectRoot))
      }
    },
    {
      id: "open-code",
      name: "Open Code",
      configPath: join(HOME, ".config", "opencode", "config.json"),
      detected: existsSync(join(HOME, ".config", "opencode")),
      writeConfig(projectRoot) {
        const configPath = join(HOME, ".config", "opencode", "config.json")
        const config = readJson(configPath)
        const mcp = (config.mcp ?? {}) as Record<string, unknown>
        mcp.project = { type: "local", ...mcpServerConfig(projectRoot) }
        config.mcp = mcp
        writeJson(configPath, config)
      }
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      configPath: join(HOME, ".gemini", "config.json"),
      detected: existsSync(join(HOME, ".gemini")),
      writeConfig(projectRoot) {
        const configPath = join(HOME, ".gemini", "config.json")
        const config = readJson(configPath)
        const servers = (config.mcpServers ?? {}) as Record<string, unknown>
        servers.project = mcpServerConfig(projectRoot)
        config.mcpServers = servers
        writeJson(configPath, config)
      }
    },
    {
      id: "codex-cli",
      name: "Codex CLI",
      configPath: join(HOME, ".codex", "config.json"),
      detected: existsSync(join(HOME, ".codex")),
      writeConfig(projectRoot) {
        const configPath = join(HOME, ".codex", "config.json")
        const config = readJson(configPath)
        const servers = (config.mcpServers ?? {}) as Record<string, unknown>
        servers.project = mcpServerConfig(projectRoot)
        config.mcpServers = servers
        writeJson(configPath, config)
      }
    },
    {
      id: "cursor",
      name: "Cursor",
      configPath: join(HOME, ".cursor", "mcp.json"),
      detected: existsSync(join(HOME, ".cursor")),
      writeConfig(projectRoot) {
        const configPath = join(HOME, ".cursor", "mcp.json")
        const config = readJson(configPath)
        const servers = (config.mcpServers ?? {}) as Record<string, unknown>
        servers.project = mcpServerConfig(projectRoot)
        config.mcpServers = servers
        writeJson(configPath, config)
      }
    }
  ]

  for (const agent of agents) {
    if (agent.skillsDir) {
      agent.copySkills = () => copySkillsTo(agent.skillsDir!)
    }
  }

  return agents
}

function copySkillsTo(targetDir: string): number {
  ensureDir(targetDir)
  const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith(".md"))
  let count = 0
  for (const file of files) {
    const src = join(SKILLS_DIR, file)
    const dest = join(targetDir, file)
    copyFileSync(src, dest)
    count++
  }
  return count
}

// ─── VS Code (per-project) ──────────────────────────────────────────────────

function setupVsCode(projectRoot: string): void {
  const vscodeDir = join(projectRoot, ".vscode")
  const mcpPath = join(vscodeDir, "mcp.json")
  ensureDir(vscodeDir)

  const config = readJson(mcpPath)
  const servers = (config.servers ?? {}) as Record<string, unknown>
  servers.project = {
    type: "stdio",
    command: "npx",
    args: ["-y", PKG_NAME],
    env: { MCP_PROJECT_ROOT: "${workspaceFolder}" }
  }
  config.servers = servers
  writeJson(mcpPath, config)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log()
  console.log("  project-mcp-server — setup")
  console.log("  ──────────────────────────")
  console.log()

  // 1. Detectar proyecto
  let projectRoot = process.cwd()
  const markers = ["next.config.ts", "next.config.js", "next.config.mjs", "package.json"]
  const isProject = markers.some(m => existsSync(join(projectRoot, m)))

  if (isProject) {
    const useThis = await confirm(`Proyecto detectado: ${projectRoot}\n  ¿Usar este directorio?`)
    if (!useThis) {
      const custom = await ask("  Ruta al proyecto: ")
      projectRoot = resolve(custom)
    }
  } else {
    const custom = await ask("  Ruta al proyecto Next.js: ")
    projectRoot = resolve(custom)
  }

  if (!existsSync(projectRoot)) {
    console.error(`  ✗ No existe: ${projectRoot}`)
    process.exit(1)
  }

  projectRoot = resolve(projectRoot)
  log(`Proyecto: ${projectRoot}`)
  console.log()

  // 2. Detectar agentes
  const agents = detectAgents()
  const detected = agents.filter(a => a.detected)

  if (detected.length === 0) {
    warn("No se detectaron agentes de IA instalados.")
    log("Agentes soportados: Claude Code, Open Code, Gemini CLI, Codex CLI, Cursor")
    log("Instalá alguno y volvé a correr el setup.")
    process.exit(0)
  }

  log("Agentes detectados:")
  for (const agent of detected) {
    log(`  → ${agent.name}`)
  }
  console.log()

  // 3. Configurar MCP en cada agente
  const configureAll = await confirm("¿Configurar el MCP server en todos los agentes detectados?")
  const toConfig = configureAll ? detected : []

  if (!configureAll) {
    for (const agent of detected) {
      const yes = await confirm(`  ¿Configurar ${agent.name}?`, false)
      if (yes) toConfig.push(agent)
    }
  }

  for (const agent of toConfig) {
    agent.writeConfig(projectRoot)
    success(`${agent.name} configurado → ${agent.configPath}`)
  }

  // 4. VS Code (per-project)
  const hasVsCode = existsSync(join(projectRoot, ".vscode")) ||
                    existsSync("/Applications/Visual Studio Code.app") ||
                    existsSync(join(HOME, ".vscode"))
  if (hasVsCode) {
    const setupVsc = await confirm("¿Configurar VS Code (GitHub Copilot) para este proyecto?")
    if (setupVsc) {
      setupVsCode(projectRoot)
      success(`VS Code configurado → ${join(projectRoot, ".vscode", "mcp.json")}`)
    }
  }

  console.log()

  // 5. Copiar skills
  const agentsWithSkills = toConfig.filter(a => a.copySkills)
  if (agentsWithSkills.length > 0) {
    const copyAll = await confirm("¿Copiar skills (Next.js, Prisma, security, etc.) a los agentes configurados?")
    if (copyAll) {
      for (const agent of agentsWithSkills) {
        const count = agent.copySkills!()
        success(`${count} skills copiadas a ${agent.skillsDir}`)
      }
    }
  }

  console.log()

  // 6. Resumen
  console.log("  ──────────────────────────")
  console.log("  Setup completado.")
  console.log()
  log("Los agentes usarán: npx -y project-mcp-server")
  log("Esto siempre resuelve la última versión del paquete.")
  console.log()
  log("Para verificar, abrí tu agente en el proyecto y ejecutá:")
  log("  Claude Code → /mcp → debe aparecer 'project' con 10 tools")
  log("  Open Code → tab → debe aparecer el MCP server")
  console.log()
  log("Para usar con Gentleman AI (Engram + SDD):")
  log("  brew install gentleman-programming/tap/gentle-ai")
  log("  Las skills ya están copiadas en formato compatible.")
  console.log()
}

main().catch((err: unknown) => {
  console.error("Error:", err)
  process.exit(1)
})
