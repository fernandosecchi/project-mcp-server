import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { existsSync } from "node:fs"
import { config } from "../config.js"
import { cached } from "./cache.js"

export interface PrismaField {
  name: string
  type: string
  isOptional: boolean
  isArray: boolean
  isRelation: boolean
  attributes: string[]
}

export interface PrismaModel {
  name: string
  schema: string          // auth | rbac | audit | base
  file: string
  fields: PrismaField[]
  hasId: boolean
  hasTimestamps: boolean
}

function parseFields(block: string): PrismaField[] {
  const fields: PrismaField[] = []
  const lines = block.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue

    // Patrón: fieldName  Type?[] @attribute1 @attribute2
    const match = trimmed.match(/^(\w+)\s+(\w+)(\??)(\[\])?(.*)$/)
    if (!match) continue

    const [, name = "", type = "", optional = "", array = "", rest = ""] = match
    const attributes = (rest.match(/@[\w.()]+/g) ?? []).map(a => a.trim())

    // Detectar si es relación (tipo empieza con mayúscula pero no es primitivo)
    const primitives = new Set(["String", "Int", "Float", "Boolean", "DateTime", "Json",
                                "Bytes", "Decimal", "BigInt"])
    const isRelation = /^[A-Z]/.test(type) && !primitives.has(type)

    fields.push({
      name,
      type,
      isOptional: optional === "?",
      isArray: array === "[]",
      isRelation,
      attributes
    })
  }

  return fields
}

function extractSchema(content: string, modelName: string): string {
  // Buscar @@schema("auth") dentro del bloque del modelo
  const modelBlock = content.match(
    new RegExp(`model\\s+${modelName}\\s*\\{([^}]+)\\}`, "s")
  )?.[1] ?? ""

  const schemaMatch = modelBlock.match(/@@schema\("(\w+)"\)/)
  return schemaMatch?.[1] ?? "base"
}

async function parseFile(filePath: string, projectRoot: string): Promise<PrismaModel[]> {
  const content = await readFile(filePath, "utf-8").catch(() => "")
  if (!content) return []

  const models: PrismaModel[] = []
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/gs
  let match: RegExpExecArray | null

  while ((match = modelRegex.exec(content)) !== null) {
    const name = match[1] ?? ""
    const block = match[2] ?? ""
    const fields = parseFields(block)

    models.push({
      name,
      schema: extractSchema(content, name),
      file: relative(projectRoot, filePath),
      fields,
      hasId: fields.some(f => f.attributes.some(a => a.includes("@id"))),
      hasTimestamps: fields.some(f => f.name === "createdAt" || f.name === "updatedAt")
    })
  }

  return models
}

export async function scanPrismaSchemas(): Promise<PrismaModel[]> {
  return cached("prisma", async () => {
    const prismaDir = join(config.projectRoot, config.scanner.prismaDir)
    if (!existsSync(prismaDir)) return []

    const entries = await readdir(prismaDir, { withFileTypes: true }).catch(() => [])
    const prismaFiles = entries
      .filter(e => e.isFile() && e.name.endsWith(".prisma"))
      .map(e => join(prismaDir, e.name))

    const results = await Promise.all(prismaFiles.map(f => parseFile(f, config.projectRoot)))
    return results.flat().sort((a, b) => a.name.localeCompare(b.name))
  })
}
