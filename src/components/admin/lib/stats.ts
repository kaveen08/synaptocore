import { packageShort } from "./format";
import type { Folder, Lead, LeadMailEvent } from "./types";

export interface FolderCount {
  folder: Folder;
  count: number;
  unread: number;
}

export interface PackageCount {
  label: string;
  count: number;
}

export interface DashboardStats {
  newLast7: number;
  /** Difference to the 7 days before that (positive = more inquiries). */
  newDelta: number;
  unread: number;
  open: number;
  /** Percentage of leads with a reply, 0–100; null when there are no leads. */
  replyRate: number | null;
  folderCounts: FolderCount[];
  packageCounts: PackageCount[];
  mail: {
    pending: number;
    sent: number;
    failed: number;
    failedEvents: LeadMailEvent[];
  };
  recent: Lead[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function computeDashboardStats(
  leads: Lead[],
  folders: Folder[],
  mailEvents: LeadMailEvent[],
): DashboardStats {
  const now = Date.now();
  const newLast7 = leads.filter((lead) => now - new Date(lead.created_at).getTime() < WEEK_MS).length;
  const newPrev7 = leads.filter((lead) => {
    const age = now - new Date(lead.created_at).getTime();
    return age >= WEEK_MS && age < 2 * WEEK_MS;
  }).length;

  const folderCounts = folders.map((folder) => ({
    folder,
    count: leads.filter((lead) => lead.folder_id === folder.id).length,
    unread: leads.filter((lead) => lead.folder_id === folder.id && lead.unread).length,
  }));

  const packageMap = new Map<string, number>();
  for (const lead of leads) {
    const label = packageShort(lead.selected_package);
    packageMap.set(label, (packageMap.get(label) ?? 0) + 1);
  }
  const packageCounts = [...packageMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const failedEvents = mailEvents.filter((event) => event.status === "failed");

  return {
    newLast7,
    newDelta: newLast7 - newPrev7,
    unread: leads.filter((lead) => lead.unread).length,
    open: leads.filter((lead) => lead.folder_id !== "closed").length,
    replyRate: leads.length
      ? Math.round((leads.filter((lead) => lead.replied_at).length / leads.length) * 100)
      : null,
    folderCounts,
    packageCounts,
    mail: {
      pending: mailEvents.filter((event) => event.status === "pending" || event.status === "processing").length,
      sent: mailEvents.filter((event) => event.status === "sent").length,
      failed: failedEvents.length,
      failedEvents,
    },
    recent: leads.slice(0, 6),
  };
}
