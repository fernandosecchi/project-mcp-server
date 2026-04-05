/**
 * Installer: Guardian Angel (GGA)
 * Code review con IA como pre-commit hook.
 * Descarga scripts de GitHub y los instala.
 */

import { existsSync, chmodSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  downloadFile, extractTarGz, ensureDir, exec,
  log, success, warn, isInPath, confirm
} from "../helpers.js"
import type { InstallerContext, InstallerResult } from "../types.js"

const REPO = "Gentleman-Programming/gentleman-guardian-angel"
const BRANCH = "main"

async function downloadGGA(cacheDir: string): Promise<string> {
  const archivePath = join(cacheDir, "gga.tar.gz")
  const url = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz`

  log("Descargando Guardian Angel...")
  await downloadFile(url, archivePath)

  const extractDir = join(cacheDir, "gga-extract")
  await extractTarGz(archivePath, extractDir)

  // GitHub archive extracts to gentleman-guardian-angel-main/
  const innerDir = join(extractDir, `gentleman-guardian-angel-${BRANCH}`)
  if (!existsSync(innerDir)) {
    const entries = readdirSync(extractDir)
    const found = entries.find(e => e.toLowerCase().includes("guardian"))
    if (found) return join(extractDir, found)
    throw new Error("No se encontro el directorio de GGA en el archivo descargado")
  }
  return innerDir
}

export async function installGuardianAngel(ctx: InstallerContext): Promise<InstallerResult> {
  const warnings: string[] = []

  // Verificar que es un repo git
  const gitDir = join(ctx.projectRoot, ".git")
  if (!existsSync(gitDir)) {
    return {
      component: "Guardian Angel",
      success: false,
      message: "No es un repositorio git — GGA necesita git hooks"
    }
  }

  // Check si ya está instalado
  const existingCheck = await exec("gga", ["--version"], { timeout: 5000 })
  if (existingCheck.code === 0) {
    log("GGA ya instalado, configurando...")
    return await configureGGA(ctx, warnings)
  }

  // Descargar
  let ggaDir: string
  try {
    ggaDir = await downloadGGA(ctx.cacheDir)
  } catch (e) {
    return {
      component: "Guardian Angel",
      success: false,
      message: `Error descargando: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  // Instalar binary
  const binSource = join(ggaDir, "bin", "gga")
  const binDest = join(ctx.binDir, "gga")
  if (!existsSync(binSource)) {
    return {
      component: "Guardian Angel",
      success: false,
      message: "Binary gga no encontrado en el archivo descargado"
    }
  }

  ensureDir(ctx.binDir)
  const binContent = readFileSync(binSource, "utf-8")
  writeFileSync(binDest, binContent, "utf-8")
  chmodSync(binDest, 0o755)

  // Instalar libs
  const libDir = join(ctx.homeDir, ".local", "share", "gga", "lib")
  ensureDir(libDir)

  const libSource = join(ggaDir, "lib")
  if (existsSync(libSource)) {
    const libs = readdirSync(libSource).filter(f => f.endsWith(".sh"))
    for (const lib of libs) {
      const content = readFileSync(join(libSource, lib), "utf-8")
      writeFileSync(join(libDir, lib), content, "utf-8")
      chmodSync(join(libDir, lib), 0o755)
    }

    // Inyectar LIB_DIR en el binary instalado
    let ggaScript = readFileSync(binDest, "utf-8")
    ggaScript = ggaScript.replace(
      /LIB_DIR="[^"]*"/,
      `LIB_DIR="${libDir}"`
    )
    writeFileSync(binDest, ggaScript, "utf-8")
  }

  success(`GGA instalado en ${binDest}`)

  // Verificar PATH
  if (!isInPath(ctx.binDir)) {
    warnings.push(
      `${ctx.binDir} no esta en tu PATH. Agrega:`,
      `  export PATH="$PATH:${ctx.binDir}"`
    )
    for (const w of warnings) warn(w)
  }

  return await configureGGA(ctx, warnings)
}

async function configureGGA(ctx: InstallerContext, warnings: string[]): Promise<InstallerResult> {
  // Verificar si ya tiene config
  const configPath = join(ctx.projectRoot, ".gga")
  if (existsSync(configPath)) {
    log("GGA ya configurado en este proyecto")
    return {
      component: "Guardian Angel",
      success: true,
      message: "Instalado (config existente)",
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  // Crear config por defecto
  const setupHook = await confirm("  Instalar pre-commit hook de Guardian Angel?")

  if (setupHook) {
    // gga init
    const initResult = await exec("gga", ["init"], {
      cwd: ctx.projectRoot,
      timeout: 10_000
    })

    if (initResult.code !== 0) {
      // Crear config manualmente si gga init falla
      const defaultConfig = [
        '# Guardian Angel config',
        'PROVIDER="claude"',
        'FILE_PATTERNS="*.ts,*.tsx,*.js,*.jsx"',
        'EXCLUDE_PATTERNS="*.test.ts,*.spec.ts,*.d.ts"',
        'RULES_FILE="AGENTS.md"',
        'STRICT_MODE="true"',
        'TIMEOUT="300"'
      ].join("\n") + "\n"
      writeFileSync(configPath, defaultConfig, "utf-8")
      success("Config .gga creada")
    } else {
      success("GGA inicializado")
    }

    // gga install (pre-commit hook)
    const installResult = await exec("gga", ["install"], {
      cwd: ctx.projectRoot,
      timeout: 10_000
    })

    if (installResult.code === 0) {
      success("Pre-commit hook instalado")
    } else {
      warnings.push("No se pudo instalar el pre-commit hook automaticamente. Ejecuta: gga install")
    }
  }

  return {
    component: "Guardian Angel",
    success: true,
    message: setupHook ? "Instalado con pre-commit hook" : "Instalado (sin hook)",
    warnings: warnings.length > 0 ? warnings : undefined
  }
}
