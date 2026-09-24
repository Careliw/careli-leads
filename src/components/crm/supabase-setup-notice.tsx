import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SupabaseSetupNotice() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start gap-3 py-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-medium">Supabase ainda não configurado</p>
          <p className="mt-1 text-muted-foreground">
            Defina <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            e <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            em <code className="rounded bg-muted px-1 py-0.5">.env.local</code> e rode a migração em{" "}
            <code className="rounded bg-muted px-1 py-0.5">supabase/migrations</code> para ver dados reais aqui.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
