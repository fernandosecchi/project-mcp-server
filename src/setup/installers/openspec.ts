/**
 * Installer: OpenSpec
 * Spec-Driven Development workflow via @fission-ai/openspec.
 * Shell out a npx para no arrastrar dependencias.
 */

import { exec, log } from "../helpers.js"
import type { InstallerContext, InstallerResult } from "../types.js"

export async function installOpenSpec(ctx: InstallerContext): Promise<InstallerResult> {
  log("Ejecutando OpenSpec init...")

  // Intenta correr npx con --tools=claude (non-interactive)
  const result = await exec("npx", ["-y", "@fission-ai/openspec", "init", "--tools=claude"], {
    cwd: ctx.projectRoot,
    timeout: 120_000
  })

  if (result.code !== 0) {
    // Puede fallar porque necesita interacción — reintentamos con spawn interactivo
    const retryResult = await exec("npx", ["-y", "@fission-ai/openspec", "init"], {
      cwd: ctx.projectRoot,
      timeout: 120_000
    })

    if (retryResult.code !== 0) {
      return {
        component: "OpenSpec",
        success: false,
        message: "No se pudo ejecutar openspec init",
        warnings: [retryResult.stderr.slice(0, 200)]
      }
    }
  }

  return {
    component: "OpenSpec",
    success: true,
    message: "Spec-Driven Development configurado"
  }
}
