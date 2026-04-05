# Changelog

## [2.2.0] - 2026-04-05

### Changed
- Setup ahora crea `.mcp.json` en la raíz del proyecto (per-project) en vez de configs globales
- Cualquier agente MCP-compatible detecta el archivo automáticamente al abrir el directorio
- El equipo solo commitea `.mcp.json` y todos tienen el MCP sin configurar nada
- Skills se copian al agente (global) porque son del agente, no del proyecto

### Removed
- Configs globales por agente (ya no se escribe en `~/.claude/mcp/`, `~/.config/opencode/`, etc.)

## [2.1.1] - 2026-04-05

### Fixed
- Claude Code: setup escribe en `~/.claude/mcp/project.json` (formato correcto) en vez de `~/.claude/config.json`

## [2.1.0] - 2026-04-05

### Fixed
- Setup ahora configura MCP con `npx -y project-mcp-server` en vez de path absoluto al cache de npx

### Changed
- CLI unificado: `npx project-mcp-server setup` (setup) y `npx project-mcp-server` (server)
- Nuevo entry point `src/cli.ts` que rutea por argumento
- Configs de agentes en README actualizadas a usar `npx`

## [2.0.0] - 2026-04-05

### Added
- Publicado en npm: `npx project-mcp-server setup`
- Setup interactivo: detecta agentes, configura MCP y copia skills en un comando
- Skill `security.md` — checklist OWASP adaptado a Next.js + Prisma
- Skill `project-intelligence.SKILL.md` — integración con SDD (Gentleman AI)
- Todas las skills convertidas a formato Gentleman (YAML frontmatter)
- `ACKNOWLEDGMENTS.md` con créditos a tecnologías y comunidades
- Licencia MIT

### Changed
- Memoria semántica eliminada — ahora la maneja Engram (Gentleman AI)
- Server reducido de 14 a 10 tools (sin `memory_save`, `memory_search`, `memory_session`, `skills_get_relevant`)
- Zero dependencies externas: sin PostgreSQL, sin pgvector, sin OpenAI
- `env_status` simplificado: solo Docker, .env.local y pnpm

### Removed
- `src/db/` — PostgreSQL pool y schema setup
- `src/embeddings/` — OpenAI embeddings
- `src/tools/memory/` — tools de memoria semántica
- Dependencias: `pg`, `@types/pg`

## [1.0.0] - 2026-03-15

### Added
- 14 tools MCP: inteligencia de proyecto, entorno, generación y memoria semántica
- Scanners: App Router, Server Actions, Prisma multi-schema, componentes
- Generación de código basada en schema Prisma real
- Memoria semántica con pgvector + OpenAI embeddings
- Skills: Next.js, Prisma, NextAuth, Zod, shadcn, testing, infra, commit
- Compatible con Claude Code, Open Code, Gemini CLI, Codex, Cursor, VS Code
