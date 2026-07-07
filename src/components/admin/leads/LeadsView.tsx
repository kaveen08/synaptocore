import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { packageShort } from "../lib/format";
import type { Folder, Lead, LeadMailEvent } from "../lib/types";
import { EmptyLeadList, NoSelection } from "./EmptyStates";
import { LeadDetail } from "./LeadDetail";
import { LeadFilterBar, type PackageFilter, type SortOrder, type StatusFilter } from "./LeadFilterBar";
import { LeadListSkeleton } from "./LeadListSkeleton";
import { LeadRow } from "./LeadRow";

export function LeadsView({
  folders,
  leads,
  mailEvents,
  activeFolder,
  searchTerm,
  selectedLeadId,
  dataLoading,
  mutationBusy,
  modalOpen,
  onSelectId,
  onOpenLead,
  onNavigateFolder,
  onToggleRead,
  onBulkMarkRead,
  onMove,
  onDelete,
  onReply,
  onRetryMail,
  onSearchChange,
  onFocusSearch,
}: {
  folders: Folder[];
  leads: Lead[];
  mailEvents: LeadMailEvent[];
  activeFolder: Folder | undefined;
  searchTerm: string;
  selectedLeadId: string | null;
  dataLoading: boolean;
  mutationBusy: boolean;
  /** True while any dialog is open; suspends list keyboard shortcuts. */
  modalOpen: boolean;
  onSelectId: (id: string | null) => void;
  /** Select a lead through user intent: marks it read, opens the mobile modal. */
  onOpenLead: (lead: Lead, mobile: boolean) => void;
  onNavigateFolder: (folderId: string) => void;
  onToggleRead: (lead: Lead) => void;
  onBulkMarkRead: (ids: string[]) => void;
  onMove: (lead: Lead, folder: Folder) => void;
  onDelete: (lead: Lead) => void;
  onReply: (lead: Lead) => void;
  onRetryMail: (leadId: string) => void;
  onSearchChange: (value: string) => void;
  onFocusSearch: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [packageFilter, setPackageFilter] = useState<PackageFilter>("alle");
  const [sort, setSort] = useState<SortOrder>("neueste");

  const query = searchTerm.trim().toLowerCase();
  const searching = query.length > 0;

  const visibleLeads = useMemo(() => {
    const result = leads.filter((lead) => {
      // While searching, look across every folder; otherwise stay in the active one.
      if (!searching && lead.folder_id !== activeFolder?.id) return false;
      if (
        searching &&
        ![lead.name, lead.company, lead.email, lead.phone, lead.message, lead.selected_package]
          .join(" ")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      if (statusFilter === "ungelesen" && !lead.unread) return false;
      if (statusFilter === "unbeantwortet" && lead.replied_at) return false;
      if (statusFilter === "beantwortet" && !lead.replied_at) return false;
      if (packageFilter !== "alle" && packageShort(lead.selected_package) !== packageFilter) return false;
      return true;
    });
    // `leads` arrives sorted newest-first from the query.
    if (sort === "aelteste") return [...result].reverse();
    if (sort === "name") return [...result].sort((a, b) => a.name.localeCompare(b.name, "de"));
    return result;
  }, [leads, activeFolder?.id, searching, query, statusFilter, packageFilter, sort]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const visibleUnread = visibleLeads.filter((lead) => lead.unread);

  useEffect(() => {
    if (!visibleLeads.some((lead) => lead.id === selectedLeadId)) {
      onSelectId(visibleLeads[0]?.id ?? null);
    }
  }, [visibleLeads, selectedLeadId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (modalOpen || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) {
        return;
      }

      const index = visibleLeads.findIndex((lead) => lead.id === selectedLeadId);

      function step(offset: number) {
        const next = visibleLeads[Math.min(visibleLeads.length - 1, Math.max(0, index + offset))];
        if (!next) return;
        onSelectId(next.id);
        document
          .querySelector(`[data-lead-id="${next.id}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }

      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          step(1);
          break;
        case "ArrowUp":
        case "k":
          event.preventDefault();
          step(-1);
          break;
        case "Enter":
          if (selectedLead) {
            event.preventDefault();
            onOpenLead(selectedLead, window.innerWidth < 1024);
          }
          break;
        case "r":
          if (selectedLead) {
            event.preventDefault();
            onReply(selectedLead);
          }
          break;
        case "u":
          if (selectedLead) {
            event.preventDefault();
            onToggleRead(selectedLead);
          }
          break;
        case "/":
          event.preventDefault();
          onFocusSearch();
          break;
        case "Escape":
          if (searchTerm) onSearchChange("");
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visibleLeads, selectedLeadId, selectedLead, modalOpen, searchTerm]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-card p-3 md:hidden">
        <div className="flex gap-2">
          <Select value={activeFolder?.id} onValueChange={(value) => value && onNavigateFolder(value)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Suchen"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <LeadFilterBar
        status={statusFilter}
        packageFilter={packageFilter}
        sort={sort}
        unreadVisible={visibleUnread.length}
        busy={mutationBusy}
        onStatusChange={setStatusFilter}
        onPackageChange={setPackageFilter}
        onSortChange={setSort}
        onMarkAllRead={() => onBulkMarkRead(visibleUnread.map((lead) => lead.id))}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,0.72fr)_minmax(440px,1.28fr)]">
        <section className="min-h-0 overflow-y-auto border-r border-border bg-card" aria-label="Anfragen">
          {dataLoading ? (
            <LeadListSkeleton />
          ) : visibleLeads.length ? (
            <div className="divide-y divide-border">
              {visibleLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  folders={folders}
                  selected={lead.id === selectedLeadId}
                  showFolder={searching}
                  busy={mutationBusy}
                  onSelect={() => onOpenLead(lead, window.innerWidth < 1024)}
                  onToggleRead={() => onToggleRead(lead)}
                  onReply={() => onReply(lead)}
                  onMove={(folder) => onMove(lead, folder)}
                />
              ))}
            </div>
          ) : (
            <EmptyLeadList searchTerm={searchTerm} folderName={activeFolder?.name} />
          )}
        </section>

        <section className="hidden min-h-0 overflow-y-auto bg-card lg:block" aria-label="Anfragedetails">
          {selectedLead ? (
            <LeadDetail
              lead={selectedLead}
              mailEvents={mailEvents.filter((event) => event.lead_id === selectedLead.id)}
              folders={folders}
              busy={mutationBusy}
              onReply={() => onReply(selectedLead)}
              onRetryMail={() => onRetryMail(selectedLead.id)}
              onMove={(folder) => onMove(selectedLead, folder)}
              onDelete={() => onDelete(selectedLead)}
            />
          ) : (
            <NoSelection />
          )}
        </section>
      </div>
    </div>
  );
}
