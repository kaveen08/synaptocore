import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";

import type { AuthState, Folder, Lead, LeadMailEvent, LeadUpdate } from "../lib/types";

const supabase = getSupabase();

export function useAdminData() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<Session | null>();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mailEvents, setMailEvents] = useState<LeadMailEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadData(showRefresh = false) {
    if (!session) return;
    showRefresh ? setRefreshing(true) : setDataLoading(true);

    const [folderResult, leadResult, mailResult] = await Promise.all([
      supabase.from("folders").select("*").order("sort_order"),
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("lead_mail_events").select("*"),
    ]);

    setRefreshing(false);
    setDataLoading(false);

    const error = folderResult.error ?? leadResult.error ?? mailResult.error;
    if (error) {
      console.error(error);
      toast.error("Daten konnten nicht geladen werden.");
      return;
    }

    // An empty folder list means RLS blocked the query: signed in, but not on
    // the admin allowlist.
    if (!folderResult.data?.length) {
      setAuthState("denied");
      return;
    }

    setFolders(folderResult.data);
    setLeads(leadResult.data ?? []);
    setMailEvents(mailResult.data ?? []);
    setAuthState("authorized");
  }

  useEffect(() => {
    if (session === undefined) {
      setAuthState("loading");
      return;
    }
    if (session === null) {
      setAuthState("signed-out");
      setFolders([]);
      setLeads([]);
      setMailEvents([]);
      return;
    }
    void loadData();
  }, [session]);

  async function updateLead(id: string, values: LeadUpdate, successMessage?: string) {
    setMutationBusy(true);
    const { error } = await supabase.from("leads").update(values).eq("id", id);
    setMutationBusy(false);
    if (error) {
      console.error(error);
      toast.error("Änderung konnte nicht gespeichert werden.");
      return false;
    }
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, ...values } as Lead : lead)));
    if (successMessage) toast.success(successMessage);
    return true;
  }

  async function markRead(lead: Lead) {
    if (!lead.unread) return;
    setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, unread: false } : item)));
    const { error } = await supabase.from("leads").update({ unread: false }).eq("id", lead.id);
    if (error) {
      console.error(error);
      toast.error("Lesestatus konnte nicht gespeichert werden.");
    }
  }

  async function toggleRead(lead: Lead) {
    const unread = !lead.unread;
    return updateLead(lead.id, { unread }, unread ? "Als ungelesen markiert." : "Als gelesen markiert.");
  }

  async function bulkMarkRead(ids: string[]) {
    if (!ids.length) return;
    setMutationBusy(true);
    const { error } = await supabase.from("leads").update({ unread: false }).in("id", ids);
    setMutationBusy(false);
    if (error) {
      console.error(error);
      toast.error("Lesestatus konnte nicht gespeichert werden.");
      return;
    }
    setLeads((current) => current.map((lead) => (ids.includes(lead.id) ? { ...lead, unread: false } : lead)));
    toast.success(`${ids.length} ${ids.length === 1 ? "Anfrage" : "Anfragen"} als gelesen markiert.`);
  }

  async function moveLead(lead: Lead, folder: Folder) {
    return updateLead(lead.id, { folder_id: folder.id }, `Nach «${folder.name}» verschoben.`);
  }

  async function deleteLead(lead: Lead) {
    setMutationBusy(true);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setMutationBusy(false);
    if (error) {
      console.error(error);
      toast.error("Anfrage konnte nicht gelöscht werden.");
      return false;
    }
    setLeads((current) => current.filter((item) => item.id !== lead.id));
    setMailEvents((current) => current.filter((event) => event.lead_id !== lead.id));
    toast.success("Anfrage gelöscht.");
    return true;
  }

  async function createFolder(name: string) {
    setMutationBusy(true);
    const sortOrder = Math.max(0, ...folders.map((folder) => folder.sort_order)) + 10;
    const { data, error } = await supabase
      .from("folders")
      .insert({ id: crypto.randomUUID(), name, locked: false, sort_order: sortOrder })
      .select()
      .single();
    setMutationBusy(false);
    if (error) {
      console.error(error);
      toast.error("Ordner konnte nicht erstellt werden.");
      return false;
    }
    setFolders((current) => [...current, data].sort((a, b) => a.sort_order - b.sort_order));
    toast.success(`Ordner «${name}» erstellt.`);
    return true;
  }

  async function renameFolder(folder: Folder, name: string) {
    setMutationBusy(true);
    const { error } = await supabase.from("folders").update({ name }).eq("id", folder.id);
    setMutationBusy(false);
    if (error) {
      console.error(error);
      toast.error("Ordner konnte nicht umbenannt werden.");
      return false;
    }
    setFolders((current) => current.map((item) => (item.id === folder.id ? { ...item, name } : item)));
    toast.success("Ordner umbenannt.");
    return true;
  }

  async function deleteFolder(folder: Folder) {
    setMutationBusy(true);
    const moveResult = await supabase
      .from("leads")
      .update({ folder_id: "inbox" })
      .eq("folder_id", folder.id);
    if (moveResult.error) {
      setMutationBusy(false);
      console.error(moveResult.error);
      toast.error("Anfragen konnten nicht verschoben werden.");
      return false;
    }
    const deleteResult = await supabase.from("folders").delete().eq("id", folder.id);
    setMutationBusy(false);
    if (deleteResult.error) {
      console.error(deleteResult.error);
      toast.error("Ordner konnte nicht gelöscht werden.");
      return false;
    }
    setFolders((current) => current.filter((item) => item.id !== folder.id));
    setLeads((current) =>
      current.map((lead) => (lead.folder_id === folder.id ? { ...lead, folder_id: "inbox" } : lead)),
    );
    toast.success("Ordner gelöscht; enthaltene Anfragen sind zurück in der Inbox.");
    return true;
  }

  async function retryLeadMail(leadId: string) {
    setMutationBusy(true);
    const { data, error } = await supabase.rpc("retry_lead_mail", { p_lead_id: leadId });
    setMutationBusy(false);
    if (error) {
      console.error(error);
      toast.error("Der E-Mail-Versand konnte nicht erneut gestartet werden.");
      return;
    }

    setMailEvents((current) =>
      current.map((event) =>
        event.lead_id === leadId && event.status === "failed"
          ? {
              ...event,
              status: "pending",
              attempts: 0,
              next_attempt_at: new Date().toISOString(),
              locked_at: null,
              last_error: null,
            }
          : event,
      ),
    );
    toast.success(data ? "E-Mail-Versand wird erneut versucht." : "Keine fehlgeschlagene E-Mail gefunden.");
  }

  function exportData() {
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), folders, leads }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `synaptocore-leads-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Export erstellt.");
  }

  function signOut() {
    void supabase.auth.signOut();
  }

  return {
    authState,
    session,
    folders,
    leads,
    mailEvents,
    dataLoading,
    refreshing,
    mutationBusy,
    loadData,
    updateLead,
    markRead,
    toggleRead,
    bulkMarkRead,
    moveLead,
    deleteLead,
    createFolder,
    renameFolder,
    deleteFolder,
    retryLeadMail,
    exportData,
    signOut,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
