import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { scanRoutes } from "../../scanner/routes.js"
import { scanActions } from "../../scanner/actions.js"
import { scanPrismaSchemas } from "../../scanner/prisma.js"
import { scanComponents } from "../../scanner/components.js"
import { invalidate } from "../../scanner/cache.js"
import { config } from "../../config.js"

export function registerProjectTools(server: McpServer): void {

  // ─── project_scan ──────────────────────────────────────────────────────────
  server.registerTool("project_scan", {
    title: "Escanear proyecto completo",
    description: `Escanea el proyecto y devuelve un resumen de rutas, Server Actions,
schemas de Prisma y componentes instalados. Útil al inicio de una sesión
para tener el mapa completo del proyecto.

Returns: resumen con conteos y listado de entidades por categoría.`,
    inputSchema: z.object({
      force_refresh: z.boolean().default(false)
        .describe("Forzar re-escaneo ignorando el cache")
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ force_refresh }) => {
    if (force_refresh) invalidate()

    const [routes, actions, models, components] = await Promise.all([
      scanRoutes(),
      scanActions(),
      scanPrismaSchemas(),
      scanComponents()
    ])

    const summary = {
      projectRoot: config.projectRoot,
      routes: {
        total: routes.length,
        pages: routes.filter(r => r.type === "page").length,
        apiHandlers: routes.filter(r => r.type === "route-handler").length,
        dynamic: routes.filter(r => r.dynamicParams.length > 0).length,
        clientComponents: routes.filter(r => r.rendering === "client").length
      },
      actions: {
        total: actions.length,
        withAuth: actions.filter(a => a.hasAuth).length,
        withZod: actions.filter(a => a.zodSchema).length
      },
      prisma: {
        totalModels: models.length,
        bySchema: Object.fromEntries(
          [...new Set(models.map(m => m.schema))].map(s => [
            s, models.filter(m => m.schema === s).length
          ])
        )
      },
      components: {
        shadcnInstalled: components.ui.length,
        custom: components.custom.length,
        byFeature: Object.fromEntries(
          [...new Set(components.custom.map(c => c.feature))].map(f => [
            f, components.custom.filter(c => c.feature === f).length
          ])
        )
      }
    }

    const text = [
      `## Proyecto: ${config.projectRoot.split("/").pop()}`,
      ``,
      `### Rutas (${summary.routes.total})`,
      `- Páginas: ${summary.routes.pages} · API handlers: ${summary.routes.apiHandlers}`,
      `- Rutas dinámicas: ${summary.routes.dynamic} · Client components: ${summary.routes.clientComponents}`,
      ``,
      `### Server Actions (${summary.actions.total})`,
      `- Con autenticación: ${summary.actions.withAuth} · Con validación Zod: ${summary.actions.withZod}`,
      ``,
      `### Prisma (${summary.prisma.totalModels} modelos)`,
      ...Object.entries(summary.prisma.bySchema).map(([s, n]) => `- Schema ${s}: ${n} modelos`),
      ``,
      `### Componentes`,
      `- shadcn/ui instalados: ${summary.components.shadcnInstalled}`,
      `- Componentes propios: ${summary.components.custom}`,
    ].join("\n")

    return { content: [{ type: "text", text }], structuredContent: summary }
  })

  // ─── project_routes ────────────────────────────────────────────────────────
  server.registerTool("project_routes", {
    title: "Listar rutas del proyecto",
    description: `Lista todas las rutas del App Router con sus propiedades.
Útil para entender la estructura de navegación antes de crear una página nueva
o agregar un route handler.

Args:
  - filter: filtrar por "pages", "api", o "all" (default)
  - dynamic_only: mostrar solo rutas con parámetros dinámicos

Returns: array de rutas con path, tipo, rendering, params dinámicos.`,
    inputSchema: z.object({
      filter: z.enum(["all", "pages", "api"]).default("all"),
      dynamic_only: z.boolean().default(false)
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ filter, dynamic_only }) => {
    let routes = await scanRoutes()

    if (filter === "pages") routes = routes.filter(r => r.type === "page")
    if (filter === "api") routes = routes.filter(r => r.type === "route-handler")
    if (dynamic_only) routes = routes.filter(r => r.dynamicParams.length > 0)

    const text = routes.map(r => {
      const flags = [
        r.rendering === "client" ? "client" : "rsc",
        r.dynamicParams.length > 0 ? `[${r.dynamicParams.join(", ")}]` : null,
        r.methods ? r.methods.join("|") : null,
        r.hasLoading ? "loading" : null,
        r.hasError ? "error" : null,
      ].filter(Boolean).join(" · ")
      return `${r.path}  ${flags}`
    }).join("\n")

    return {
      content: [{ type: "text", text: routes.length > 0 ? text : "No se encontraron rutas." }],
      structuredContent: { routes, total: routes.length }
    }
  })

  // ─── project_actions ───────────────────────────────────────────────────────
  server.registerTool("project_actions", {
    title: "Listar Server Actions",
    description: `Lista todas las Server Actions del proyecto con sus schemas de validación.
Útil antes de crear una nueva action para ver los patrones existentes
y evitar duplicaciones.

Returns: array de actions con nombre, archivo, schema Zod, parámetros y flags.`,
    inputSchema: z.object({
      feature: z.string().optional()
        .describe("Filtrar por feature (ej: 'users', 'posts')")
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ feature }) => {
    let actions = await scanActions()

    if (feature) {
      actions = actions.filter(a =>
        a.file.toLowerCase().includes(feature.toLowerCase())
      )
    }

    const text = actions.map(a => {
      const flags = [
        a.hasAuth ? "auth" : "no-auth",
        a.zodSchema ? `zod:${a.zodSchema}` : "no-zod",
        a.hasRevalidate ? "revalidates" : null
      ].filter(Boolean).join(" · ")
      return `${a.name}  (${a.file})  ${flags}`
    }).join("\n")

    return {
      content: [{ type: "text", text: actions.length > 0 ? text : "No se encontraron Server Actions." }],
      structuredContent: { actions, total: actions.length }
    }
  })

  // ─── project_models ────────────────────────────────────────────────────────
  server.registerTool("project_models", {
    title: "Listar modelos de Prisma",
    description: `Lista todos los modelos de Prisma con sus campos y schema.
Útil antes de crear una relación, migration, o Server Action
para conocer la estructura exacta de los datos.

Args:
  - schema: filtrar por schema (auth | rbac | audit | base)
  - model_name: buscar un modelo específico por nombre

Returns: modelos con campos, tipos, relaciones y atributos.`,
    inputSchema: z.object({
      schema: z.enum(["auth", "rbac", "audit", "base"]).optional(),
      model_name: z.string().optional()
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ schema, model_name }) => {
    let models = await scanPrismaSchemas()

    if (schema) models = models.filter(m => m.schema === schema)
    if (model_name) models = models.filter(m =>
      m.name.toLowerCase().includes(model_name.toLowerCase())
    )

    const text = models.map(m => {
      const fields = m.fields
        .filter(f => !f.isRelation)
        .map(f => `  ${f.name}: ${f.type}${f.isOptional ? "?" : ""}${f.isArray ? "[]" : ""}`)
        .join("\n")
      const relations = m.fields
        .filter(f => f.isRelation)
        .map(f => `  ${f.name} → ${f.type}`)
        .join("\n")

      return [
        `### ${m.name} (@schema: ${m.schema})`,
        fields,
        relations ? `  --- relaciones ---\n${relations}` : ""
      ].filter(Boolean).join("\n")
    }).join("\n\n")

    return {
      content: [{ type: "text", text: models.length > 0 ? text : "No se encontraron modelos." }],
      structuredContent: { models, total: models.length }
    }
  })
}
