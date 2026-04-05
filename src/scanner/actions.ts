import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { existsSync } from "node:fs"
import { config } from "../config.js"
import { cached } from "./cache.js"

export interface ServerAction {
  name: string
  file: string          // ruta relativa al projectRoot
  zodSchema?: string    // nombre del schema Zod si se detecta
  params: string[]      // parámetros de la función
  hasAuth: boolean      // si llama a auth()
  hasRevalidate: boolean
}

function extractFunctions(content: string): Array<{ name: string; params: string[] }> {
  const results: Array<{ name: string; params: string[] }> = []

  // Detectar exports de async functions
  const fnRegex = /export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null

  while ((match = fnRegex.exec(content)) !== null) {
    const name = match[1] ?? ""
    const rawParams = match[2] ?? ""
    const params = rawParams
      .split(",")
      .map(p => p.trim().split(":")[0]?.trim() ?? "")
      .filter(p => p.length > 0 && p !== "_")
    results.push({ name, params })
  }

  return results
}

function detectZodSchema(content: string, fnName: string): string | undefined {
  // Buscar patrones como: const parsed = XxxSchema.safeParse(...) o XxxSchema.parse(...)
  const patterns = [
    /const\s+\w+\s*=\s*(\w+Schema)\.(?:safe)?[Pp]arse/g,
    /(\w+Schema)\.(?:safe)?[Pp]arse\(/g,
    new RegExp(`${fnName}Schema`, "g")
  ]

  for (const pattern of patterns) {
    const m = pattern.exec(content)
    if (m) return m[1]
  }
  return undefined
}

async function scanFile(filePath: string): Promise<ServerAction[]> {
  const content = await readFile(filePath, "utf-8").catch(() => "")
  if (!content) return []

  // Verificar que tiene "use server"
  const first300 = content.slice(0, 300)
  if (!first300.includes('"use server"') && !first300.includes("'use server'")) return []

  const relativePath = relative(config.projectRoot, filePath)
  const functions = extractFunctions(content)

  return functions.map(({ name, params }) => ({
    name,
    file: relativePath,
    zodSchema: detectZodSchema(content, name),
    params,
    hasAuth: content.includes("await auth()") || content.includes("const session = await auth"),
    hasRevalidate: content.includes("revalidateTag(") || content.includes("revalidatePath(")
  }))
}

async function walkDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walkDir(full))
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full)
  }
  return files
}

export async function scanActions(): Promise<ServerAction[]> {
  return cached("actions", async () => {
    const actionsDir = join(config.projectRoot, config.scanner.actionsDir)
    if (!existsSync(actionsDir)) return []

    const files = await walkDir(actionsDir)
    const results = await Promise.all(files.map(scanFile))
    return results.flat().sort((a, b) => a.name.localeCompare(b.name))
  })
}
