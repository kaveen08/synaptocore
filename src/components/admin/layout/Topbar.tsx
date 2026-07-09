import { CalendarDays, Download, LayoutDashboard, LogOut, Menu, Plus, RefreshCw, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Topbar({
  title,
  subtitle,
  count,
  searchTerm,
  searchRef,
  refreshing,
  userEmail,
  searchEnabled = true,
  onSearchChange,
  onRefresh,
  onExport,
  onCreateFolder,
  onNavigateDashboard,
  onNavigateAppointments,
  onSignOut,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  searchTerm: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  refreshing: boolean;
  userEmail?: string;
  searchEnabled?: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onCreateFolder: () => void;
  onNavigateDashboard: () => void;
  onNavigateAppointments: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-semibold tracking-[-0.015em]">{title}</h1>
          {count !== undefined && (
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          )}
        </div>
        {subtitle && <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{subtitle}</p>}
      </div>

      {searchEnabled && <div className="relative hidden w-full max-w-sm md:block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Name, Firma oder Nachricht suchen"
          className="h-9 bg-background pl-9"
          aria-label="Anfragen durchsuchen"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => onSearchChange("")}
            aria-label="Suche löschen"
          >
            <X />
          </Button>
        )}
      </div>}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Daten aktualisieren"
      >
        <RefreshCw className={cn(refreshing && "animate-spin")} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="lg:hidden" />}>
          <Menu />
          <span className="sr-only">Menü öffnen</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onNavigateDashboard}>
            <LayoutDashboard /> Übersicht
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNavigateAppointments}>
            <CalendarDays /> Termine
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Download /> Exportieren
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCreateFolder}>
            <Plus /> Ordner erstellen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onSignOut}>
            <LogOut /> Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
