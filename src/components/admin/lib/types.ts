import type { Database } from "@/lib/database.types";

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
export type LeadMailEvent = Database["public"]["Tables"]["lead_mail_events"]["Row"];
export type AuthState = "loading" | "signed-out" | "authorized" | "denied";

export type AdminView = { name: "dashboard" } | { name: "leads"; folderId: string };
