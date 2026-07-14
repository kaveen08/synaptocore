import {
  Archive,
  CalendarDays,
  ChevronDown,
  Circle,
  Clock3,
  Download,
  Inbox,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { AdminView, Folder, Lead } from "../lib/types";
import { BrandMark } from "./BrandMark";

const stageIcons: Record<string, typeof Inbox> = {
  inbox: Inbox,
  progress: Clock3,
  pilot: Sparkles,
  closed: Archive,
};

export function Sidebar({
  folders,
  leads,
  view,
  userEmail,
  onNavigate,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onSignOut,
}: {
  folders: Folder[];
  leads: Lead[];
  view: AdminView;
  userEmail?: string;
  onNavigate: (view: AdminView) => void;
  onCreate: () => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onExport: () => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="hidden min-h-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <BrandMark inverted />
        <div>
          <p className="text-sm font-semibold leading-none">Systemio</p>
          <p className="mt-1 text-[11px] text-sidebar-foreground/60">Lead Operations</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="Navigation">
        <button
          type="button"
          onClick={() => onNavigate({ name: "dashboard" })}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            view.name === "dashboard"
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <span className={cn("grid size-6 place-items-center rounded-md", view.name === "dashboard" && "text-sidebar-primary")}>
            <LayoutDashboard className="size-3.5" />
          </span>
          Übersicht
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ name: "appointments" })}
          className={cn(
            "mt-1 flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            view.name === "appointments"
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <span className={cn("grid size-6 place-items-center rounded-md", view.name === "appointments" && "text-sidebar-primary")}>
            <CalendarDays className="size-3.5" />
          </span>
          Termine
        </button>

        <div className="mt-6 mb-3 flex items-center justify-between px-2">
          <p className="text-xs font-medium text-sidebar-foreground/60">Arbeitsfluss</p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCreate}
            aria-label="Ordner erstellen"
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Plus />
          </Button>
        </div>
        <div className="space-y-1">
          {folders.map((folder) => {
            const Icon = stageIcons[folder.id] ?? Circle;
            const count = leads.filter((lead) => lead.folder_id === folder.id).length;
            const unread = leads.filter((lead) => lead.folder_id === folder.id && lead.unread).length;
            const active = view.name === "leads" && folder.id === view.folderId;
            return (
              <div key={folder.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => onNavigate({ name: "leads", folderId: folder.id })}
                  className={cn(
                    "flex h-10 min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <span className={cn("grid size-6 place-items-center rounded-md", active && "text-sidebar-primary")}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="truncate">{folder.name}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {unread > 0 && (
                      <span className="rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sidebar-primary-foreground">
                        {unread}
                      </span>
                    )}
                    <span className="text-xs tabular-nums text-sidebar-foreground/50">{count}</span>
                  </span>
                </button>
                {!folder.locked && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="absolute right-9 text-sidebar-foreground/70 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        />
                      }
                    >
                      <MoreHorizontal />
                      <span className="sr-only">Ordneraktionen</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onRename(folder)}>
                        <Pencil /> Umbenennen
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(folder)}>
                        <Trash2 /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" />}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{userEmail}</span>
              <span className="block text-[11px] text-sidebar-foreground/60">Administrator</span>
            </span>
            <ChevronDown className="size-3.5 text-sidebar-foreground/60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={onExport}>
              <Download /> Daten exportieren
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOut /> Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
