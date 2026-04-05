---
name: testing
description: "Activar cuando se escriben tests unitarios o de integracion, o se testean Server Actions, Route Handlers o componentes React"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Testing

## Cuándo cargar esta skill
- Escribir tests unitarios o de integración
- Testear Server Actions o Route Handlers
- Testear componentes React
- Correr o debuggear la suite de tests

---

## Setup recomendado (si no está instalado)

```bash
# Vitest para unit/integration (más rápido que Jest, nativo ESM)
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event

# O Jest si ya está configurado en el proyecto
pnpm add -D jest @types/jest jest-environment-jsdom ts-jest
```

---

## Tests de Server Actions

```typescript
// server/actions/__tests__/users.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createUser } from "../users"

// Mock de Prisma — nunca tocar la DB real en tests
vi.mock("@/lib/db/postgres", () => ({
  prismaPostgres: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

// Mock de auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-1", email: "test@test.com", roleId: "admin" }
  })
}))

import { prismaPostgres } from "@/lib/db/postgres"

describe("createUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("crea un usuario con datos válidos", async () => {
    const mockUser = { id: "new-id", name: "Ana", email: "ana@test.com" }
    vi.mocked(prismaPostgres.user.create).mockResolvedValue(mockUser as any)

    const formData = new FormData()
    formData.set("name", "Ana")
    formData.set("email", "ana@test.com")
    formData.set("roleId", "cluid123")

    const result = await createUser(null, formData)

    expect(result.success).toBe(true)
    expect(prismaPostgres.user.create).toHaveBeenCalledWith({
      data: { name: "Ana", email: "ana@test.com", roleId: "cluid123" }
    })
  })

  it("retorna error con email inválido", async () => {
    const formData = new FormData()
    formData.set("name", "Ana")
    formData.set("email", "no-es-email")
    formData.set("roleId", "cluid123")

    const result = await createUser(null, formData)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty("email")
    }
  })

  it("retorna error si no hay sesión", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null)

    const formData = new FormData()
    formData.set("name", "Ana")
    formData.set("email", "ana@test.com")
    formData.set("roleId", "cluid123")

    const result = await createUser(null, formData)
    expect(result.success).toBe(false)
  })
})
```

---

## Tests de Schemas Zod

```typescript
// types/schemas/__tests__/auth.test.ts
import { describe, it, expect } from "vitest"
import { LoginSchema, RegisterSchema } from "../auth"

describe("LoginSchema", () => {
  it("acepta credenciales válidas", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "password123"
    })
    expect(result.success).toBe(true)
  })

  it("rechaza email inválido", () => {
    const result = LoginSchema.safeParse({
      email: "no-es-email",
      password: "password123"
    })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.email).toBeDefined()
  })
})

describe("RegisterSchema", () => {
  it("rechaza contraseñas que no coinciden", () => {
    const result = RegisterSchema.safeParse({
      name: "Ana",
      email: "ana@test.com",
      password: "Password1",
      confirmPassword: "Diferente1"
    })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.confirmPassword).toBeDefined()
  })
})
```

---

## Tests de componentes React

```typescript
// components/users/__tests__/user-card.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { UserCard } from "../user-card"

const mockUser = {
  name: "Ana García",
  email: "ana@test.com",
  role: "admin"
}

describe("UserCard", () => {
  it("muestra el nombre y email del usuario", () => {
    render(<UserCard user={mockUser} />)

    expect(screen.getByText("Ana García")).toBeInTheDocument()
    expect(screen.getByText("ana@test.com")).toBeInTheDocument()
  })

  it("muestra el badge del rol", () => {
    render(<UserCard user={mockUser} />)
    expect(screen.getByText("admin")).toBeInTheDocument()
  })
})
```

---

## Comandos

```bash
pnpm test              # correr tests en watch mode
pnpm test --run        # correr una sola vez (CI)
pnpm test --coverage   # con reporte de cobertura
pnpm test src/server   # solo un directorio
```
