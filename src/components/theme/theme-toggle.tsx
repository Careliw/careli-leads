"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useHasMounted } from "@/hooks/use-has-mounted";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

/** Botão compacto (ícone) para trocar o tema. Usar quando o espaço é apertado (ex: header mobile). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Selecionar tema">
          {/* Evita flash de ícone errado antes da hidratação sem esconder o botão. */}
          {mounted ? <Icon className="size-4" /> : <Monitor className="size-4 opacity-0" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
            <option.icon className="size-4" />
            {option.label}
            {mounted && theme === option.value ? (
              <span className="ml-auto size-1.5 rounded-full bg-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Versão em linha (label + valor atual) para usar no rodapé da sidebar expandida. */
export function ThemeToggleRow() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-xs font-medium text-sidebar-foreground/70">Tema</span>
      <div className="flex items-center gap-0.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-0.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={mounted && theme === option.value}
            onClick={() => setTheme(option.value)}
            className={`flex size-6 items-center justify-center rounded ${
              mounted && theme === option.value
                ? "bg-sidebar text-sidebar-primary shadow-sm"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
            }`}
          >
            <option.icon className="size-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
