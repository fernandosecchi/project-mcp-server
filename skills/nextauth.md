---
name: nextauth
description: "Activar cuando se configura o modifica autenticacion, se protegen rutas o layouts, o se trabaja con sesiones y roles"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: NextAuth.js v5 (beta 30)

## Cuándo cargar esta skill
- Configurar o modificar autenticación
- Proteger rutas o layouts
- Acceder a la sesión del usuario
- Implementar middleware de auth
- Manejar roles y permisos en rutas

---

## Configuración base (v5 beta 30)

```typescript
// lib/auth/config.ts
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { prismaPostgres } from "@/lib/db/postgres"
import { LoginSchema } from "@/types/schemas"

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prismaPostgres.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, password: true, roleId: true }
        })
        if (!user) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

        // No retornar el password al cliente
        const { password: _, ...safeUser } = user
        return safeUser
      }
    })
  ],

  callbacks: {
    // Extender el token JWT con datos del usuario
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.roleId = user.roleId
      }
      return token
    },
    // Extender la sesión con datos del token
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.roleId = token.roleId as string
      }
      return session
    }
  },

  pages: {
    signIn: "/login",
    error: "/login"   // Redirigir errores al login
  },

  session: { strategy: "jwt" }
}
```

```typescript
// lib/auth/index.ts — exportar handlers y helper auth()
import NextAuth from "next-auth"
import { authConfig } from "./config"

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

---

## Acceder a la sesión

### En RSC o Server Actions
```typescript
import { auth } from "@/lib/auth"

// En un RSC
export default async function Page() {
  const session = await auth()
  if (!session) redirect("/login")

  return <div>Hola {session.user.name}</div>
}

// En una Server Action
export async function deletePost(id: string) {
  "use server"
  const session = await auth()
  if (!session) throw new Error("Unauthorized")
  if (session.user.roleId !== "admin") throw new Error("Forbidden")
  // ...
}
```

### En Client Components
```typescript
"use client"
import { useSession } from "next-auth/react"

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === "loading") return <Skeleton />
  if (!session) return <LoginButton />

  return <div>{session.user.name}</div>
}
```

---

## Middleware — protección de rutas

```typescript
// middleware.ts (raíz del proyecto)
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard")
  const isOnAdmin = req.nextUrl.pathname.startsWith("/admin")
  const isOnLogin = req.nextUrl.pathname === "/login"

  // Si intenta entrar al dashboard sin sesión → login
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Si intenta admin sin rol admin → 403
  if (isOnAdmin) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url))
    if (req.auth?.user?.roleId !== "admin") {
      return NextResponse.redirect(new URL("/403", req.url))
    }
  }

  // Si ya está logueado e intenta ir al login → dashboard
  if (isOnLogin && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }
})

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login"]
}
```

---

## Extender tipos de sesión (TypeScript)

```typescript
// types/next-auth.d.ts
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      roleId: string
    }
  }

  interface User {
    roleId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    roleId: string
  }
}
```

---

## Login y logout desde Client Components

```typescript
"use client"
import { signIn, signOut } from "next-auth/react"

// Login con redirect
<button onClick={() => signIn("credentials", { redirect: true, callbackUrl: "/dashboard" })}>
  Iniciar sesión
</button>

// Logout
<button onClick={() => signOut({ callbackUrl: "/login" })}>
  Cerrar sesión
</button>
```

---

## Helper de permisos (RBAC)

```typescript
// lib/auth/permissions.ts
import { auth } from "@/lib/auth"
import { prismaPostgres } from "@/lib/db/postgres"

export async function hasPermission(action: string): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.roleId) return false

  const permission = await prismaPostgres.permission.findFirst({
    where: {
      roleId: session.user.roleId,
      action: { in: [action, `${action.split(":")[0]}:*`] }
    }
  })

  return !!permission
}

// Uso en Server Action
export async function createPost(data: unknown) {
  "use server"
  const allowed = await hasPermission("posts:create")
  if (!allowed) throw new Error("Forbidden")
  // ...
}
```
