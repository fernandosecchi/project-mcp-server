/**
 * Helpers compartidos para el setup interactivo.
 * Extraídos del setup.ts original + utilidades nuevas para descarga/instalación.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { createInterface } from "node:readline"
import { homedir, platform, arch } from "node:os"
import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import type { SkillTarget } from "./types.js"

export const __setupDir = dirname(fileURLToPath(import.meta.url))
export const SKILLS_DIR = join(__setupDir, "..", "..", "skills")
export const HOME = homedir()
export const PKG_NAME = "project-mcp-server"

// ─── I/O Helpers ────────────────────────────────────────────────────────────

export function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(r => {
    rl.on("close", () => r(""))
    rl.question(question, answer => {
      rl.close()
      r(answer.trim())
    })
  })
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]"
  const answer = await ask(`${question} ${hint} `)
  if (answer === "") return defaultYes
  return answer.toLowerCase().startsWith("y")
}

// ─── File Helpers ───────────────────────────────────────────────────────────

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function writeJson(path: string, data: Record<string, unknown>): void {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

// ─── Console Helpers ────────────────────────────────────────────────────────

export function log(msg: string): void {
  console.log(`  ${msg}`)
}

export function success(msg: string): void {
  console.log(`  \u2713 ${msg}`)
}

export function warn(msg: string): void {
  console.log(`  \u26A0 ${msg}`)
}

export function error(msg: string): void {
  console.log(`  \u2717 ${msg}`)
}

// ─── Skill Targets ──────────────────────────────────────────────────────────

export function detectSkillTargets(): SkillTarget[] {
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

// ─── Project Detection ──────────────────────────────────────────────────────

export async function detectProjectRoot(): Promise<string> {
  let projectRoot = process.cwd()
  const markers = ["next.config.ts", "next.config.js", "next.config.mjs", "package.json"]
  const isProject = markers.some(m => existsSync(join(projectRoot, m)))

  if (isProject) {
    const useThis = await confirm(`Proyecto detectado: ${projectRoot}\n  \u00BFUsar este directorio?`)
    if (!useThis) {
      const custom = await ask("  Ruta al proyecto: ")
      projectRoot = resolve(custom)
    }
  } else {
    const custom = await ask("  Ruta al proyecto: ")
    projectRoot = resolve(custom)
  }

  if (!existsSync(projectRoot)) {
    console.error(`  \u2717 No existe: ${projectRoot}`)
    process.exit(1)
  }

  return resolve(projectRoot)
}

// ─── Platform Detection ─────────────────────────────────────────────────────

export interface PlatformInfo {
  os: "darwin" | "linux" | "windows"
  arch: "amd64" | "arm64"
}

export function detectPlatform(): PlatformInfo {
  const p = platform()
  const a = arch()

  const osMap: Record<string, PlatformInfo["os"]> = {
    darwin: "darwin",
    linux: "linux",
    win32: "windows"
  }

  const archMap: Record<string, PlatformInfo["arch"]> = {
    x64: "amd64",
    arm64: "arm64"
  }

  return {
    os: osMap[p] ?? "linux",
    arch: archMap[a] ?? "amd64"
  }
}

// ─── Shell Execution ────────────────────────────────────────────────────────

export interface ExecResult {
  code: number
  stdout: string
  stderr: string
}

export function exec(cmd: string, args: string[], opts?: { cwd?: string; timeout?: number }): Promise<ExecResult> {
  return new Promise(r => {
    execFile(cmd, args, {
      cwd: opts?.cwd,
      timeout: opts?.timeout ?? 60_000,
      maxBuffer: 10 * 1024 * 1024
    }, (err, stdout, stderr) => {
      r({
        code: err && "code" in err ? (err.code as number) : err ? 1 : 0,
        stdout: stdout?.toString() ?? "",
        stderr: stderr?.toString() ?? ""
      })
    })
  })
}

// ─── Download ───────────────────────────────────────────────────────────────

export async function downloadFile(url: string, dest: string): Promise<void> {
  ensureDir(dirname(dest))
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`)
  if (!response.body) throw new Error(`No body in response: ${url}`)
  const fileStream = createWriteStream(dest)
  const reader = response.body.getReader()
  const write = (chunk: Uint8Array): boolean => fileStream.write(chunk)

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) write(value)
  }

  await new Promise<void>((resolve, reject) => {
    fileStream.on("finish", resolve)
    fileStream.on("error", reject)
    fileStream.end()
  })
}

export async function extractTarGz(archive: string, destDir: string): Promise<void> {
  ensureDir(destDir)
  const result = await exec("tar", ["xzf", archive, "-C", destDir])
  if (result.code !== 0) throw new Error(`Extract failed: ${result.stderr}`)
}

// ─── PATH Check ─────────────────────────────────────────────────────────────

export function isInPath(dir: string): boolean {
  const pathDirs = (process.env["PATH"] ?? "").split(":")
  return pathDirs.includes(dir)
}
