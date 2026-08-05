import { useState } from "react";
import { Check, KeyRound, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";

import { BrandMark } from "../layout/BrandMark";

const supabase = getSupabase();

export function UpdatePasswordScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function updatePassword(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) {
      setError("Bitte wählen Sie ein Passwort mit mindestens 12 Zeichen.");
      return;
    }
    if (password !== confirmation) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Das Passwort konnte nicht gespeichert werden. Fordern Sie bitte einen neuen Link an.");
      return;
    }

    setComplete(true);
    window.setTimeout(onComplete, 850);
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-10 sm:px-10">
      <form className="w-full max-w-sm" onSubmit={updatePassword}>
        <div className="mb-9 flex items-center gap-3">
          <BrandMark />
          <span className="text-sm font-semibold">Systemio</span>
        </div>
        <div className="mb-7">
          <div className="mb-5 flex size-10 items-center justify-center rounded-lg border border-border bg-card">
            {complete ? <Check className="size-4 text-primary" /> : <KeyRound className="size-4 text-primary" />}
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Passwort festlegen</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Wählen Sie ein sicheres Passwort für den internen Bereich.</p>
        </div>
        {complete ? (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-primary" role="status">Passwort gespeichert. Der Arbeitsbereich wird geöffnet …</p>
        ) : (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Passwort wiederholen</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            </div>
            {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">{error}</div>}
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
              {loading ? "Wird gespeichert …" : "Passwort speichern"}
            </Button>
          </div>
        )}
      </form>
    </main>
  );
}
