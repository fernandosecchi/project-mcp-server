/**
 * Installer: Engram
 * Memoria persistente para agentes de IA.
 * Descarga el binary de GitHub Releases e instala en ~/.local/bin.
 */

import { existsSync, chmodSync } from "node:fs"
import { join } from "node:path"
import {
  downloadFile, extractTarGz, detectPlatform, ensureDir,
  isInPath, exec, readJson, writeJson, log, success, warn, HOME
} from "../helpers.js"
import type { InstallerContext, InstallerResult } from "../types.js"

const REPO = "Gentleman-Programming/engram"
const BINARY_NAME = "engram"

async function getLatestVersion(): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
  const data = await response.json() as { tag_name: string }
  return data.tag_name // e.g. "v1.11.0"
}

function buildDownloadUrl(version: string, os: string, arch: string): string {
  const ext = os === "windows" ? "zip" : "tar.gz"
  // GoReleaser format: engram_<version>_<os>_<arch>.tar.gz
  const versionClean = version.startsWith("v") ? version : `v${version}`
  return `https://github.com/${REPO}/releases/download/${versionClean}/engram_${versionClean}_${os}_${arch}.${ext}`
}

export async function installEngram(ctx: InstallerContext): Promise<InstallerResult> {
  const warnings: string[] = []

  // Check si ya está instalado
  const existingCheck = await exec("engram", ["version"], { timeout: 5000 })
  if (existingCheck.code === 0) {
    log("Engram ya instalado, configurando MCP...")
    addEngramMcpConfig(ctx)
    return {
      component: "Engram",
      success: true,
      message: `Ya instalado (${existingCheck.stdout.trim()}), MCP configurado`
    }
  }

  // Detectar plataforma
  const plat = detectPlatform()
  log(`Plataforma: ${plat.os}/${plat.arch}`)

  // Obtener última versión
  log("Obteniendo ultima version...")
  let version: string
  try {
    version = await getLatestVersion()
  } catch (e) {
    return {
      component: "Engram",
      success: false,
      message: `No se pudo obtener la version: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  log(`Version: ${version}`)

  // Descargar
  const url = buildDownloadUrl(version, plat.os, plat.arch)
  const archivePath = join(ctx.cacheDir, `engram_${version}.tar.gz`)
  const extractDir = join(ctx.cacheDir, "engram-extract")

  log(`Descargando ${BINARY_NAME}...`)
  try {
    await downloadFile(url, archivePath)
  } catch (e) {
    return {
      component: "Engram",
      success: false,
      message: `Error descargando: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  // Extraer
  try {
    await extractTarGz(archivePath, extractDir)
  } catch (e) {
    return {
      component: "Engram",
      success: false,
      message: `Error extrayendo: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  // Mover binary
  const binarySource = join(extractDir, BINARY_NAME)
  const binaryDest = join(ctx.binDir, BINARY_NAME)

  if (!existsSync(binarySource)) {
    return {
      component: "Engram",
      success: false,
      message: `Binary no encontrado en el archivo descargado`
    }
  }

  ensureDir(ctx.binDir)
  const { copyFileSync } = await import("node:fs")
  copyFileSync(binarySource, binaryDest)
  chmodSync(binaryDest, 0o755)
  success(`Instalado en ${binaryDest}`)

  // Verificar PATH
  if (!isInPath(ctx.binDir)) {
    warnings.push(
      `${ctx.binDir} no esta en tu PATH. Agrega esto a tu shell config:`,
      `  export PATH="$PATH:${ctx.binDir}"`
    )
    for (const w of warnings) warn(w)
  }

  // Configurar MCP
  addEngramMcpConfig(ctx)

  return {
    component: "Engram",
    success: true,
    message: `${version} instalado, MCP configurado`,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

function addEngramMcpConfig(ctx: InstallerContext): void {
  // Agregar a .mcp.json del proyecto
  const mcpPath = join(ctx.projectRoot, ".mcp.json")
  const config = readJson(mcpPath)
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>

  servers.engram = {
    command: "engram",
    args: ["mcp", "--tools=agent"]
  }

  config.mcpServers = servers
  writeJson(mcpPath, config)
  success("Engram agregado a .mcp.json")

  // También agregar a config global de Claude Code si existe
  const claudeDir = join(HOME, ".claude")
  if (existsSync(claudeDir)) {
    const globalMcpDir = join(claudeDir, "mcp")
    const globalMcpPath = join(globalMcpDir, "engram.json")
    writeJson(globalMcpPath, {
      command: "engram",
      args: ["mcp", "--tools=agent"]
    })
    success("Engram agregado a config global de Claude Code")
  }
}
