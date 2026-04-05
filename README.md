# project-mcp-server

MCP server con inteligencia de proyecto para Next.js + Prisma. Dos pasos y listo:

```bash
# 1. Instalar (una sola vez)
git clone https://github.com/fernandosecchi/project-mcp-server.git ~/.project-mcp
cd ~/.project-mcp && npm install && npm run build

# 2. Configurar (desde tu proyecto)
cd /ruta/a/tu-proyecto
node ~/.project-mcp/dist/setup.js
```

El setup detecta tus agentes (Claude Code, Cursor, Open Code, Gemini CLI, Codex, VS Code), configura el MCP y copia las skills. **Prerequisito**: Node.js 20+.

Para actualizar: `cd ~/.project-mcp && git pull && npm install && npm run build`

---

## Qué es

Tres capas de inteligencia para tu agente de IA:

- **Inteligencia del proyecto** — escanea rutas, Server Actions, modelos Prisma y componentes en tiempo real
- **Control del entorno** — verifica Docker, migraciones y ejecuta type-check/lint/test/build
- **Generación con convenciones propias** — genera código que lee tu schema de Prisma real

Sin bases de datos, sin servicios externos. Solo Node.js.

Se integra con [Gentleman AI Ecosystem](https://github.com/Gentleman-Programming/gentle-ai) (Engram + SDD + Skills) para memoria persistente y workflow de desarrollo.

---

## Configuración manual

Si preferís configurar a mano en vez de usar el setup:

### Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `MCP_PROJECT_ROOT` | `process.cwd()` | Raíz del proyecto a analizar |

### Claude Code

Editá `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "project": {
      "command": "node",
      "args": ["~/.project-mcp/dist/index.js"],
      "env": {
        "MCP_PROJECT_ROOT": "/ruta/absoluta/tu-proyecto"
      }
    }
  }
}
```

Verificar: abrí Claude Code en tu proyecto → `/mcp` → debe aparecer `project` con 10 tools.

### Open Code

Editá `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "project": {
      "type": "local",
      "command": "node",
      "args": ["~/.project-mcp/dist/index.js"],
      "env": {
        "MCP_PROJECT_ROOT": "/ruta/absoluta/tu-proyecto"
      }
    }
  }
}
```

### Gemini CLI

Editá `~/.gemini/config.json`:

```json
{
  "mcpServers": {
    "project": {
      "command": "node",
      "args": ["~/.project-mcp/dist/index.js"],
      "env": {
        "MCP_PROJECT_ROOT": "/ruta/absoluta/tu-proyecto"
      }
    }
  }
}
```

### Codex CLI

Editá `~/.codex/config.json`:

```json
{
  "mcpServers": {
    "project": {
      "command": "node",
      "args": ["~/.project-mcp/dist/index.js"],
      "env": {
        "MCP_PROJECT_ROOT": "/ruta/absoluta/tu-proyecto"
      }
    }
  }
}
```

### Cursor

Settings → MCP → Add server:

```json
{
  "project": {
    "command": "node",
    "args": ["~/.project-mcp/dist/index.js"],
    "env": {
      "MCP_PROJECT_ROOT": "/ruta/absoluta/tu-proyecto"
    }
  }
}
```

### VS Code (GitHub Copilot)

`.vscode/mcp.json` en el workspace:

```json
{
  "servers": {
    "project": {
      "type": "stdio",
      "command": "node",
      "args": ["~/.project-mcp/dist/index.js"],
      "env": {
        "MCP_PROJECT_ROOT": "${workspaceFolder}"
      }
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

## Integración con Gentleman AI Ecosystem

Este MCP está diseñado para funcionar junto con [Engram](https://github.com/Gentleman-Programming/engram) (memoria persistente) y el [orquestador SDD](https://github.com/Gentleman-Programming/gentle-ai) (workflow de desarrollo).

### Cómo funciona

Engram se encarga de la **memoria** (decisiones, bugs, patrones, contexto entre sesiones). Este MCP se encarga de la **inteligencia del proyecto** (escaneo real del código, generación basada en el schema).

El skill `project-intelligence.SKILL.md` (incluido en `skills/`) le indica al orquestador SDD cuándo usar cada tool:

| Fase SDD | Tools del MCP |
|----------|---------------|
| `sdd-explore` | `project_scan` — mapa completo del proyecto |
| `sdd-spec` / `sdd-design` | `project_models`, `project_routes`, `project_actions` |
| `sdd-apply` | `generate_action`, `generate_page`, `generate_component` |
| `sdd-verify` | `env_run_check`, `env_prisma_status` |
| `sdd-archive` | `env_status` — confirmar entorno sano |

### Setup con Gentleman

1. Instalar [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai) (`brew install gentleman-programming/tap/gentle-ai`)
2. Instalar este MCP server (ver arriba)
3. Correr `node ~/.project-mcp/dist/setup.js` — copia las skills automáticamente

---

## Workflow sugerido

### Sin Gentleman (standalone)

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

### Con Gentleman (SDD)

```
1. Engram: mem_context() → contexto de sesiones anteriores
2. MCP: project_scan() → mapa del proyecto actual
3. SDD: el orquestador delega fases a sub-agentes
   → cada sub-agente usa las tools del MCP según el skill project-intelligence
4. Engram: mem_save() → guardar decisiones y aprendizajes
```

---

## Skills incluidas (10)

El directorio `skills/` incluye skills en formato Gentleman (YAML frontmatter):

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

El setup las copia automáticamente al directorio de skills de tu agente.

---

## Estructura del proyecto

```
project-mcp-server/
├── src/
│   ├── index.ts                    ← entry point (MCP server)
│   ├── setup.ts                    ← setup interactivo
│   ├── config.ts                   ← configuración desde env vars
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
├── skills/                         ← archivos .md de skills (formato Gentleman)
├── dist/                           ← compilado (no commitear)
├── package.json
└── tsconfig.json
```

---

## Actualizar

```bash
cd ~/.project-mcp && git pull && npm install && npm run build
```

No hay que reiniciar el LLM — el servidor se actualiza al próximo restart del proceso MCP.

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

## Licencia

MIT
