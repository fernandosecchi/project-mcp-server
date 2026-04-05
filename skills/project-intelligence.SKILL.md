---
name: project-intelligence
description: "Activar cuando se trabaja con SDD en un proyecto Next.js que tiene project-mcp-server configurado como MCP"
license: MIT
metadata:
  version: "1.0.0"
  author: "Fernando Secchi"
---

# Project Intelligence para SDD

Integra el MCP `project-mcp-server` con el flujo SDD. Este MCP expone 10 tools que dan inteligencia real del proyecto: escaneo de rutas, Server Actions, modelos Prisma, componentes, y generación de código basada en el schema real.

---

## Cuándo cargar esta skill

- Cuando se inicia un flujo SDD en un proyecto Next.js con Prisma
- Cuando se necesita explorar la estructura real del proyecto antes de proponer cambios
- Cuando se va a generar código que debe respetar convenciones existentes
- Cuando se necesita verificar que los cambios no rompieron el build

---

## Fase: sdd-init / sdd-explore

Usar `project_scan` para obtener el mapa completo del proyecto antes de proponer cambios:

```
project_scan({ force_refresh: true })
```

Esto devuelve:
- Rutas del App Router (páginas, layouts, route handlers)
- Server Actions existentes con sus schemas Zod
- Modelos de Prisma con campos y relaciones
- Componentes UI instalados (shadcn) y custom

Con esta información el agente puede identificar seams sin tener que explorar el filesystem manualmente.

---

## Fase: sdd-spec / sdd-design

Usar herramientas granulares para detallar el diseño:

**Entender la capa de datos:**
```
project_models({ schema: "base" })
```
Devuelve modelos de Prisma con campos, tipos, relaciones y atributos. Usar para saber qué entidades existen y cómo se relacionan.

**Mapear rutas existentes:**
```
project_routes({ filter: "all" })
```
Devuelve rutas del App Router con: rendering mode (RSC/client), params dinámicos, métodos HTTP (para route handlers), y si tienen loading/error boundaries.

**Ver Server Actions existentes:**
```
project_actions({ feature: "users" })
```
Devuelve actions con: schema Zod asociado, parámetros, flags de auth y revalidación. Usar como referencia de patrones antes de crear nuevas actions.

---

## Fase: sdd-apply

Usar generadores que respetan las convenciones del proyecto:

**Server Action con Zod + auth + revalidación:**
```
generate_action({
  entity: "user",
  operation: "create",
  with_auth: true,
  prisma_schema: "base"
})
```
Genera código basado en el schema de Prisma real del proyecto, no templates genéricos.

**Página RSC con metadata y estructura correcta:**
```
generate_page({
  path: "/dashboard/users/[id]",
  type: "detail",
  with_auth: true,
  with_metadata: true
})
```

**Componente con cn(), tipado explícito y directiva correcta:**
```
generate_component({
  name: "UserCard",
  feature: "users",
  type: "display",
  is_client: false
})
```

---

## Fase: sdd-verify

Usar `env_run_check` para validar que los cambios no rompieron nada:

```
env_run_check({ check: "typecheck" })  → verificar tipos
env_run_check({ check: "lint" })       → verificar lint
env_run_check({ check: "test" })       → correr tests
env_run_check({ check: "build" })      → verificar build completo
```

También verificar estado de migraciones si hubo cambios en Prisma:
```
env_prisma_status()
```

---

## Fase: sdd-archive

Usar `env_status()` para confirmar que el entorno quedó sano después de los cambios. Los resultados se pueden guardar en Engram como observación de tipo `context`.

---

## Tools disponibles (referencia rápida)

| Tool | Fase SDD | Descripción |
|------|----------|-------------|
| `project_scan` | explore | Mapa completo del proyecto |
| `project_routes` | spec/design | Rutas del App Router |
| `project_actions` | spec/design | Server Actions con schemas |
| `project_models` | spec/design | Modelos Prisma con campos |
| `env_status` | init/archive | Estado del entorno |
| `env_run_check` | verify | Typecheck, lint, test, build |
| `env_prisma_status` | verify | Estado de migraciones |
| `generate_action` | apply | Generar Server Action |
| `generate_page` | apply | Generar página RSC |
| `generate_component` | apply | Generar componente React |
