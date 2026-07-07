import { Inbox, MessageSquareText, Search } from "lucide-react";

export function EmptyLeadList({ searchTerm, folderName }: { searchTerm: string; folderName?: string }) {
  return (
    <div className="grid min-h-full place-items-center px-6 py-16 text-center">
      <div className="max-w-xs">
        <span className="mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-border bg-muted">
          {searchTerm ? <Search className="size-4 text-muted-foreground" /> : <Inbox className="size-4 text-muted-foreground" />}
        </span>
        <h2 className="text-sm font-medium">{searchTerm ? "Keine Treffer" : `${folderName ?? "Dieser Ordner"} ist leer`}</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {searchTerm
            ? "Passen Sie den Suchbegriff oder die Filter an."
            : "Neue oder hierher verschobene Anfragen erscheinen automatisch an dieser Stelle."}
        </p>
      </div>
    </div>
  );
}

export function NoSelection() {
  return (
    <div className="grid min-h-full place-items-center px-8 text-center">
      <div className="max-w-xs">
        <span className="mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-border bg-muted">
          <MessageSquareText className="size-4 text-muted-foreground" />
        </span>
        <h2 className="text-sm font-medium">Anfrage auswählen</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Wählen Sie links eine Anfrage, um Kontaktangaben, Nachricht und nächste Aktionen zu sehen.
        </p>
      </div>
    </div>
  );
}
