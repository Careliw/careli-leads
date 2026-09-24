import { Filter } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function TopBar({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:h-16 sm:px-4">
      <SidebarTrigger className="-ml-1 size-9 sm:size-8" />
      <Separator orientation="vertical" className="mr-1 h-4" />

      {/* Marca compacta — só visível no mobile, onde a sidebar fica escondida num drawer. */}
      <div className="flex items-center gap-1.5 md:hidden">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Filter className="size-3.5" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
        {description ? (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {description}
          </p>
        ) : null}
      </div>
      {actions}
      <ThemeToggle />
    </header>
  );
}
