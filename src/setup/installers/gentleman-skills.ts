/**
 * Installer: Gentleman-Skills
 * Skills comunitarios para agentes de IA.
 * Descarga desde GitHub y copia a los directorios de skills detectados.
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  downloadFile, extractTarGz, ensureDir, log, success, warn
} from "../helpers.js"
import type { InstallerContext, InstallerResult } from "../types.js"

const REPO = "Gentleman-Programming/Gentleman-Skills"
const BRANCH = "main"

async function downloadSkillsArchive(cacheDir: string): Promise<string> {
  const archivePath = join(cacheDir, "gentleman-skills.tar.gz")
  const url = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz`

  log("Descargando skills comunitarios...")
  await downloadFile(url, archivePath)

  const extractDir = join(cacheDir, "gentleman-skills-extract")
  await extractTarGz(archivePath, extractDir)

  // GitHub archive extracts to Gentleman-Skills-main/
  const innerDir = join(extractDir, `Gentleman-Skills-${BRANCH}`)
  if (!existsSync(innerDir)) {
    // Intentar buscar el directorio extraído
    const entries = readdirSync(extractDir)
    const found = entries.find(e => e.toLowerCase().includes("skill"))
    if (found) return join(extractDir, found)
    throw new Error("No se encontro el directorio de skills en el archivo descargado")
  }
  return innerDir
}

function copySkillsRecursive(sourceDir: string, targetDir: string, subdir: string): number {
  const fullSource = join(sourceDir, subdir)
  if (!existsSync(fullSource)) return 0

  let count = 0
  const entries = readdirSync(fullSource, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Cada subdirectorio es un skill — buscar SKILL.md dentro
      const skillFile = join(fullSource, entry.name, "SKILL.md")
      if (existsSync(skillFile)) {
        const destDir = join(targetDir, entry.name)
        ensureDir(destDir)
        const content = readFileSync(skillFile, "utf-8")
        writeFileSync(join(destDir, "SKILL.md"), content, "utf-8")
        count++
      }
    }
  }

  return count
}

export async function installGentlemanSkills(ctx: InstallerContext): Promise<InstallerResult> {
  if (ctx.skillTargets.length === 0) {
    return {
      component: "Community Skills",
      success: false,
      message: "No se detectaron agentes (Claude Code, Open Code) para copiar skills"
    }
  }

  let skillsDir: string
  try {
    skillsDir = await downloadSkillsArchive(ctx.cacheDir)
  } catch (e) {
    return {
      component: "Community Skills",
      success: false,
      message: `Error descargando: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  const warnings: string[] = []
  let totalCopied = 0

  for (const target of ctx.skillTargets) {
    // Copiar curated skills
    const curatedCount = copySkillsRecursive(skillsDir, target.dir, "curated")
    // Copiar community skills
    const communityCount = copySkillsRecursive(skillsDir, target.dir, "community")

    const count = curatedCount + communityCount
    totalCopied += count

    if (count > 0) {
      success(`${count} skills copiados a ${target.name} (${target.dir})`)
    } else {
      warnings.push(`No se encontraron skills para copiar a ${target.name}`)
    }
  }

  return {
    component: "Community Skills",
    success: totalCopied > 0,
    message: totalCopied > 0
      ? `${totalCopied} skills instalados`
      : "No se copiaron skills",
    warnings: warnings.length > 0 ? warnings : undefined
  }
}
