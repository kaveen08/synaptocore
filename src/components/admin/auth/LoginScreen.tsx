import { useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";

import { BrandMark } from "../layout/BrandMark";

const supabase = getSupabase();

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) setError("E-Mail oder Passwort ist ungültig.");
  }

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
      <section className="hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <BrandMark inverted />
          Systemio
        </div>
        <div className="max-w-sm">
          <p className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-balance">
            Jede Anfrage verdient einen klaren nächsten Schritt.
          </p>
          <p className="mt-5 max-w-[42ch] text-sm leading-6 text-sidebar-foreground/70">
            Der interne Arbeitsbereich für Triage, Kontext und Follow-up — ruhig genug für Fokus, schnell genug für den Alltag.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Lead Operations · Zürich</p>
      </section>

      <section className="grid place-items-center px-5 py-10 sm:px-10">
        <form className="w-full max-w-sm" onSubmit={signIn}>
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-sm font-semibold">Systemio</span>
          </div>
          <div className="mb-7">
            <div className="mb-5 flex size-10 items-center justify-center rounded-lg border border-border bg-card">
              <LockKeyhole className="size-4 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em]">Interner Bereich</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Melden Sie sich mit Ihrem freigeschalteten Supabase-Konto an.
            </p>
          </div>
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              {loading ? "Anmeldung läuft …" : "Anmelden"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
