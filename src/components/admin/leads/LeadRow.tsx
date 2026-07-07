import { FolderInput, Mail, MailOpen, Reply } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { packageShort, packageTone, relativeTime } from "../lib/format";
import type { Folder, Lead } from "../lib/types";

export function LeadRow({
  lead,
  folders,
  selected,
  showFolder,
  busy,
  onSelect,
  onToggleRead,
  onReply,
  onMove,
}: {
  lead: Lead;
  folders: Folder[];
  selected: boolean;
  /** Show the containing folder as a chip (used while searching across folders). */
  showFolder: boolean;
  busy: boolean;
  onSelect: () => void;
  onToggleRead: () => void;
  onReply: () => void;
  onMove: (folder: Folder) => void;
}) {
  const folderName = folders.find((folder) => folder.id === lead.folder_id)?.name;

  return (
    <div
      data-lead-id={lead.id}
      className={cn(
        "group relative transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full px-4 py-4 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
      >
        <div className="flex items-start gap-3">
          <span className="mt-1.5 flex size-2 shrink-0">
            {lead.unread && <span className="size-2 rounded-full bg-primary" aria-label="Ungelesen" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className={cn("truncate text-sm", lead.unread ? "font-semibold text-foreground" : "font-medium")}>
                {lead.name}
              </span>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{relativeTime(lead.created_at)}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.company || "Keine Firma"}</p>
            <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
              {lead.message || "Keine Nachricht hinterlassen."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("font-normal", packageTone(lead.selected_package))}>
                {packageShort(lead.selected_package)}
              </Badge>
              {showFolder && folderName && (
                <Badge variant="secondary" className="font-normal">
                  {folderName}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </button>

      <div className="absolute top-2.5 right-3 z-10 hidden items-center gap-1 rounded-lg border border-border bg-card p-0.5 shadow-sm group-focus-within:flex group-hover:flex">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleRead}
          disabled={busy}
          aria-label={lead.unread ? "Als gelesen markieren" : "Als ungelesen markieren"}
          title={lead.unread ? "Als gelesen markieren" : "Als ungelesen markieren"}
        >
          {lead.unread ? <MailOpen /> : <Mail />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onReply} aria-label="Antworten" title="Antworten">
          <Reply />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Verschieben" title="Verschieben" />}
          >
            <FolderInput />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Verschieben nach</DropdownMenuLabel>
            {folders
              .filter((folder) => folder.id !== lead.folder_id)
              .map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => onMove(folder)} disabled={busy}>
                  {folder.name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
