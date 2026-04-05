---
name: shadcn
description: "Activar cuando se crean o modifican componentes de UI, se agregan componentes de shadcn o se trabaja con Tailwind CSS"
license: MIT
metadata:
  version: "1.0.0"
---

# Skill: shadcn/ui + Tailwind CSS 4

## Cuándo cargar esta skill
- Crear o modificar componentes de UI
- Agregar nuevos componentes de shadcn
- Trabajar con Tailwind CSS 4
- Implementar dark/light mode
- Usar Radix UI primitivos directamente

---

## Tailwind CSS 4 — diferencias clave con v3

```css
/* ✓ Tailwind 4: importar en CSS, no usar tailwind.config.js */
@import "tailwindcss";

/* Definir design tokens como variables CSS */
@theme {
  --color-primary: oklch(0.5 0.2 260);
  --color-primary-foreground: oklch(0.99 0 0);
  --font-sans: "Inter", sans-serif;
  --radius: 0.5rem;
}
```

```typescript
// ✗ Tailwind 4: ya no existe tailwind.config.js como antes
// ✓ Toda la configuración va en globals.css con @theme

// Las clases siguen siendo las mismas en templates
<div className="bg-primary text-primary-foreground rounded-lg p-4">
```

### Variables CSS de shadcn en Tailwind 4
```css
/* globals.css */
@import "tailwindcss";

@theme {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --radius: 0.5rem;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... resto de dark mode vars */
}
```

---

## shadcn/ui — agregar componentes

```bash
# Agregar un componente nuevo (siempre con pnpm dlx)
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card dialog form input table
pnpm dlx shadcn@latest add data-table  # con columnas configurables

# Ver todos los disponibles
pnpm dlx shadcn@latest add --list
```

Los componentes se generan en `src/components/ui/`. **No modificar** esos archivos
directamente — crear wrappers en `src/components/[feature]/`.

---

## Patrones de componentes

### Componente con CVA (variantes)
```typescript
// components/ui/badge.tsx — patrón típico de shadcn
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground"
      }
    },
    defaultVariants: { variant: "default" }
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
```

### Componente wrapper de shadcn (extensión)
```typescript
// components/users/user-card.tsx — wrapper, no modifica el original
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface UserCardProps {
  user: { name: string; email: string; role: string; avatar?: string }
  className?: string
}

export function UserCard({ user, className }: UserCardProps) {
  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Avatar>
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle className="text-base">{user.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{user.role}</Badge>
      </CardHeader>
    </Card>
  )
}
```

---

## Forms con shadcn/ui + React Hook Form + Zod

```typescript
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useActionState } from "react"
import { createUser } from "@/server/actions/users"

const FormSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido")
})

export function CreateUserForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: "", email: "" }
  })

  const [state, action, isPending] = useActionState(createUser, null)

  return (
    <Form {...form}>
      <form action={action} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Alan García" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando..." : "Crear usuario"}
        </Button>
      </form>
    </Form>
  )
}
```

---

## Dark mode con next-themes

```typescript
// app/layout.tsx
import { ThemeProvider } from "next-themes"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

// components/theme-toggle.tsx
"use client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

---

## Toasts con Sonner

```typescript
// app/layout.tsx — agregar el Toaster
import { Toaster } from "sonner"

// En el layout
<Toaster richColors position="bottom-right" />

// Uso en Client Components
import { toast } from "sonner"

// Éxito, error, promesa
toast.success("Usuario creado")
toast.error("Error al guardar")
toast.promise(saveUser(), {
  loading: "Guardando...",
  success: "Guardado",
  error: "Error al guardar"
})
```

---

## cn() — utilitaria de clases

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Uso: merge condicional sin conflictos de Tailwind
cn("px-4 py-2", isActive && "bg-primary", className)
// ✓ Resuelve conflictos: cn("p-4", "px-2") → "p-4 px-2" (px-2 gana)
```
