import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { packageTone } from "../lib/format";
import type { PackageCount } from "../lib/stats";

export function PackageBreakdown({ packageCounts }: { packageCounts: PackageCount[] }) {
  const total = packageCounts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Angefragte Pakete</h2>
      {total === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">Noch keine Anfragen vorhanden.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {packageCounts.map((entry) => (
            <li key={entry.label} className="flex items-center justify-between gap-3">
              <Badge variant="outline" className={cn("font-normal", packageTone(entry.label))}>
                {entry.label}
              </Badge>
              <span className="text-sm tabular-nums text-muted-foreground">
                {entry.count}
                <span className="ml-1.5 text-xs">({Math.round((entry.count / total) * 100)}%)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
