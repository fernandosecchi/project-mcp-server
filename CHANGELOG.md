# Changelog

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
