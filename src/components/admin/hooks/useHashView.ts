import { useEffect, useState } from "react";

import type { AdminView } from "../lib/types";

function parseHash(): AdminView {
  if (window.location.hash === "#/appointments") return { name: "appointments" };
  const match = window.location.hash.match(/^#\/leads\/(.+)$/);
  if (match) return { name: "leads", folderId: decodeURIComponent(match[1]) };
  return { name: "dashboard" };
}

function toHash(view: AdminView): string {
  if (view.name === "dashboard") return "#/dashboard";
  if (view.name === "appointments") return "#/appointments";
  return `#/leads/${encodeURIComponent(view.folderId)}`;
}

/** View state synced to location.hash so refresh and back/forward work. */
export function useHashView() {
  const [view, setViewState] = useState<AdminView>(() =>
    typeof window === "undefined" ? { name: "dashboard" } : parseHash(),
  );

  useEffect(() => {
    const onHashChange = () => setViewState(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function setView(next: AdminView) {
    const hash = toHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      setViewState(next);
    }
  }

  return [view, setView] as const;
}
