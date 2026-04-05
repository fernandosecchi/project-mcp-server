import { existsSync } from "node:fs"
import { resolve } from "node:path"

function requireEnv(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback
  if (!val) throw new Error(`Variable de entorno requerida: ${name}`)
  return val
}

function resolveProjectRoot(): string {
  const fromEnv = process.env["MCP_PROJECT_ROOT"]
  if (fromEnv && existsSync(fromEnv)) return resolve(fromEnv)

  // Detectar desde cwd buscando indicadores del proyecto
  const cwd = process.cwd()
  const markers = ["CLAUDE.md", "next.config.ts", "next.config.js", "package.json"]
  for (const marker of markers) {
    if (existsSync(resolve(cwd, marker))) return cwd
  }

  return cwd
}

export const config = {
  projectRoot: resolveProjectRoot(),

  scanner: {
    // Rutas relativas al projectRoot
    appDir: "src/app",
    actionsDir: "server/actions",
    schemasDir: "src/types/schemas",
    componentsUiDir: "src/components/ui",
    prismaDir: "prisma/schema",
    cacheTtlMs: 30_000 // 30 segundos
  },

  skills: {
    // Directorio de skills relativo a este archivo compilado
    dir: new URL("../skills", import.meta.url).pathname
  }
} as const

export type Config = typeof config
