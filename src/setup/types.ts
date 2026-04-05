/**
 * Tipos compartidos para el setup interactivo.
 */

export interface ComponentDef {
  id: string
  name: string
  description: string
  defaultSelected: boolean
}

export interface SkillTarget {
  name: string
  dir: string
  detected: boolean
}

export interface InstallerContext {
  projectRoot: string
  homeDir: string
  binDir: string        // ~/.local/bin
  cacheDir: string      // ~/.cache/project-mcp-server
  skillTargets: SkillTarget[]
}

export interface InstallerResult {
  component: string
  success: boolean
  message: string
  warnings?: string[]
}

export type InstallerFn = (ctx: InstallerContext) => Promise<InstallerResult>
