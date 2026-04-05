---
name: zod
description: "Activar cuando se crean o modifican schemas de validacion con Zod en Server Actions, Route Handlers o formularios"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Zod 4 — validación y schemas

## Cuándo cargar esta skill
- Crear o modificar schemas de validación
- Validar datos en Server Actions o Route Handlers
- Definir DTOs de entrada/salida
- Inferir tipos TypeScript desde schemas

---

## Patrones base de Zod 4

```typescript
import { z } from "zod"

// Schema básico con mensajes en español
const UserSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(100, "Máximo 100 caracteres"),
  email: z.string().email("Email inválido"),
  age: z.number().int().min(18, "Debe ser mayor de 18").optional(),
  role: z.enum(["admin", "editor", "viewer"], {
    errorMap: () => ({ message: "Rol inválido" })
  }),
  metadata: z.record(z.string(), z.unknown()).optional()
})

// Inferir tipo TypeScript automáticamente
type User = z.infer<typeof UserSchema>
// → { name: string; email: string; age?: number; role: "admin"|"editor"|"viewer" }
```

---

## Dónde ubicar los schemas

```
src/
└── types/
    └── schemas/
        ├── auth.ts      → LoginSchema, RegisterSchema
        ├── users.ts     → CreateUserSchema, UpdateUserSchema, UserFiltersSchema
        ├── posts.ts     → CreatePostSchema, UpdatePostSchema
        └── index.ts     → re-exporta todo
```

---

## Validación en Server Actions

```typescript
// server/actions/users.ts
"use server"

import { z } from "zod"
import { prismaPostgres } from "@/lib/db/postgres"
import { auth } from "@/lib/auth"

// Schema del DTO de entrada
const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  roleId: z.string().cuid()
})

// Tipo de respuesta tipado
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: Record<string, string[]> | string }

export async function createUser(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  // 1. Autenticar
  const session = await auth()
  if (!session) return { success: false, error: "No autenticado" }

  // 2. Parsear y validar
  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId")
  })

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.flatten().fieldErrors
    }
  }

  // 3. Ejecutar
  const user = await prismaPostgres.user.create({ data: parsed.data })

  return { success: true, data: { id: user.id } }
}
```

---

## Validación en Route Handlers

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const QueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional()
})

const CreateUserBodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, "Debe tener al menos una mayúscula")
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = QueryParamsSchema.safeParse(Object.fromEntries(searchParams))

  if (!params.success) {
    return NextResponse.json(
      { error: params.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { page, limit, search, role } = params.data
  // ...
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const parsed = CreateUserBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  // ...
}
```

---

## Schemas de autenticación

```typescript
// types/schemas/auth.ts
import { z } from "zod"

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida")
})

export const RegisterSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Al menos una mayúscula")
    .regex(/[0-9]/, "Al menos un número"),
  confirmPassword: z.string()
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Las contraseñas no coinciden", path: ["confirmPassword"] }
)

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
```

---

## Transformaciones y refinements útiles

```typescript
// Transformar y sanitizar datos
const SlugSchema = z
  .string()
  .toLowerCase()
  .trim()
  .transform(s => s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))

// Validaciones condicionales
const PaymentSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("credit_card"),
    cardNumber: z.string().length(16),
    cvv: z.string().length(3)
  }),
  z.object({
    method: z.literal("bank_transfer"),
    bankCode: z.string(),
    accountNumber: z.string()
  })
])

// Coerciones útiles para FormData (siempre strings)
const FilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  active: z.coerce.boolean().default(true),
  date: z.coerce.date().optional()
})

// Parsear desde FormData con coerción
const data = FilterSchema.parse({
  page: formData.get("page"),        // "2" → 2
  active: formData.get("active"),    // "true" → true
})
```

---

## Zod 4 — cambios respecto a v3

```typescript
// Zod 4: .flatten() sigue igual para errores
const result = schema.safeParse(input)
if (!result.success) {
  result.error.flatten().fieldErrors  // { campo: ["mensaje"] }
  result.error.flatten().formErrors   // ["error general"]
}

// Zod 4: z.coerce es igual pero más rápido
z.coerce.number()  // "123" → 123

// Zod 4: z.pipe() para transformaciones en cadena
const schema = z.string().pipe(z.coerce.number())

// Zod 4: mejor performance en .parse() con objetos grandes
// No necesita cambios en el código, mejora automática
```
