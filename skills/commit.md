---
name: commit
description: "Activar cuando se hace un commit, se abre un Pull Request o se prepara un release"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: Commits, PRs y releases

## Cuándo cargar esta skill
- Hacer un commit
- Abrir o cerrar un Pull Request
- Crear una release
- Revisar el estado del repo

---

## Conventional Commits

Formato: `tipo(scope): descripción en minúsculas`

| Tipo | Cuándo usarlo |
|---|---|
| `feat` | Nueva feature visible para el usuario |
| `fix` | Bugfix |
| `refactor` | Cambio de código sin cambio de comportamiento |
| `chore` | Configuración, deps, tooling |
| `docs` | Solo documentación |
| `test` | Solo tests |
| `perf` | Mejora de performance |
| `ci` | Cambios en CI/CD |

```bash
# Ejemplos correctos
git commit -m "feat(auth): agregar login con credentials"
git commit -m "fix(prisma): corregir query de roles en schema rbac"
git commit -m "chore(deps): actualizar next a 16.1.0"
git commit -m "refactor(users): extraer helper de permisos a lib/auth"

# Breaking change
git commit -m "feat(api)!: cambiar estructura de respuesta de /api/users"
```

---

## Flujo de trabajo con ramas

```bash
# Nueva feature
git checkout -b feat/nombre-descriptivo

# Bugfix
git checkout -b fix/descripcion-del-bug

# Chore / refactor
git checkout -b chore/descripcion

# Ver estado antes de commitear
git status
git diff

# Commitear
git add .
git commit -m "feat(scope): descripción"

# Push
git push origin feat/nombre-descriptivo
```

---

## Antes de cada commit — checklist

```bash
# 1. Tipos correctos
pnpm type-check

# 2. Linting
pnpm lint

# 3. Si hay tests
pnpm test

# 4. Build (en PRs importantes)
pnpm build
```

---

## PR — descripción mínima esperada

```markdown
## ¿Qué hace este PR?
Breve descripción del cambio.

## Tipo de cambio
- [ ] Nueva feature
- [ ] Bugfix
- [ ] Refactor
- [ ] Chore

## Checklist
- [ ] `pnpm type-check` pasa
- [ ] `pnpm lint` pasa
- [ ] Tests actualizados (si aplica)
- [ ] Migrations incluidas (si aplica)
- [ ] Variables de entorno documentadas en .env.example (si aplica)
```
