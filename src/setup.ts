#!/usr/bin/env node

/**
 * Setup interactivo para project-mcp-server.
 * Crea .mcp.json en el proyecto y copia skills al agente.
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

// ─── Per-project .mcp.json ──────────────────────────────────────────────────

function createProjectMcpConfig(projectRoot: string): void {
  const mcpPath = join(projectRoot, ".mcp.json")
  const config = readJson(mcpPath)
  const servers = (config.servers ?? {}) as Record<string, unknown>

  servers.project = {
    command: "npx",
    args: ["-y", PKG_NAME],
    env: { MCP_PROJECT_ROOT: "." }
  }

  config.servers = servers
  writeJson(mcpPath, config)
}

// ─── Skills copy ────────────────────────────────────────────────────────────

interface SkillTarget {
  name: string
  dir: string
  detected: boolean
}

function detectSkillTargets(): SkillTarget[] {
  return [
    {
      name: "Claude Code",
      dir: join(HOME, ".claude", "skills"),
      detected: existsSync(join(HOME, ".claude"))
    },
    {
      name: "Open Code",
      dir: join(HOME, ".config", "opencode", "skills"),
      detected: existsSync(join(HOME, ".config", "opencode"))
    }
  ].filter(t => t.detected)
}

function copySkillsTo(targetDir: string): number {
  ensureDir(targetDir)
  const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith(".md"))
  let count = 0
  for (const file of files) {
    copyFileSync(join(SKILLS_DIR, file), join(targetDir, file))
    count++
  }
  return count
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

  // 2. Crear .mcp.json en el proyecto
  const mcpPath = join(projectRoot, ".mcp.json")
  const alreadyExists = existsSync(mcpPath)

  if (alreadyExists) {
    const existing = readJson(mcpPath)
    const servers = existing.servers as Record<string, unknown> | undefined
    if (servers?.project) {
      const overwrite = await confirm("Ya existe .mcp.json con 'project' configurado. ¿Sobreescribir?", false)
      if (!overwrite) {
        log("Configuración de MCP sin cambios.")
      } else {
        createProjectMcpConfig(projectRoot)
        success(`.mcp.json actualizado`)
      }
    } else {
      createProjectMcpConfig(projectRoot)
      success(`.mcp.json actualizado — server 'project' agregado`)
    }
  } else {
    createProjectMcpConfig(projectRoot)
    success(`.mcp.json creado`)
  }

  log("")
  log("Este archivo es per-project: cualquier agente MCP-compatible")
  log("lo detecta al abrir este directorio. Commitealo al repo para")
  log("que todo el equipo lo tenga.")
  console.log()

  // 3. Copiar skills a agentes detectados
  const targets = detectSkillTargets()

  if (targets.length > 0) {
    log("Agentes detectados para copiar skills:")
    for (const t of targets) {
      log(`  → ${t.name}`)
    }
    console.log()

    const copyAll = await confirm("¿Copiar skills (Next.js, Prisma, security, etc.)?")
    if (copyAll) {
      for (const t of targets) {
        const count = copySkillsTo(t.dir)
        success(`${count} skills copiadas a ${t.dir}`)
      }
    }
  }

  console.log()

  // 4. Resumen
  console.log("  ──────────────────────────")
  console.log("  Setup completado.")
  console.log()
  log("Archivo creado: .mcp.json (commitear al repo)")
  log("")
  log("Para verificar:")
  log("  Claude Code → /mcp → debe aparecer 'project' con 10 tools")
  log("  Cursor → Settings → MCP → debe aparecer 'project'")
  log("")
  log("Para usar con Gentleman AI (Engram + SDD):")
  log("  brew install gentleman-programming/tap/gentle-ai")
  log("  Las skills ya están copiadas en formato compatible.")
  console.log()
}

main().catch((err: unknown) => {
  console.error("Error:", err)
  process.exit(1)
})
