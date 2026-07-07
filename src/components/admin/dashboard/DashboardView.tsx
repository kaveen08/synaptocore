import { useMemo } from "react";

import { computeDashboardStats } from "../lib/stats";
import type { Folder, Lead, LeadMailEvent } from "../lib/types";
import { FolderBreakdown } from "./FolderBreakdown";
import { MailHealthCard } from "./MailHealthCard";
import { PackageBreakdown } from "./PackageBreakdown";
import { RecentLeads } from "./RecentLeads";
import { StatCard } from "./StatCard";

export function DashboardView({
  leads,
  folders,
  mailEvents,
  busy,
  onOpenFolder,
  onOpenLead,
  onRetryMail,
}: {
  leads: Lead[];
  folders: Folder[];
  mailEvents: LeadMailEvent[];
  busy: boolean;
  onOpenFolder: (folder: Folder) => void;
  onOpenLead: (lead: Lead) => void;
  onRetryMail: (leadId: string) => void;
}) {
  const stats = useMemo(() => computeDashboardStats(leads, folders, mailEvents), [leads, folders, mailEvents]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Neue Anfragen (7 Tage)"
            value={String(stats.newLast7)}
            delta={stats.newDelta}
            hint="im Vergleich zur Vorwoche"
          />
          <StatCard label="Ungelesen" value={String(stats.unread)} hint="warten auf eine erste Sichtung" />
          <StatCard label="Offen" value={String(stats.open)} hint="alle Anfragen ausserhalb von «Closed»" />
          <StatCard
            label="Antwortquote"
            value={stats.replyRate === null ? "–" : `${stats.replyRate}%`}
            hint="Anteil beantworteter Anfragen"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <RecentLeads leads={stats.recent} folders={folders} onOpenLead={onOpenLead} />
          <div className="grid gap-4">
            <FolderBreakdown folderCounts={stats.folderCounts} onOpenFolder={onOpenFolder} />
            <PackageBreakdown packageCounts={stats.packageCounts} />
          </div>
        </div>

        <div className="mt-4">
          <MailHealthCard mail={stats.mail} leads={leads} busy={busy} onRetry={onRetryMail} />
        </div>
      </div>
    </div>
  );
}
