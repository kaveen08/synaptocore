import { Skeleton } from "@/components/ui/skeleton";

export function LeadListSkeleton() {
  return (
    <div className="divide-y divide-border" aria-label="Anfragen werden geladen">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="px-5 py-4">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-2 size-2 rounded-full" />
            <div className="flex-1">
              <div className="flex justify-between gap-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
