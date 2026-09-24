import { ChevronsUpDown, LogOut, User } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { signOut } from "@/app/(dashboard)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { ThemeToggleRow } from "@/components/theme/theme-toggle";

/** Linha de usuário no rodapé da sidebar: avatar, e-mail, tema e logout. */
export async function UserMenu() {
  let email = "convidado";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? "convidado";
  }
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
          <Avatar className="size-7 rounded-md">
            <AvatarFallback className="rounded-md bg-primary/15 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">{email}</span>
          <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{email}</span>
          <span className="text-xs font-normal text-muted-foreground">Gestor de tráfego</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <ThemeToggleRow />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/configuracoes">
            <User className="size-4" />
            Meu perfil
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut} className="w-full">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut className="size-4" />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
