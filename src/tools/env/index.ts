import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { access } from "node:fs/promises"
import { join } from "node:path"
import { config } from "../../config.js"

const execAsync = promisify(exec)

async function run(cmd: string, cwd?: string): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: cwd ?? config.projectRoot,
      timeout: 30_000
    })
    return { ok: true, output: (stdout + stderr).trim() }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      output: ((e.stdout ?? "") + (e.stderr ?? "") + (e.message ?? "")).trim()
    }
  }
}

export function registerEnvTools(server: McpServer): void {

  // ─── env_status ────────────────────────────────────────────────────────────
  server.registerTool("env_status", {
    title: "Estado del entorno de desarrollo",
    description: `Verifica el estado del entorno: Docker, .env.local y herramientas de desarrollo.
Llamar al inicio de una sesión para detectar problemas antes de codear.

Returns: estado de cada servicio con detalles de errores si los hay.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async () => {
    const [dockerPs, pnpmInstalled] = await Promise.all([
      run("docker compose ps --format json"),
      run("pnpm --version")
    ])

    // Verificar .env.local
    const envPath = join(config.projectRoot, ".env.local")
    let envExists = false
    try { await access(envPath); envExists = true } catch { /* no existe */ }

    // Parsear docker compose status
    let dockerServices: Array<{ name: string; status: string }> = []
    if (dockerPs.ok && dockerPs.output) {
      try {
        dockerServices = dockerPs.output
          .split("\n")
          .filter(Boolean)
          .map(line => JSON.parse(line) as { Name: string; Status: string })
          .map(s => ({ name: s.Name, status: s.Status }))
      } catch { /* format varies */ }
    }

    const status = {
      ok: envExists,
      docker: { running: dockerPs.ok, services: dockerServices },
      env_file: { exists: envExists, path: ".env.local" },
      pnpm: { ok: pnpmInstalled.ok, version: pnpmInstalled.output }
    }

    const lines = [
      `## Estado del entorno`,
      ``,
      dockerPs.ok ? `✓ Docker Compose activo (${dockerServices.length} servicios)` : `✗ Docker Compose no responde`,
      ...dockerServices.map(s => `  ${s.status.includes("Up") ? "↑" : "↓"} ${s.name}: ${s.status}`),
      envExists ? `✓ .env.local presente` : `✗ .env.local no encontrado`,
      pnpmInstalled.ok ? `✓ pnpm ${pnpmInstalled.output}` : `✗ pnpm no disponible`,
    ]

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: status
    }
  })

  // ─── env_run_check ─────────────────────────────────────────────────────────
  server.registerTool("env_run_check", {
    title: "Ejecutar verificaciones de calidad",
    description: `Ejecuta type-check, lint o tests en el proyecto y devuelve el resultado.
Usar antes de hacer commit o cuando el agente necesita verificar
que los cambios no rompieron nada.

Args:
  - check: qué verificación ejecutar
  - scope: ruta específica a verificar (opcional, ej: "src/app/dashboard")

Returns: resultado del comando con errores y warnings.`,
    inputSchema: z.object({
      check: z.enum(["typecheck", "lint", "test", "build"]),
      scope: z.string().optional()
        .describe("Ruta específica a verificar (relativa al proyecto)")
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ check, scope }) => {
    const commands: Record<string, string> = {
      typecheck: "pnpm tsc --noEmit",
      lint: scope ? `pnpm eslint ${scope}` : "pnpm lint",
      test: scope ? `pnpm test ${scope}` : "pnpm test --run",
      build: "pnpm build"
    }

    const cmd = commands[check] ?? commands["typecheck"]!
    const result = await run(cmd)

    const lines = [
      `## ${check} ${result.ok ? "✓" : "✗"}`,
      ``,
      result.output || "(sin output)"
    ]

    if (!result.ok) {
      lines.push("", `El check falló. Revisá los errores antes de continuar.`)
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: { check, ok: result.ok, output: result.output }
    }
  })

  // ─── env_prisma_status ─────────────────────────────────────────────────────
  server.registerTool("env_prisma_status", {
    title: "Estado de migraciones de Prisma",
    description: `Verifica si hay migraciones pendientes y el estado actual de la DB.
Llamar antes de arrancar trabajo con la base de datos o cuando
hay cambios en los schemas de Prisma.

Returns: migraciones aplicadas, pendientes y estado de conexión.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async () => {
    const result = await run("pnpm prisma migrate status")

    const hasPending = result.output.includes("following migration") &&
                       result.output.includes("have not yet been applied")
    const isInSync = result.output.includes("Database schema is up to date")

    const lines = [
      `## Estado de Prisma`,
      ``,
      isInSync ? `✓ Schema sincronizado — sin migraciones pendientes` :
      hasPending ? `✗ Hay migraciones pendientes — correr: pnpm prisma migrate dev` :
      `? Estado desconocido`,
      ``,
      result.output
    ]

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: {
        inSync: isInSync,
        hasPending,
        output: result.output
      }
    }
  })
}
