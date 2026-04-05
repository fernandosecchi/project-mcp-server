/**
 * UI del setup interactivo: banner, selector de componentes, resumen.
 * Usa @inquirer/prompts si está disponible, sino fallback a readline.
 */

import type { ComponentDef, InstallerResult } from "./types.js"
import { ask, log, success, error as logError, warn } from "./helpers.js"

// ─── Banner ─────────────────────────────────────────────────────────────────

export function showBanner(): void {
  console.log()
  console.log("  project-mcp-server — setup interactivo")
  console.log("  ───────────────────────────────────────")
  console.log()
}

// ─── Component Definitions ──────────────────────────────────────────────────

export const COMPONENTS: ComponentDef[] = [
  {
    id: "mcp-server",
    name: "MCP Server",
    description: "10 herramientas de inteligencia de proyecto, entorno y generacion",
    defaultSelected: true
  },
  {
    id: "openspec",
    name: "OpenSpec",
    description: "Desarrollo guiado por especificaciones (SDD)",
    defaultSelected: false
  },
  {
    id: "engram",
    name: "Engram",
    description: "Memoria persistente entre sesiones de IA",
    defaultSelected: false
  },
  {
    id: "gentleman-skills",
    name: "Skills comunitarios",
    description: "Habilidades para React, Next, Angular, TypeScript y mas",
    defaultSelected: false
  },
  {
    id: "guardian-angel",
    name: "Guardian Angel",
    description: "Revision de codigo con IA antes de cada commit",
    defaultSelected: false
  }
]

// ─── Component Selector ─────────────────────────────────────────────────────

async function selectWithInquirer(components: ComponentDef[]): Promise<string[]> {
  // Dynamic import — solo se carga si está instalado
  const { checkbox } = await import("@inquirer/prompts")

  const selected = await checkbox({
    message: "Selecciona los componentes a instalar:",
    choices: components.map(c => ({
      name: `${c.name} — ${c.description}`,
      value: c.id,
      checked: c.defaultSelected
    }))
  })

  return selected
}

async function selectWithReadline(components: ComponentDef[]): Promise<string[]> {
  console.log("  Componentes disponibles para instalar:")
  console.log()
  for (let i = 0; i < components.length; i++) {
    const c = components[i]!
    const marker = c.defaultSelected ? "*" : " "
    console.log(`  [${marker}] ${i + 1}. ${c.name} — ${c.description}`)
  }
  console.log()
  log("(* = incluido por defecto)")
  console.log()

  const defaults = components
    .map((c, i) => c.defaultSelected ? String(i + 1) : null)
    .filter(Boolean)
    .join(",")

  const answer = await ask(`  Ingresa los numeros separados por coma (ej: 1,3,5) [${defaults}]: `)
  const input = answer || defaults

  const indices = input
    .split(",")
    .map(s => parseInt(s.trim(), 10) - 1)
    .filter(i => i >= 0 && i < components.length)

  return indices.map(i => components[i]!.id)
}

export async function selectComponents(components: ComponentDef[]): Promise<string[]> {
  // Inquirer necesita TTY interactivo — si stdin no es TTY, usar readline directo
  if (!process.stdin.isTTY) {
    return await selectWithReadline(components)
  }
  try {
    return await selectWithInquirer(components)
  } catch {
    // @inquirer/prompts no disponible — fallback a readline
    return await selectWithReadline(components)
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

export function showSummary(results: InstallerResult[]): void {
  console.log()
  console.log("  ───────────────────────────────────────")
  console.log("  Resumen de la instalacion")
  console.log()

  for (const r of results) {
    if (r.success) {
      success(`${r.component}: ${r.message}`)
    } else {
      logError(`${r.component}: ${r.message}`)
    }
    if (r.warnings) {
      for (const w of r.warnings) {
        warn(w)
      }
    }
  }

  console.log()
  log("Para verificar:")
  log("  Claude Code -> /mcp -> debe aparecer 'project' con 10 tools")
  log("  Cursor -> Settings -> MCP -> debe aparecer 'project'")
  console.log()
}
