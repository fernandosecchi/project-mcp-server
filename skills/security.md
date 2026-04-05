---
name: security
description: "Activar cuando se implementa autenticacion, se manejan inputs de usuario, se crean API endpoints, se trabaja con secrets o se prepara un deploy a produccion"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Seguridad — OWASP para Next.js + Prisma

## Cuándo cargar esta skill

- Implementar autenticación o autorización
- Manejar input de usuario o file uploads
- Crear API endpoints o Route Handlers
- Trabajar con secrets o credenciales
- Preparar deploy a producción
- Integrar APIs de terceros

---

## 1. Secrets Management

```typescript
// ✗ NUNCA hardcodear secrets
const apiKey = "sk-proj-xxxxx"

// ✓ SIEMPRE usar variables de entorno
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error("OPENAI_API_KEY no configurada")
```

**Checklist:**
- No hardcodear API keys, tokens ni passwords
- Todos los secrets en variables de entorno
- `.env.local` en `.gitignore`
- No commitear secrets al historial de git
- Secrets de producción en la plataforma de hosting (Vercel, Railway)

---

## 2. Validación de Input

### Con Zod (patrón estándar del proyecto)

```typescript
import { z } from "zod"

const CreateUserSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150)
})

// En Server Action
export async function createUser(formData: FormData) {
  "use server"
  const parsed = CreateUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    age: Number(formData.get("age"))
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  // Continuar con datos validados
  await prisma.user.create({ data: parsed.data })
}
```

### File Uploads

```typescript
function validateFileUpload(file: File) {
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) throw new Error("Archivo muy grande (máx 5MB)")

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!allowedTypes.includes(file.type)) throw new Error("Tipo de archivo no permitido")

  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"]
  if (!ext || !allowedExts.includes(ext)) throw new Error("Extensión no permitida")
}
```

**Checklist:**
- Todos los inputs validados con Zod antes de procesarlos
- File uploads restringidos (tamaño, tipo, extensión)
- No usar input de usuario directo en queries
- Validar con whitelist (no blacklist)
- Mensajes de error sin información sensible

---

## 3. SQL Injection — Prisma

Prisma previene SQL injection por defecto con queries parametrizadas. El riesgo está en `$queryRaw`:

```typescript
// ✗ NUNCA concatenar strings en raw queries
const users = await prisma.$queryRaw`SELECT * FROM users WHERE email = '${email}'`

// ✓ SIEMPRE usar tagged template de Prisma (parametrizado)
const users = await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`

// ✓ MEJOR: usar el query builder de Prisma
const users = await prisma.user.findMany({
  where: { email },
  select: { id: true, email: true, name: true } // select explícito
})
```

**Checklist:**
- Usar el query builder de Prisma (no raw queries salvo necesidad)
- Si se usa `$queryRaw`, usar tagged template literals (no concatenación)
- Select explícito — nunca devolver todos los campos sin filtrar

---

## 4. Autenticación y Autorización

### Tokens en httpOnly cookies (no localStorage)

```typescript
// ✗ localStorage es vulnerable a XSS
localStorage.setItem("token", token)

// ✓ httpOnly cookies
cookies().set("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 60 * 60 // 1 hora
})
```

### Verificar autorización antes de operar

```typescript
export async function deleteUser(userId: string) {
  "use server"
  const session = await auth()
  if (!session?.user) throw new Error("No autenticado")

  // Verificar permisos
  if (!hasPermission(session.user, "users:delete")) {
    throw new Error("Sin permisos")
  }

  await prisma.user.delete({ where: { id: userId } })
  revalidateTag("users")
}
```

**Checklist:**
- Tokens en httpOnly cookies, nunca en localStorage
- Verificar auth en cada Server Action y Route Handler
- RBAC implementado con `hasPermission()`
- Sesiones con expiración configurada

---

## 5. XSS Prevention

### Sanitizar HTML de usuario

```typescript
import DOMPurify from "isomorphic-dompurify"

function UserContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "li"],
    ALLOWED_ATTR: []
  })
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}
```

### Content Security Policy en Next.js

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.tudominio.com"
    ].join("; ")
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
]
```

**Checklist:**
- HTML de usuario sanitizado con DOMPurify
- CSP headers configurados
- X-Frame-Options, X-Content-Type-Options configurados
- No renderizar contenido dinámico sin sanitizar

---

## 6. CSRF Protection

Next.js Server Actions incluyen protección CSRF por defecto (Origin header check). Para Route Handlers custom:

```typescript
export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL]

  if (!origin || !allowedOrigins.includes(origin)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // Procesar request
}
```

**Checklist:**
- Server Actions usan CSRF nativo de Next.js
- Route Handlers validan Origin header
- Cookies con `SameSite=Strict`

---

## 7. Rate Limiting

### En Route Handlers con headers

```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string, limit = 100, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  record.count++
  return record.count <= limit
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown"

  if (!rateLimit(ip, 10, 60_000)) { // 10 req/min
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }

  // Procesar request
}
```

**Checklist:**
- Rate limiting en todos los API endpoints
- Límites más estrictos en operaciones costosas (búsquedas, auth)
- Rate limiting por IP y por usuario autenticado

---

## 8. Logging Seguro

```typescript
// ✗ NUNCA loguear datos sensibles
console.log("Login:", { email, password })
console.log("Payment:", { cardNumber, cvv })

// ✓ Redactar datos sensibles
console.log("Login:", { email, userId })
console.log("Payment:", { last4: card.last4, userId })
```

### Errores al usuario vs servidor

```typescript
// ✗ NUNCA exponer detalles internos
catch (error) {
  return Response.json({ error: error.message, stack: error.stack }, { status: 500 })
}

// ✓ Mensajes genéricos al usuario, detalle en server logs
catch (error) {
  console.error("Error interno:", error)
  return Response.json({ error: "Ocurrió un error. Intentá de nuevo." }, { status: 500 })
}
```

**Checklist:**
- No loguear passwords, tokens ni secrets
- Errores genéricos para el usuario
- Errores detallados solo en server logs
- No exponer stack traces al usuario

---

## 9. Dependencias

```bash
# Verificar vulnerabilidades
pnpm audit

# Actualizar dependencias
pnpm update

# Ver paquetes desactualizados
pnpm outdated
```

**Checklist:**
- Dependencias actualizadas
- Sin vulnerabilidades conocidas (`pnpm audit` limpio)
- Lock file commiteado
- Dependabot o Renovate habilitado en GitHub

---

## Checklist Pre-Deploy

Antes de CUALQUIER deploy a producción:

- [ ] **Secrets**: No hardcodeados, todos en env vars
- [ ] **Input Validation**: Todos los inputs validados con Zod
- [ ] **SQL Injection**: Queries parametrizadas (Prisma builder o tagged template)
- [ ] **XSS**: Contenido de usuario sanitizado
- [ ] **CSRF**: Protección habilitada (Server Actions + Origin check)
- [ ] **Auth**: Tokens en httpOnly cookies, RBAC verificado
- [ ] **Rate Limiting**: Habilitado en todos los endpoints
- [ ] **HTTPS**: Forzado en producción
- [ ] **Security Headers**: CSP, X-Frame-Options configurados
- [ ] **Error Handling**: Sin datos sensibles en errores
- [ ] **Logging**: Sin datos sensibles en logs
- [ ] **Dependencias**: Actualizadas, sin vulnerabilidades
- [ ] **CORS**: Configurado correctamente
- [ ] **File Uploads**: Validados (tamaño, tipo)

---

## Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Prisma Security Best Practices](https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access)
