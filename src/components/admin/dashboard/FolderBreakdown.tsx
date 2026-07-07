import type { FolderCount } from "../lib/stats";
import type { Folder } from "../lib/types";

export function FolderBreakdown({
  folderCounts,
  onOpenFolder,
}: {
  folderCounts: FolderCount[];
  onOpenFolder: (folder: Folder) => void;
}) {
  const max = Math.max(1, ...folderCounts.map((entry) => entry.count));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Anfragen pro Stufe</h2>
      <div className="mt-4 space-y-3">
        {folderCounts.map(({ folder, count, unread }) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => onOpenFolder(folder)}
            className="group block w-full rounded-lg p-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium group-hover:text-primary">{folder.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {unread > 0 && <span className="mr-2 font-semibold text-primary">{unread} neu</span>}
                {count}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70 transition-[width]"
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
