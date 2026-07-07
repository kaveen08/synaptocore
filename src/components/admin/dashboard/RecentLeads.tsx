import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { packageShort, packageTone, relativeTime } from "../lib/format";
import type { Folder, Lead } from "../lib/types";

export function RecentLeads({
  leads,
  folders,
  onOpenLead,
}: {
  leads: Lead[];
  folders: Folder[];
  onOpenLead: (lead: Lead) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Neueste Anfragen</h2>
      {leads.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Sobald Anfragen über das Formular eingehen, erscheinen sie hier.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {leads.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => onOpenLead(lead)}
                className="flex w-full items-center gap-3 rounded-lg px-1.5 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-2 shrink-0">
                  {lead.unread && <span className="size-2 rounded-full bg-primary" aria-label="Ungelesen" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", lead.unread ? "font-semibold" : "font-medium")}>
                    {lead.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {lead.company || "Keine Firma"} · {folders.find((folder) => folder.id === lead.folder_id)?.name ?? lead.folder_id}
                  </span>
                </span>
                <Badge variant="outline" className={cn("shrink-0 font-normal", packageTone(lead.selected_package))}>
                  {packageShort(lead.selected_package)}
                </Badge>
                <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
                  {relativeTime(lead.created_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
