---
name: nextjs
description: "Activar cuando se crean o modifican paginas, layouts, componentes React, Server Actions o Route Handlers en Next.js"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Next.js 16 + React 19

## Cuándo cargar esta skill
- Crear o modificar páginas, layouts, o componentes React
- Implementar Server Actions o Route Handlers
- Trabajar con fetching de datos en RSC
- Configurar metadata, loading, error boundaries
- Cualquier tarea que involucre el App Router

---

## Decisión RSC vs Client Component

```
¿Necesita hooks (useState, useEffect, useRef)?     → "use client"
¿Maneja eventos del DOM (onClick, onChange)?        → "use client"
¿Usa Context de React?                              → "use client"
¿Solo muestra datos / layout / estructura?          → RSC (default)
¿Hace fetch de datos desde DB o API externa?        → RSC
¿Necesita acceso a cookies/headers en runtime?      → RSC con cookies()/headers()
```

Regla práctica: empezar como RSC, agregar `"use client"` solo cuando el compilador
o la lógica lo exija. Los Client Components deben ser hojas del árbol, no raíces.

---

## Patrones de data fetching (Next.js 16)

### En RSC — fetch directo o query de DB
```typescript
// app/(dashboard)/users/page.tsx
import { prismaPostgres } from "@/lib/db/postgres"

export default async function UsersPage() {
  // Directo — no hace falta useEffect ni SWR
  const users = await prismaPostgres.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true }
  })

  return <UserList users={users} />
}
```

### Cache en RSC — usar `use cache` (Next 16, NO unstable_cache)
```typescript
import { unstable_cache as useCache } from "next/cache"

// Revalidar cada hora, tag para invalidación manual
const getProducts = useCache(
  async () => prismaPostgres.product.findMany(),
  ["products"],
  { revalidate: 3600, tags: ["products"] }
)

// Invalidar desde Server Action
import { revalidateTag } from "next/cache"
revalidateTag("products")
```

---

## Server Actions

```typescript
// server/actions/users.ts
"use server"

import { z } from "zod"
import { prismaPostgres } from "@/lib/db/postgres"
import { auth } from "@/lib/auth"

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "user"])
})

export async function createUser(formData: FormData) {
  // 1. Autenticar
  const session = await auth()
  if (!session) throw new Error("Unauthorized")

  // 2. Validar con Zod
  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role")
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // 3. Ejecutar
  const user = await prismaPostgres.user.create({ data: parsed.data })

  // 4. Revalidar cache si aplica
  revalidateTag("users")

  return { success: true, user }
}
```

### Consumir Server Action desde Client Component
```typescript
"use client"

import { useActionState } from "react"  // React 19 — reemplaza useFormState
import { createUser } from "@/server/actions/users"

export function CreateUserForm() {
  const [state, action, isPending] = useActionState(createUser, null)

  return (
    <form action={action}>
      <input name="name" />
      <input name="email" type="email" />
      <button type="submit" disabled={isPending}>
        {isPending ? "Creando..." : "Crear usuario"}
      </button>
      {state?.error && <p>{JSON.stringify(state.error)}</p>}
    </form>
  )
}
```

---

## Route Handlers (API)

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prismaPostgres } from "@/lib/db/postgres"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page") ?? 1)

  const users = await prismaPostgres.user.findMany({
    skip: (page - 1) * 20,
    take: 20
  })

  return NextResponse.json({ users, page })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  // validar con Zod, crear, retornar
}
```

---

## Layouts y metadata

```typescript
// app/(dashboard)/layout.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex min-h-screen">
      <aside>...</aside>
      <main className="flex-1">{children}</main>
    </div>
  )
}

// Metadata dinámica
export async function generateMetadata({ params }: { params: { id: string } }) {
  const user = await prismaPostgres.user.findUnique({ where: { id: params.id } })
  return { title: user?.name ?? "Usuario" }
}
```

---

## React 19 — novedades a usar

```typescript
// use() — leer promesas y context en render
import { use } from "react"

function UserDetails({ promise }: { promise: Promise<User> }) {
  const user = use(promise)  // Suspense-compatible
  return <div>{user.name}</div>
}

// useOptimistic — updates optimistas
import { useOptimistic } from "react"

function LikeButton({ post }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    post.likes,
    (current, increment: number) => current + increment
  )

  async function handleLike() {
    addOptimisticLike(1)
    await likePost(post.id)
  }
}

// useActionState — reemplaza useFormState de React DOM
import { useActionState } from "react"
```

---

## Anti-patrones a evitar

```typescript
// ❌ No mezclar lógica de servidor en Client Components
"use client"
const data = await fetch("/api/users")  // Error: await en cliente sin Suspense

// ❌ No usar cookies()/headers() fuera de RSC o Route Handlers
// (en Client Components no están disponibles)

// ❌ No importar código de servidor en Client Components
import { prismaPostgres } from "@/lib/db/postgres"  // Expone DB al cliente

// ✓ Pasar datos como props desde RSC padre
export default async function Page() {
  const data = await getData()
  return <ClientComponent initialData={data} />
}
```

---

## Comandos frecuentes

```bash
pnpm dev                     # dev con Turbopack
pnpm build                   # build de producción
pnpm lint                    # ESLint 9
pnpm type-check              # tsc --noEmit
```
