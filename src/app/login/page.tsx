import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithPassword } from "@/app/login/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      {/* Blobs decorativos, sutis, só para dar profundidade ao fundo branco/cinza. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-72 rounded-full bg-primary/10 blur-3xl sm:size-96"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 size-72 rounded-full bg-primary/10 blur-3xl sm:size-96"
      />

      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Filter className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Careli Leads</h1>
            <p className="text-sm text-muted-foreground">
              Entre para gerenciar seus leads de tráfego pago
            </p>
          </div>
        </div>

        <Card className="border-border/60 shadow-xl shadow-foreground/5">
          <CardHeader>
            <CardTitle className="text-base">Entrar</CardTitle>
            <CardDescription>Use seu e-mail e senha de acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signInWithPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@empresa.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Careli Leads · CRM para gestão de leads
        </p>
      </div>
    </div>
  );
}
