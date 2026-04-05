import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { existsSync } from "node:fs"
import { config } from "../config.js"
import { cached } from "./cache.js"

export interface InstalledComponent {
  name: string          // ej: "Button", "Card", "DataTable"
  file: string
  exports: string[]     // todos los exports del componente
  usesRadix: boolean
  usesCva: boolean
}

export interface CustomComponent {
  name: string
  file: string
  feature: string       // feature a la que pertenece
  isClient: boolean
}

async function scanUiComponents(): Promise<InstalledComponent[]> {
  const uiDir = join(config.projectRoot, config.scanner.componentsUiDir)
  if (!existsSync(uiDir)) return []

  const entries = await readdir(uiDir, { withFileTypes: true }).catch(() => [])
  const components: InstalledComponent[] = []

  for (const entry of entries) {
    if (!entry.isFile() || (!entry.name.endsWith(".tsx") && !entry.name.endsWith(".ts"))) continue

    const filePath = join(uiDir, entry.name)
    const content = await readFile(filePath, "utf-8").catch(() => "")
    if (!content) continue

    // Extraer exports nombrados
    const exports = [...content.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)]
      .map(m => m[1] ?? "")
      .filter(Boolean)

    const name = entry.name.replace(/\.(tsx?|jsx?)$/, "")
    components.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      file: relative(config.projectRoot, filePath),
      exports,
      usesRadix: content.includes("@radix-ui"),
      usesCva: content.includes("cva(") || content.includes("class-variance-authority")
    })
  }

  return components.sort((a, b) => a.name.localeCompare(b.name))
}

async function walkForCustom(dir: string, feature: string): Promise<CustomComponent[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const components: CustomComponent[] = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      components.push(...await walkForCustom(full, entry.name))
    } else if ((entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx")) &&
               !entry.name.endsWith(".test.tsx") &&
               !entry.name.endsWith(".spec.tsx")) {
      const content = await readFile(full, "utf-8").catch(() => "")
      const name = entry.name.replace(/\.(tsx?|jsx?)$/, "")
      components.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        file: relative(config.projectRoot, full),
        feature,
        isClient: content.slice(0, 200).includes('"use client"')
      })
    }
  }

  return components
}

export async function scanComponents(): Promise<{
  ui: InstalledComponent[]
  custom: CustomComponent[]
}> {
  return cached("components", async () => {
    const [ui, custom] = await Promise.all([
      scanUiComponents(),
      (async () => {
        const componentsDir = join(config.projectRoot, "src/components")
        if (!existsSync(componentsDir)) return []
        const entries = await readdir(componentsDir, { withFileTypes: true })
        const featureDirs = entries.filter(e =>
          e.isDirectory() && e.name !== "ui"
        )
        const results = await Promise.all(
          featureDirs.map(e => walkForCustom(join(componentsDir, e.name), e.name))
        )
        return results.flat()
      })()
    ])

    return { ui, custom }
  })
}
