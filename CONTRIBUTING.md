# Contribuir

Toda contribución es bienvenida. Issues, PRs, ideas, skills nuevas.

## Setup de desarrollo

```bash
git clone https://github.com/fernandosecchi/project-mcp-server.git
cd project-mcp-server
npm install
npm run dev    # watch mode
```

## Estructura

- `src/scanner/` — parsers de proyecto (rutas, actions, prisma, componentes)
- `src/tools/` — tools MCP organizadas por módulo
- `skills/` — archivos .md en formato Gentleman (YAML frontmatter)

## Agregar una tool

1. Creá o editá el archivo en `src/tools/{módulo}/index.ts`
2. Registrá la tool con `server.registerTool()` siguiendo el patrón existente
3. Actualizá el README con la nueva tool

## Agregar una skill

1. Creá un archivo `.md` en `skills/` con frontmatter YAML:

```markdown
---
name: nombre-de-la-skill
description: "Cuándo activar esta skill"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Nombre

## Cuándo cargar esta skill
- trigger 1
- trigger 2

---

## Contenido
...
```

2. Actualizá la tabla de skills en el README

## Convenciones

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`)
- **TypeScript**: strict mode, sin `any` explícitos
- **Sin dependencias innecesarias**: el server debe seguir siendo zero-dependency (solo MCP SDK + Zod)

## Pull Requests

1. Forkeá el repo
2. Creá una branch (`feat/mi-feature` o `fix/mi-fix`)
3. Hacé commits con mensajes descriptivos
4. Abrí un PR con descripción de qué cambia y por qué

## Reportar bugs

Abrí un [issue](https://github.com/fernandosecchi/project-mcp-server/issues) con:
- Qué agente usás (Claude Code, Cursor, etc.)
- Qué pasó vs qué esperabas
- Output del error si lo hay
