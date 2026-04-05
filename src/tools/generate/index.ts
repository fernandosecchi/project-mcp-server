import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { scanPrismaSchemas } from "../../scanner/prisma.js"
import { scanActions } from "../../scanner/actions.js"
import { scanRoutes } from "../../scanner/routes.js"

function toPascalCase(str: string): string {
  return str.replace(/(^\w|[-_\s]\w)/g, m => m.replace(/[-_\s]/, "").toUpperCase())
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function registerGenerateTools(server: McpServer): void {

  // ─── generate_action ───────────────────────────────────────────────────────
  server.registerTool("generate_action", {
    title: "Generar Server Action",
    description: `Genera una Server Action siguiendo los patrones del proyecto:
- "use server" al inicio
- Validación con Zod 4 usando safeParse
- Autenticación con auth() de NextAuth si se requiere
- Tipos de retorno explícitos
- Revalidación de cache si aplica

Args:
  - entity: nombre de la entidad (ej: "user", "post", "invoice")
  - operation: tipo de operación CRUD
  - with_auth: si requiere sesión autenticada (default: true)
  - prisma_schema: en qué schema de Prisma está la entidad

Returns: código TypeScript listo para copiar a server/actions/[entity].ts`,
    inputSchema: z.object({
      entity: z.string().min(1).describe("Nombre de la entidad en singular (ej: 'user')"),
      operation: z.enum(["create", "update", "delete", "get", "list"]),
      with_auth: z.boolean().default(true),
      prisma_schema: z.enum(["auth", "rbac", "audit", "base"]).default("base")
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ entity, operation, with_auth, prisma_schema }) => {
    const pascal = toPascalCase(entity)
    const camel = toCamelCase(entity)

    // Buscar el modelo en Prisma para conocer los campos
    const models = await scanPrismaSchemas()
    const model = models.find(m => m.name.toLowerCase() === entity.toLowerCase())

    // Campos de datos (no relaciones, no id, no timestamps)
    const dataFields = model?.fields.filter(f =>
      !f.isRelation && f.name !== "id" &&
      f.name !== "createdAt" && f.name !== "updatedAt"
    ) ?? []

    const zodFields = dataFields.length > 0
      ? dataFields.map(f => {
          const base = f.type === "String" ? "z.string().min(1)" :
                       f.type === "Int" ? "z.number().int()" :
                       f.type === "Boolean" ? "z.boolean()" :
                       f.type === "DateTime" ? "z.coerce.date()" : "z.string()"
          return `  ${f.name}: ${f.isOptional ? base + ".optional()" : base}`
        }).join(",\n")
      : `  // Agregá los campos de ${pascal} acá`

    const schemaImport = prisma_schema === "base"
      ? `import { prismaPostgres } from "@/lib/db/postgres"`
      : `import { prismaPostgres } from "@/lib/db/postgres"`

    const authBlock = with_auth ? `
  const session = await auth()
  if (!session?.user) return { success: false, error: "No autenticado" }
` : ""

    const authImport = with_auth ? `\nimport { auth } from "@/lib/auth"` : ""

    let body: string

    switch (operation) {
      case "create":
        body = `
  const parsed = ${pascal}Schema.safeParse({
${dataFields.map(f => `    ${f.name}: formData.get("${f.name}")`).join(",\n") || `    // extraer campos de formData`}
  })
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors }

  const ${camel} = await prismaPostgres.${camel}.create({ data: parsed.data })
  revalidateTag("${camel}s")
  return { success: true, data: ${camel} }`

        break
      case "update":
        body = `
  const parsed = ${pascal}Schema.partial().safeParse({
${dataFields.map(f => `    ${f.name}: formData.get("${f.name}")`).join(",\n") || `    // extraer campos de formData`}
  })
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors }

  const ${camel} = await prismaPostgres.${camel}.update({
    where: { id },
    data: parsed.data
  })
  revalidateTag("${camel}s")
  return { success: true, data: ${camel} }`

        break
      case "delete":
        body = `
  await prismaPostgres.${camel}.delete({ where: { id } })
  revalidateTag("${camel}s")
  return { success: true }`

        break
      case "get":
        body = `
  const ${camel} = await prismaPostgres.${camel}.findUnique({
    where: { id },
    select: {
      id: true,
${dataFields.map(f => `      ${f.name}: true`).join(",\n") || "      // seleccionar campos necesarios"}
    }
  })
  if (!${camel}) return { success: false, error: "${pascal} no encontrado" }
  return { success: true, data: ${camel} }`

        break
      case "list":
        body = `
  const ${camel}s = await prismaPostgres.${camel}.findMany({
    select: {
      id: true,
${dataFields.slice(0, 4).map(f => `      ${f.name}: true`).join(",\n") || "      // seleccionar campos necesarios"}
    },
    orderBy: { ${model?.hasTimestamps ? "createdAt" : "id"}: "desc" },
    take: 50
  })
  return { success: true, data: ${camel}s }`

        break
      default:
        body = `  // implementar lógica acá`
    }

    const params = operation === "update" || operation === "delete" || operation === "get"
      ? `id: string${operation === "update" ? ", formData: FormData" : ""}`
      : operation === "create" ? "formData: FormData" : ""

    const code = `"use server"

import { z } from "zod"
import { revalidateTag } from "next/cache"${authImport}
${schemaImport}

const ${pascal}Schema = z.object({
${zodFields}
})

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: Record<string, string[]> | string }

export async function ${operation}${pascal}(${params}): Promise<ActionResult> {${authBlock}${body}
}`

    return {
      content: [{ type: "text", text: code }],
      structuredContent: { entity, operation, file: `server/actions/${entity}s.ts` }
    }
  })

  // ─── generate_page ─────────────────────────────────────────────────────────
  server.registerTool("generate_page", {
    title: "Generar página Next.js",
    description: `Genera una página Next.js 16 siguiendo el patrón del proyecto:
- RSC por defecto
- Metadata dinámica si necesita SEO
- Layout con estructura del dashboard si es una ruta protegida
- Suspense boundaries y loading state

Args:
  - path: ruta de la página (ej: "/dashboard/users/[id]")
  - type: tipo de página
  - with_auth: si requiere sesión (agrega redirect si no hay sesión)

Returns: código de la página listo para src/app/[ruta]/page.tsx`,
    inputSchema: z.object({
      path: z.string().describe("Ruta de la página (ej: /dashboard/users/[id])"),
      type: z.enum(["list", "detail", "form", "dashboard"]),
      with_auth: z.boolean().default(true),
      with_metadata: z.boolean().default(false)
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ path: routePath, type, with_auth, with_metadata }) => {
    const segments = routePath.split("/").filter(Boolean)
    const dynamicParams = segments.filter(s => s.startsWith("[") && s.endsWith("]"))
      .map(s => s.slice(1, -1))
    const entity = segments.find(s => !s.startsWith("[") && !s.startsWith("(")) ?? "entity"
    const pascal = toPascalCase(entity.replace(/s$/, "")) // plurals → singular

    const paramsType = dynamicParams.length > 0
      ? `{ params: { ${dynamicParams.map(p => `${p}: string`).join("; ")} } }`
      : ""

    const authBlock = with_auth ? `
  const session = await auth()
  if (!session) redirect("/login")
` : ""

    const authImports = with_auth
      ? `import { auth } from "@/lib/auth"\nimport { redirect } from "next/navigation"\n`
      : ""

    const metadataBlock = with_metadata ? `
export async function generateMetadata({ params }: ${paramsType || "{}"}): Promise<Metadata> {
  // const item = await get${pascal}(params.id)
  return { title: "${pascal}" }
}
` : ""

    const metadataImport = with_metadata ? `import type { Metadata } from "next"\n` : ""

    let body: string
    switch (type) {
      case "list":
        body = `  // const items = await prismaPostgres.${entity.toLowerCase()}.findMany({ take: 50 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">${pascal}s</h1>
        {/* <CreateButton /> */}
      </div>
      {/* <${pascal}List items={items} /> */}
    </div>
  )`
        break
      case "detail":
        body = `  // const item = await prismaPostgres.${entity.toLowerCase()}.findUnique({
  //   where: { id: params.${dynamicParams[0] ?? "id"} }
  // })
  // if (!item) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">${pascal}</h1>
      {/* <${pascal}Detail item={item} /> */}
    </div>
  )`
        break
      case "form":
        body = `  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo ${pascal}</h1>
      {/* <Create${pascal}Form /> */}
    </div>
  )`
        break
      default:
        body = `  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
    </div>
  )`
    }

    const code = `${metadataImport}${authImports}
export default async function ${pascal}Page(${paramsType ? `props: ${paramsType}` : ""}) {${authBlock}
${body}
}
${metadataBlock}`

    const fsPath = `src/app${routePath}/page.tsx`

    return {
      content: [{ type: "text", text: code.trim() }],
      structuredContent: { path: routePath, fsPath, dynamicParams }
    }
  })

  // ─── generate_component ────────────────────────────────────────────────────
  server.registerTool("generate_component", {
    title: "Generar componente React",
    description: `Genera un componente React siguiendo las convenciones del proyecto:
- RSC por defecto, "use client" solo si se especifica
- Tipado con TypeScript estricto
- Usa cn() para merge de clases Tailwind
- Props interface explícita

Args:
  - name: nombre del componente en PascalCase
  - feature: feature a la que pertenece (carpeta en components/)
  - type: tipo de componente`,
    inputSchema: z.object({
      name: z.string().describe("Nombre en PascalCase (ej: 'UserCard', 'InvoiceTable')"),
      feature: z.string().describe("Feature a la que pertenece (ej: 'users', 'dashboard')"),
      type: z.enum(["display", "form", "layout", "interactive"]),
      is_client: z.boolean().default(false)
        .describe("Si necesita 'use client' (hooks, eventos)")
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ name, feature, type, is_client }) => {
    const clientDirective = is_client ? `"use client"\n\n` : ""

    const propsExample = type === "display"
      ? `  // data: YourDataType`
      : type === "form"
      ? `  // onSubmit?: (data: FormData) => void`
      : type === "interactive"
      ? `  // defaultOpen?: boolean`
      : `  // children: React.ReactNode`

    const bodyExample = type === "display"
      ? `    <div className={cn("rounded-lg border p-4", className)}>
      {/* contenido */}
    </div>`
      : type === "form"
      ? `    <form className={cn("space-y-4", className)}>
      {/* campos */}
      <Button type="submit">Guardar</Button>
    </form>`
      : type === "interactive"
      ? `    <div className={cn("", className)}>
      {/* estado: {open ? "abierto" : "cerrado"} */}
    </div>`
      : `    <div className={cn("", className)}>
      {children}
    </div>`

    const imports = type === "form"
      ? `import { Button } from "@/components/ui/button"\n`
      : ""

    const stateExample = (is_client && type === "interactive")
      ? `  const [open, setOpen] = React.useState(false)\n`
      : ""

    const reactImport = (is_client && type === "interactive")
      ? `import * as React from "react"\n`
      : ""

    const code = `${clientDirective}${reactImport}import { cn } from "@/lib/utils"
${imports}
interface ${name}Props {
${propsExample}
  className?: string
${type === "layout" ? "  children: React.ReactNode\n" : ""}
}

export function ${name}({ ${type === "layout" ? "children, " : ""}className }: ${name}Props) {
${stateExample}
  return (
${bodyExample}
  )
}`

    const fsPath = `src/components/${feature}/${name.replace(/([A-Z])/g, (_, l, i) =>
      i > 0 ? `-${l.toLowerCase()}` : l.toLowerCase())}.tsx`

    return {
      content: [{ type: "text", text: code }],
      structuredContent: { name, feature, fsPath, isClient: is_client }
    }
  })
}
