import { readdir, readFile } from "node:fs/promises"
import { join, relative, dirname } from "node:path"
import { existsSync } from "node:fs"
import { config } from "../config.js"
import { cached } from "./cache.js"

export interface AppRoute {
  path: string          // ruta URL, ej: /dashboard/[id]
  fsPath: string        // ruta relativa en el filesystem
  type: "page" | "layout" | "route-handler"
  rendering: "rsc" | "client" | "unknown"
  dynamicParams: string[]
  hasLoading: boolean
  hasError: boolean
  methods?: string[]    // solo para route handlers: GET, POST, etc.
}

async function walkDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: string[] = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Ignorar grupos de rutas (parenthesis) y carpetas privadas (_)
      files.push(...await walkDir(full))
    } else if (entry.isFile()) {
      files.push(full)
    }
  }

  return files
}

function extractDynamicParams(path: string): string[] {
  return [...path.matchAll(/\[([^\]]+)\]/g)].map(m => m[1] ?? "").filter(Boolean)
}

function filePathToRoute(filePath: string, appDir: string): string {
  const rel = relative(appDir, dirname(filePath))
  return "/" + rel
    .replace(/\\/g, "/")
    .replace(/\([\w-]+\)\//g, "") // eliminar grupos (auth)/ etc.
    .replace(/\/$/, "")
    || "/"
}

async function detectRendering(filePath: string): Promise<"rsc" | "client" | "unknown"> {
  try {
    const content = await readFile(filePath, "utf-8")
    const firstLines = content.slice(0, 500)
    if (firstLines.includes('"use client"') || firstLines.includes("'use client'")) return "client"
    if (firstLines.includes("export default async function") || firstLines.includes("async function")) return "rsc"
    return "unknown"
  } catch {
    return "unknown"
  }
}

async function extractHandlerMethods(filePath: string): Promise<string[]> {
  try {
    const content = await readFile(filePath, "utf-8")
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
    return methods.filter(m => {
      return content.includes(`export async function ${m}`) ||
             content.includes(`export function ${m}`)
    })
  } catch {
    return []
  }
}

export async function scanRoutes(): Promise<AppRoute[]> {
  return cached("routes", async () => {
    const appDir = join(config.projectRoot, config.scanner.appDir)
    if (!existsSync(appDir)) return []

    const files = await walkDir(appDir)
    const routes: AppRoute[] = []

    for (const file of files) {
      const name = file.split("/").pop() ?? ""

      if (name === "page.tsx" || name === "page.ts" || name === "page.jsx") {
        const routePath = filePathToRoute(file, appDir)
        const dir = dirname(file)
        routes.push({
          path: routePath,
          fsPath: relative(config.projectRoot, file),
          type: "page",
          rendering: await detectRendering(file),
          dynamicParams: extractDynamicParams(routePath),
          hasLoading: existsSync(join(dir, "loading.tsx")) || existsSync(join(dir, "loading.ts")),
          hasError: existsSync(join(dir, "error.tsx")) || existsSync(join(dir, "error.ts"))
        })
      }

      if (name === "route.ts" || name === "route.tsx") {
        const routePath = filePathToRoute(file, appDir)
        routes.push({
          path: routePath,
          fsPath: relative(config.projectRoot, file),
          type: "route-handler",
          rendering: "rsc",
          dynamicParams: extractDynamicParams(routePath),
          hasLoading: false,
          hasError: false,
          methods: await extractHandlerMethods(file)
        })
      }
    }

    return routes.sort((a, b) => a.path.localeCompare(b.path))
  })
}
