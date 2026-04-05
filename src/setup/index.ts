#!/usr/bin/env node

/**
 * Setup interactivo unificado para project-mcp-server.
 * Wizard que permite elegir qué componentes instalar:
 * MCP Server, OpenSpec, Engram, Community Skills, Guardian Angel.
 *
 * Uso:
 *   npx project-mcp-server setup
 */

import { join } from "node:path"
import { readdirSync, copyFileSync } from "node:fs"
import {
  detectProjectRoot, detectSkillTargets, ensureDir, log, success,
  HOME, SKILLS_DIR, confirm
} from "./helpers.js"
import { showBanner, COMPONENTS, selectComponents, showSummary } from "./ui.js"
import { installMcpServer } from "./installers/mcp-server.js"
import { installOpenSpec } from "./installers/openspec.js"
import { installEngram } from "./installers/engram.js"
import { installGentlemanSkills } from "./installers/gentleman-skills.js"
import { installGuardianAngel } from "./installers/guardian-angel.js"
import type { InstallerContext, InstallerResult, InstallerFn } from "./types.js"

// ─── Installer Registry ─────────────────────────────────────────────────────

const INSTALLERS: Record<string, InstallerFn> = {
  "mcp-server": installMcpServer,
  "openspec": installOpenSpec,
  "engram": installEngram,
  "gentleman-skills": installGentlemanSkills,
  "guardian-angel": installGuardianAngel
}

// ─── Own Skills (project's bundled skills) ──────────────────────────────────

function copyOwnSkills(targets: { dir: string; name: string }[]): void {
  if (targets.length === 0) return

  const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith(".md"))
  if (files.length === 0) return

  for (const target of targets) {
    ensureDir(target.dir)
    for (const file of files) {
      copyFileSync(join(SKILLS_DIR, file), join(target.dir, file))
    }
    success(`${files.length} skills propios copiados a ${target.name}`)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  showBanner()

  // 1. Detectar proyecto
  const projectRoot = await detectProjectRoot()
  log(`Proyecto: ${projectRoot}`)
  console.log()

  // 2. Seleccionar componentes
  const selected = await selectComponents(COMPONENTS)

  if (selected.length === 0) {
    log("No se selecciono ningun componente.")
    return
  }

  console.log()

  // 3. Preparar contexto
  const skillTargets = detectSkillTargets()
  const ctx: InstallerContext = {
    projectRoot,
    homeDir: HOME,
    binDir: join(HOME, ".local", "bin"),
    cacheDir: join(HOME, ".cache", "project-mcp-server"),
    skillTargets
  }

  ensureDir(ctx.binDir)
  ensureDir(ctx.cacheDir)

  // 4. Ejecutar installers secuencialmente
  const results: InstallerResult[] = []

  for (const id of selected) {
    const installer = INSTALLERS[id]
    if (!installer) continue

    console.log()
    log(`--- ${COMPONENTS.find(c => c.id === id)?.name ?? id} ---`)

    try {
      const result = await installer(ctx)
      results.push(result)
    } catch (e) {
      results.push({
        component: COMPONENTS.find(c => c.id === id)?.name ?? id,
        success: false,
        message: `Error inesperado: ${e instanceof Error ? e.message : String(e)}`
      })
    }
  }

  // 5. Copiar skills propios del proyecto (siempre, si hay MCP server seleccionado)
  if (selected.includes("mcp-server") && skillTargets.length > 0) {
    const copyOwn = await confirm("\n  Copiar skills propios (Next.js, Prisma, security, etc.)?")
    if (copyOwn) {
      copyOwnSkills(skillTargets)
    }
  }

  // 6. Resumen
  showSummary(results)
}

main().catch((err: unknown) => {
  console.error("Error:", err)
  process.exit(1)
})
