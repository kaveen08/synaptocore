import { MailOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type StatusFilter = "alle" | "ungelesen" | "unbeantwortet" | "beantwortet";
export type PackageFilter = "alle" | "Pilot" | "Core Solution" | "Managed Service" | "Erstgespräch";
export type SortOrder = "neueste" | "aelteste" | "name";

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "ungelesen", label: "Ungelesen" },
  { value: "unbeantwortet", label: "Unbeantwortet" },
  { value: "beantwortet", label: "Beantwortet" },
];

export function LeadFilterBar({
  status,
  packageFilter,
  sort,
  unreadVisible,
  busy,
  onStatusChange,
  onPackageChange,
  onSortChange,
  onMarkAllRead,
}: {
  status: StatusFilter;
  packageFilter: PackageFilter;
  sort: SortOrder;
  unreadVisible: number;
  busy: boolean;
  onStatusChange: (value: StatusFilter) => void;
  onPackageChange: (value: PackageFilter) => void;
  onSortChange: (value: SortOrder) => void;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1" role="group" aria-label="Nach Status filtern">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onStatusChange(option.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              status === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {unreadVisible > 0 && (
          <Button variant="ghost" size="sm" onClick={onMarkAllRead} disabled={busy}>
            <MailOpen /> Alle als gelesen markieren
          </Button>
        )}
        <Select value={packageFilter} onValueChange={(value) => value && onPackageChange(value as PackageFilter)}>
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Nach Paket filtern">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Pakete</SelectItem>
            <SelectItem value="Pilot">Pilot</SelectItem>
            <SelectItem value="Core Solution">Core Solution</SelectItem>
            <SelectItem value="Managed Service">Managed Service</SelectItem>
            <SelectItem value="Erstgespräch">Erstgespräch</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => value && onSortChange(value as SortOrder)}>
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Sortierung">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="neueste">Neueste zuerst</SelectItem>
            <SelectItem value="aelteste">Älteste zuerst</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
