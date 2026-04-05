---
name: infra
description: "Activar cuando se trabaja con Docker, variables de entorno, setup de base de datos o configuracion del entorno de desarrollo"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Infra — Docker, variables de entorno, base de datos local

## Cuándo cargar esta skill
- Levantar o modificar servicios de Docker
- Trabajar con variables de entorno
- Setup inicial del proyecto
- Troubleshooting de conexiones a DB

---

## Docker Compose — servicios locales

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: app_postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-appuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-apppassword}
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-appuser}"]
      interval: 5s
      timeout: 5s
      retries: 5

  mysql:
    image: mysql:5.7
    container_name: app_mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
      MYSQL_DATABASE: ${MYSQL_DB:-legacydb}
      MYSQL_USER: ${MYSQL_USER:-appuser}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-apppassword}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
  mysql_data:
```

### Comandos Docker frecuentes

```bash
# Levantar todo en background
docker compose up -d

# Ver logs en vivo
docker compose logs -f postgres
docker compose logs -f mysql

# Reiniciar un servicio
docker compose restart postgres

# Bajar todo (conserva volúmenes)
docker compose down

# Bajar y eliminar volúmenes (reset total de datos)
docker compose down -v

# Ver estado de los servicios
docker compose ps
```

---

## Variables de entorno

```bash
# .env.local (desarrollo local — no commitear)
# .env.example (template — sí commitear, sin valores reales)

# Base de datos PostgreSQL
DATABASE_URL="postgresql://appuser:apppassword@localhost:5432/appdb"

# Base de datos MySQL
MYSQL_DATABASE_URL="mysql://appuser:apppassword@localhost:3306/legacydb"

# NextAuth
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### Generar NEXTAUTH_SECRET

```bash
openssl rand -base64 32
# Pegar el resultado en NEXTAUTH_SECRET
```

### Validar variables de entorno al iniciar

```typescript
// lib/env.ts — validación con Zod al startup
import { z } from "zod"

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  MYSQL_DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
})

export const env = EnvSchema.parse(process.env)

// Importar en lib/db/postgres.ts, lib/auth/config.ts, etc.
// Si falta una variable, el error explota al iniciar → fail fast
```

---

## Setup inicial completo

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores correctos

# 3. Levantar bases de datos
docker compose up -d

# Esperar a que estén ready (healthcheck)
docker compose ps  # status debe ser "healthy"

# 4. Correr migrations de Prisma
pnpm prisma migrate dev

# 5. Generar cliente Prisma
pnpm prisma generate

# 6. Correr seeds
pnpm tsx prisma/seeds/roles.ts
pnpm tsx prisma/seeds/admin-user.ts

# 7. Iniciar dev server
pnpm dev
```

---

## Troubleshooting de conexiones

```bash
# PostgreSQL — verificar que acepta conexiones
docker compose exec postgres pg_isready -U appuser

# Conectarse con psql
docker compose exec postgres psql -U appuser -d appdb

# MySQL — verificar conexión
docker compose exec mysql mysqladmin ping -h localhost -u appuser -p

# Conectarse con mysql CLI
docker compose exec mysql mysql -u appuser -p legacydb

# Ver logs de error de conexión
docker compose logs postgres | grep -i error
docker compose logs mysql | grep -i error

# Si Prisma no conecta — verificar DATABASE_URL
pnpm prisma db pull  # Si conecta, lista las tablas existentes
```

---

## Scripts útiles en package.json

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:reset": "docker compose down -v && docker compose up -d",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seeds/index.ts",
    "setup": "pnpm install && pnpm db:up && pnpm db:migrate && pnpm db:seed"
  }
}
```

Con `pnpm setup` un desarrollador nuevo levanta todo el entorno en un comando.
