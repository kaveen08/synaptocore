import { LockKeyhole, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AccessDenied({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-lg border border-border bg-card">
          <LockKeyhole className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.025em]">Kein Admin-Zugriff</h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-sm leading-6 text-muted-foreground">
          {email ?? "Dieses Konto"} ist angemeldet, aber nicht für den internen Arbeitsbereich freigeschaltet.
        </p>
        <Button variant="outline" className="mt-6" onClick={onSignOut}>
          <LogOut /> Mit anderem Konto anmelden
        </Button>
      </div>
    </main>
  );
}
