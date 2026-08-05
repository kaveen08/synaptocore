import { BrandMark } from "../layout/BrandMark";

function Bar({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded bg-muted ${className}`} />;
}

/**
 * A skeleton of the workspace rather than a message: the few hundred
 * milliseconds before the session and data resolve should look like the app
 * arriving, not like a separate screen the user has to wait through.
 */
export function LoadingScreen() {
  return (
    <div className="h-svh overflow-hidden bg-background text-foreground" aria-busy="true" aria-live="polite">
      <span className="sr-only">Arbeitsbereich wird geladen</span>
      <div className="grid h-full lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="hidden flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-sm font-semibold text-sidebar-foreground">Systemio</span>
          </div>
          <div className="grid gap-2">
            <Bar className="h-8 w-full opacity-60" />
            <Bar className="h-8 w-full opacity-45" />
            <Bar className="h-8 w-full opacity-30" />
            <Bar className="h-8 w-4/5 opacity-25" />
          </div>
        </aside>

        <main className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-6">
            <div className="grid gap-2">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-28 opacity-60" />
            </div>
            <Bar className="h-8 w-44 opacity-50" />
          </div>
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="rounded-xl border border-border bg-card p-5">
                  <Bar className="h-3 w-24 opacity-60" />
                  <Bar className="mt-3 h-7 w-12" />
                  <Bar className="mt-3 h-3 w-32 opacity-40" />
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <Bar className="h-3 w-28 opacity-60" />
                <div className="mt-4 grid gap-3">
                  <Bar className="h-4 w-full opacity-50" />
                  <Bar className="h-4 w-11/12 opacity-40" />
                  <Bar className="h-4 w-10/12 opacity-30" />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <Bar className="h-3 w-24 opacity-60" />
                <div className="mt-4 grid gap-3">
                  <Bar className="h-4 w-9/12 opacity-50" />
                  <Bar className="h-4 w-7/12 opacity-40" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
