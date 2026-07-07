import { CircleCheck, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { DashboardStats } from "../lib/stats";
import type { Lead } from "../lib/types";

const kindLabels: Record<string, string> = {
  owner_notification: "Interne Benachrichtigung",
  customer_confirmation: "Kundenbestätigung",
};

export function MailHealthCard({
  mail,
  leads,
  busy,
  onRetry,
}: {
  mail: DashboardStats["mail"];
  leads: Lead[];
  busy: boolean;
  onRetry: (leadId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">E-Mail-Zustellung</h2>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-muted p-3">
          <dd className="text-xl font-semibold tabular-nums">{mail.sent}</dd>
          <dt className="mt-0.5 text-[11px] text-muted-foreground">zugestellt</dt>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <dd className="text-xl font-semibold tabular-nums">{mail.pending}</dd>
          <dt className="mt-0.5 text-[11px] text-muted-foreground">ausstehend</dt>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <dd className="text-xl font-semibold tabular-nums text-destructive">{mail.failed}</dd>
          <dt className="mt-0.5 text-[11px] text-muted-foreground">fehlgeschlagen</dt>
        </div>
      </dl>

      {mail.failed === 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
          <CircleCheck className="size-3.5 shrink-0" /> Alle E-Mails zugestellt oder in Arbeit.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {mail.failedEvents.map((event) => {
            const lead = leads.find((item) => item.id === event.lead_id);
            return (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5"
              >
                <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{lead?.name ?? "Gelöschte Anfrage"}</p>
                  <p className="text-[11px] text-muted-foreground">{kindLabels[event.kind] ?? event.kind}</p>
                </div>
                {lead && (
                  <Button variant="outline" size="sm" onClick={() => onRetry(lead.id)} disabled={busy}>
                    {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                    Erneut versuchen
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
