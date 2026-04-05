---
name: prisma
description: "Activar cuando se modifican schemas de Prisma, se escriben queries de base de datos o se trabaja con migraciones"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Prisma 7 — multi-schema

## Cuándo cargar esta skill
- Modificar o crear schemas de Prisma
- Escribir queries de base de datos
- Crear o correr migrations
- Escribir seeds
- Trabajar con el cliente PostgreSQL o MySQL

---

## Arquitectura de clientes

Este proyecto tiene **dos conexiones** separadas:

```typescript
// lib/db/postgres.ts — cliente principal (auth, rbac, audit, base)
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

export const prismaPostgres = new PrismaClient({ adapter })

// lib/db/mysql.ts — cliente secundario
import { PrismaClient } from "@prisma/mysql-client"  // cliente generado para mysql
import { createPool } from "mysql2/promise"
import { PrismaMysql } from "@prisma/adapter-mysql"  // si aplica

export const prismaMySQL = new PrismaClient(...)
```

**Regla**: siempre importar el cliente correcto según el dominio de la entidad.

---

## Estructura de schemas multi-schema

```prisma
// prisma/schema/auth.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["auth", "rbac", "audit", "base"]
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@schema("auth")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@schema("auth")
}
```

```prisma
// prisma/schema/rbac.prisma
model Role {
  id          String       @id @default(cuid())
  name        String       @unique
  permissions Permission[]
  users       UserRole[]

  @@schema("rbac")
}

model Permission {
  id     String @id @default(cuid())
  action String  // ej: "users:create", "posts:delete"
  roleId String
  role   Role   @relation(fields: [roleId], references: [id])

  @@schema("rbac")
}
```

---

## Queries con Prisma 7

### Patrones correctos de selección
```typescript
// ✓ Siempre select explícito — nunca traer campos sensibles por defecto
const user = await prismaPostgres.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    name: true,
    // nunca incluir 'password' salvo en contexto de auth
  }
})

// ✓ Include para relaciones — solo lo que se usa en la UI
const userWithRoles = await prismaPostgres.user.findUnique({
  where: { id },
  include: {
    roles: {
      include: { permissions: true }
    }
  }
})
```

### Queries cross-schema (dentro del mismo cliente PostgreSQL)
```typescript
// Las relaciones entre schemas se manejan en el schema de Prisma
// En queries, se accede igual que cualquier relación
const auditLogs = await prismaPostgres.auditLog.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: "desc" },
  take: 50
})
```

### Transactions
```typescript
// Para operaciones atómicas entre tablas
const result = await prismaPostgres.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData })
  await tx.userRole.create({ data: { userId: user.id, roleId: defaultRoleId } })
  await tx.auditLog.create({ data: { action: "user.created", userId: user.id } })
  return user
})
```

### Queries en MySQL (cliente secundario)
```typescript
import { prismaMySQL } from "@/lib/db/mysql"

const records = await prismaMySQL.legacyRecord.findMany({
  where: { status: "active" }
})
```

---

## Migrations

```bash
# Crear migration después de cambiar un schema
pnpm prisma migrate dev --name nombre-descriptivo-en-snake-case

# Ejemplos de nombres:
# add-user-roles-table
# add-email-verified-to-user
# create-audit-schema
# add-permissions-index

# Aplicar en producción (no crea archivos, solo aplica pending)
pnpm prisma migrate deploy

# Reset completo (solo en dev)
pnpm prisma migrate reset

# Ver estado de migrations
pnpm prisma migrate status
```

**Importante**: nunca editar archivos de migration ya aplicados. Si hay un error,
crear una nueva migration que lo corrija.

---

## Seeds con tsx

```typescript
// prisma/seeds/roles.ts
import { prismaPostgres } from "@/lib/db/postgres"

const ROLES = [
  {
    name: "admin",
    permissions: ["users:create", "users:delete", "users:read", "posts:*"]
  },
  {
    name: "editor",
    permissions: ["posts:create", "posts:update", "posts:read"]
  },
  {
    name: "viewer",
    permissions: ["posts:read", "users:read"]
  }
]

async function seedRoles() {
  console.log("Seeding roles...")

  for (const roleData of ROLES) {
    const role = await prismaPostgres.role.upsert({
      where: { name: roleData.name },
      update: {},
      create: { name: roleData.name }
    })

    for (const action of roleData.permissions) {
      await prismaPostgres.permission.upsert({
        where: { roleId_action: { roleId: role.id, action } },
        update: {},
        create: { roleId: role.id, action }
      })
    }
  }

  console.log("✓ Roles seeded")
}

seedRoles()
  .catch(console.error)
  .finally(() => prismaPostgres.$disconnect())
```

```bash
# Correr seed
pnpm tsx prisma/seeds/roles.ts
```

---

## Prisma Studio y herramientas

```bash
pnpm prisma studio           # UI visual para explorar datos (localhost:5555)
pnpm prisma generate         # Regenerar cliente después de cambiar schema
pnpm prisma db push          # Sync schema → DB sin migration (solo en dev)
pnpm prisma validate         # Validar syntax del schema
pnpm prisma format           # Formatear archivos .prisma
```

---

## Anti-patrones a evitar

```typescript
// ❌ No hacer queries sin select — expone datos sensibles
const user = await prismaPostgres.user.findUnique({ where: { id } })
// Devuelve password hasheado y otros campos sensibles

// ❌ No mezclar clientes — MySQL con entidades de PostgreSQL
import { prismaMySQL } from "@/lib/db/mysql"
const user = await prismaMySQL.user.findUnique(...)  // El modelo User es de PostgreSQL

// ❌ No hardcodear IDs de roles o permisos — usar queries o constantes
const adminRole = await prismaPostgres.role.findUnique({ where: { name: "admin" } })

// ❌ No hacer N+1 queries — usar include o select con relaciones
const users = await prismaPostgres.user.findMany()
for (const user of users) {
  // ❌ Query por cada usuario
  const roles = await prismaPostgres.userRole.findMany({ where: { userId: user.id } })
}
// ✓ Un solo query con include
const users = await prismaPostgres.user.findMany({ include: { roles: true } })
```
