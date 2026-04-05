# project-mcp-server

[![CI](https://github.com/fernandosecchi/project-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/fernandosecchi/project-mcp-server/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/project-mcp-server.svg)](https://www.npmjs.com/package/project-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)

MCP server con inteligencia de proyecto para Next.js + Prisma. Un comando para instalar todo:

```bash
cd tu-proyecto
npx project-mcp-server setup
```

Un wizard interactivo te guía para elegir qué componentes instalar. **Prerequisito**: Node.js 20+.

---

## Qué es

Un instalador unificado que combina inteligencia de proyecto con herramientas del ecosistema AI:

- **MCP Server** — 10 herramientas de inteligencia de proyecto, entorno y generación de código
- **OpenSpec** — Desarrollo guiado por especificaciones (SDD)
- **Engram** — Memoria persistente entre sesiones de IA
- **Skills comunitarios** — Habilidades para React, Next, Angular, TypeScript y más
- **Guardian Angel** — Revisión de código con IA antes de cada commit

Sin bases de datos, sin servicios externos. Solo Node.js y un setup interactivo.

---

## Setup interactivo

```bash
npx project-mcp-server setup
```

El wizard detecta tu proyecto y te presenta los componentes disponibles:

```
Selecciona los componentes a instalar:
◉ MCP Server         — 10 herramientas de inteligencia de proyecto, entorno y generacion
◯ OpenSpec           — Desarrollo guiado por especificaciones (SDD)
◯ Engram             — Memoria persistente entre sesiones de IA
◯ Skills comunitarios — Habilidades para React, Next, Angular, TypeScript y mas
◯ Guardian Angel     — Revision de codigo con IA antes de cada commit
```

Cada componente se instala y configura automáticamente. Si uno falla, los demás continúan.

### Qué hace cada componente

| Componente | Qué instala |
|---|---|
| **MCP Server** | Crea `.mcp.json` en tu proyecto + copia skills propios |
| **OpenSpec** | Ejecuta `openspec init` → genera skills SDD en `.claude/skills/` |
| **Engram** | Descarga el binario, lo instala en `~/.local/bin/`, configura MCP |
| **Skills comunitarios** | Descarga skills de [Gentleman-Skills](https://github.com/Gentleman-Programming/Gentleman-Skills) → los copia al agente |
| **Guardian Angel** | Instala GGA + pre-commit hook para code review con IA |

---

## Cómo funciona

El setup crea un archivo `.mcp.json` en la raíz de tu proyecto:

```json
{
  "mcpServers": {
    "project": {
      "command": "npx",
      "args": ["-y", "project-mcp-server"],
      "env": { "MCP_PROJECT_ROOT": "." }
    }
  }
}
```

Este archivo es **per-project**: cualquier agente MCP-compatible (Claude Code, Cursor, VS Code, etc.) lo detecta automáticamente al abrir el directorio. Commitealo al repo para que todo el equipo lo tenga sin configurar nada.

Si seleccionás Engram, también se agrega al `.mcp.json`:

```json
{
  "mcpServers": {
    "project": { "..." : "..." },
    "engram": {
      "command": "engram",
      "args": ["mcp", "--tools=agent"]
    }
  }
}
```

---

## Tools disponibles (10)

### Inteligencia del proyecto

| Tool | Descripción |
|---|---|
| `project_scan` | Mapa completo: rutas, actions, modelos, componentes |
| `project_routes` | Lista rutas del App Router con rendering, params y métodos |
| `project_actions` | Lista Server Actions con schema Zod y flags de auth |
| `project_models` | Lista modelos de Prisma con campos por schema |

### Control del entorno

| Tool | Descripción |
|---|---|
| `env_status` | Estado de Docker, .env.local y herramientas de desarrollo |
| `env_run_check` | Ejecuta typecheck, lint, test o build |
| `env_prisma_status` | Migraciones pendientes y estado de la DB |

### Generación

| Tool | Descripción |
|---|---|
| `generate_action` | Server Action con Zod, auth, revalidación — basado en tu schema Prisma real |
| `generate_page` | Página RSC con auth, metadata y estructura correcta |
| `generate_component` | Componente con cn(), tipado explícito y directiva correcta |

---

## Componentes integrados

### OpenSpec — Spec-Driven Development

[OpenSpec](https://github.com/Fission-AI/OpenSpec) organiza el desarrollo en propuestas, especificaciones, diseños y tareas antes de escribir código. Se integra con 20+ asistentes de IA.

Al seleccionarlo en el setup, se ejecuta `openspec init` que genera skills y comandos en tu proyecto (`.claude/skills/`, `.claude/commands/opsx/`).

### Engram — Memoria persistente

[Engram](https://github.com/Gentleman-Programming/engram) almacena observaciones, sesiones y aprendizajes en SQLite con búsqueda full-text. Se expone como servidor MCP con 11 tools (mem_save, mem_search, mem_context, etc.).

El setup descarga el binario para tu plataforma y lo configura como MCP server en tu proyecto.

### Skills comunitarios

[Gentleman-Skills](https://github.com/Gentleman-Programming/Gentleman-Skills) es una colección comunitaria de skills para agentes de IA. Incluye 15+ skills curados (React 19, Next.js 15, Angular, TypeScript, Tailwind, Playwright, etc.) y 6+ comunitarios.

El setup los descarga y copia al directorio de skills de tu agente.

### Guardian Angel — Code review con IA

[Guardian Angel](https://github.com/Gentleman-Programming/gentleman-guardian-angel) es un pre-commit hook que valida tu código contra estándares definidos en un `AGENTS.md`. Soporta múltiples proveedores de IA (Claude, Gemini, OpenAI, Ollama).

El setup instala el binario, crea la configuración y opcionalmente instala el pre-commit hook.

---

## Workflow sugerido

### Standalone (solo MCP Server)

```
1. env_status()
   → verificar que el entorno está sano antes de codear

2. project_scan()
   → mapa actual de rutas, actions y modelos

3. project_actions(feature: "users")
   → ver patterns existentes antes de crear uno nuevo

4. generate_action(entity: "user", operation: "create")
   → código base generado con TU schema Prisma real
```

### Con OpenSpec + Engram

```
1. Engram: mem_context() → contexto de sesiones anteriores
2. MCP: project_scan() → mapa del proyecto actual
3. OpenSpec: /opsx:propose → proponer un cambio con specs
4. OpenSpec: /opsx:apply → implementar las tareas
5. MCP: env_run_check(check: "typecheck") → verificar
6. Engram: mem_save() → guardar decisiones y aprendizajes
```

---

## Skills incluidos (10)

El directorio `skills/` incluye skills propios del proyecto:

| Skill | Stack |
|---|---|
| `nextjs.md` | Next.js 16 + React 19 |
| `prisma.md` | Prisma 7 multi-schema |
| `nextauth.md` | NextAuth.js v5 |
| `zod.md` | Zod 4 validación |
| `shadcn.md` | shadcn/ui + Tailwind CSS 4 |
| `testing.md` | Vitest + Testing Library |
| `infra.md` | Docker, env vars, DB local |
| `security.md` | OWASP para Next.js + Prisma |
| `commit.md` | Conventional Commits y PRs |
| `project-intelligence.SKILL.md` | Integración SDD |

El setup los copia automáticamente al directorio de skills de tu agente.

---

## Estructura del proyecto

```
project-mcp-server/
├── src/
│   ├── index.ts                    ← entry point (MCP server)
│   ├── cli.ts                      ← CLI: setup o server
│   ├── config.ts                   ← configuración desde env vars
│   ├── setup/
│   │   ├── index.ts                ← wizard interactivo (orquestador)
│   │   ├── types.ts                ← tipos compartidos
│   │   ├── helpers.ts              ← utilidades (I/O, download, platform)
│   │   ├── ui.ts                   ← banner, selector, resumen
│   │   └── installers/
│   │       ├── mcp-server.ts       ← config .mcp.json
│   │       ├── openspec.ts         ← OpenSpec init
│   │       ├── engram.ts           ← descarga + config Engram
│   │       ├── gentleman-skills.ts ← descarga skills comunitarios
│   │       └── guardian-angel.ts   ← instala GGA + hook
│   ├── scanner/
│   │   ├── cache.ts                ← TTL cache para escaneos
│   │   ├── routes.ts               ← App Router scanner
│   │   ├── actions.ts              ← Server Actions scanner
│   │   ├── prisma.ts               ← multi-schema Prisma parser
│   │   └── components.ts           ← shadcn + custom components
│   └── tools/
│       ├── project/index.ts        ← 4 tools de inteligencia
│       ├── env/index.ts            ← 3 tools de entorno
│       └── generate/index.ts       ← 3 tools de generación
├── skills/                         ← 10 archivos .md de skills
├── dist/                           ← compilado
├── package.json
└── tsconfig.json
```

---

## Testing local

```bash
# Inspeccionar con MCP Inspector (UI visual)
npm run inspect

# Test manual de una tool
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "env_status",
    "arguments": {}
  }
}' | MCP_PROJECT_ROOT=/tu/proyecto node dist/index.js 2>/dev/null
```

---

## Créditos

- [Gentleman Programming](https://github.com/Gentleman-Programming) (Alan Buscaglia) — Engram, Guardian Angel, Gentleman Skills, y la filosofía de ecosistema que inspira este proyecto
- [Fission AI](https://github.com/Fission-AI) — OpenSpec, sistema de spec-driven development
- [Anthropic](https://github.com/modelcontextprotocol) — Model Context Protocol y SDK
- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) (Affaan M) — Inspiración para el skill de seguridad

Ver [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md) para el detalle completo.

## Licencia

MIT — ver [LICENSE](LICENSE)
