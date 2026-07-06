import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Archive,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Download,
  Ellipsis,
  FolderInput,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/lib/database.types";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Folder = Database["public"]["Tables"]["folders"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type AuthState = "loading" | "signed-out" | "authorized" | "denied";

const supabase = getSupabase();

const stageIcons: Record<string, typeof Inbox> = {
  inbox: Inbox,
  progress: Clock3,
  pilot: Sparkles,
  closed: Archive,
};

function packageShort(value: string): string {
  if (value.includes("Pilot")) return "Pilot";
  if (value.includes("Core")) return "Core Solution";
  if (value.includes("Managed")) return "Managed Service";
  return value || "Nicht angegeben";
}

function packageTone(value: string): string {
  if (value.includes("Pilot")) return "border-blue-400/20 bg-blue-400/10 text-blue-200";
  if (value.includes("Core")) return "border-violet-400/20 bg-violet-400/10 text-violet-200";
  if (value.includes("Managed")) return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (value.includes("Erstgespräch")) return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-border bg-muted text-muted-foreground";
}

function relativeTime(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return new Date(value).toLocaleDateString("de-CH");
}

function buildDraft(lead: Lead): string {
  const packageName = packageShort(lead.selected_package);
  const context = lead.message
    ? `Sie schreiben: «${lead.message.length > 140 ? `${lead.message.slice(0, 140)}…` : lead.message}»\n\n`
    : "";

  let body = `vielen Dank für Ihre Anfrage.\n\n${context}Gerne melden wir uns mit einer konkreten Einschätzung. Wann erreichen wir Sie am besten für ein kurzes Erstgespräch?`;

  if (packageName === "Pilot") {
    body = `gerne bestätigen wir den Erhalt Ihrer Anfrage für den kostenlosen Pilot.\n\n${context}In einem kurzen Erstgespräch identifizieren wir den Prozess, der Sie aktuell am meisten Zeit kostet. Anschliessend testen Sie die Automatisierung sieben Tage unverbindlich. Welche zwei oder drei Zeitfenster passen Ihnen?`;
  } else if (packageName === "Core Solution") {
    body = `vielen Dank für Ihr Interesse an unserer Core Solution.\n\n${context}Gerne zeigen wir Ihnen anhand Ihres konkreten Falls, wie wir Ihre bestehenden Tools über sichere KI-Pipelines verbinden. Wann passt Ihnen ein kurzes Gespräch?`;
  } else if (packageName === "Managed Service") {
    body = `vielen Dank für Ihre Anfrage zum Managed Service.\n\n${context}Gerne besprechen wir Ihre bestehende Umgebung und den laufenden Betreuungsbedarf in einem kurzen Call. Wann erreichen wir Sie am besten?`;
  }

  return `Guten Tag ${lead.name}\n\n${body}\n\nFreundliche Grüsse\nSynaptoCore · Zürich\nsynaptocore@gmail.com · +41 78 809 00 94`;
}

export default function AdminApp() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<Session | null>();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeFolderId, setActiveFolderId] = useState("inbox");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileLeadOpen, setMobileLeadOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" | "rename"; folder?: Folder } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<Lead | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
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

    const [folderResult, leadResult] = await Promise.all([
      supabase.from("folders").select("*").order("sort_order"),
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
    ]);

    setRefreshing(false);
    setDataLoading(false);

    const error = folderResult.error ?? leadResult.error;
    if (error) {
      console.error(error);
      toast.error("Daten konnten nicht geladen werden.");
      return;
    }

    if (!folderResult.data?.length) {
      setAuthState("denied");
      return;
    }

    setFolders(folderResult.data);
    setLeads(leadResult.data ?? []);
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
      return;
    }
    void loadData();
  }, [session]);

  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? folders[0];
  const filteredLeads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      if (lead.folder_id !== activeFolder?.id) return false;
      if (!query) return true;
      return [lead.name, lead.company, lead.email, lead.phone, lead.message, lead.selected_package]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeFolder?.id, leads, searchTerm]);
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const unreadCount = leads.filter((lead) => lead.unread).length;
  const openCount = leads.filter((lead) => lead.folder_id !== "closed").length;

  useEffect(() => {
    if (!filteredLeads.some((lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId(filteredLeads[0]?.id ?? null);
    }
  }, [activeFolderId, filteredLeads, selectedLeadId]);

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

  async function selectLead(lead: Lead, mobile = false) {
    setSelectedLeadId(lead.id);
    if (mobile) setMobileLeadOpen(true);
    if (!lead.unread) return;
    setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, unread: false } : item)));
    const { error } = await supabase.from("leads").update({ unread: false }).eq("id", lead.id);
    if (error) {
      console.error(error);
      toast.error("Lesestatus konnte nicht gespeichert werden.");
    }
  }

  async function moveLead(lead: Lead, folder: Folder) {
    if (await updateLead(lead.id, { folder_id: folder.id }, `Nach «${folder.name}» verschoben.`)) {
      setMobileLeadOpen(false);
    }
  }

  async function deleteLead() {
    if (!deleteLeadTarget) return;
    setMutationBusy(true);
    const { error } = await supabase.from("leads").delete().eq("id", deleteLeadTarget.id);
    setMutationBusy(false);
    if (error) {
      console.error(error);
      toast.error("Anfrage konnte nicht gelöscht werden.");
      return;
    }
    setLeads((current) => current.filter((lead) => lead.id !== deleteLeadTarget.id));
    setDeleteLeadTarget(null);
    setMobileLeadOpen(false);
    toast.success("Anfrage gelöscht.");
  }

  function openFolderDialog(mode: "create" | "rename", folder?: Folder) {
    setFolderName(folder?.name ?? "");
    setFolderDialog({ mode, folder });
  }

  async function saveFolder() {
    const name = folderName.trim();
    if (!name || !folderDialog) return;
    setMutationBusy(true);

    if (folderDialog.mode === "create") {
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
        return;
      }
      setFolders((current) => [...current, data].sort((a, b) => a.sort_order - b.sort_order));
      toast.success(`Ordner «${name}» erstellt.`);
    } else if (folderDialog.folder) {
      const { error } = await supabase.from("folders").update({ name }).eq("id", folderDialog.folder.id);
      setMutationBusy(false);
      if (error) {
        console.error(error);
        toast.error("Ordner konnte nicht umbenannt werden.");
        return;
      }
      setFolders((current) =>
        current.map((folder) => (folder.id === folderDialog.folder?.id ? { ...folder, name } : folder)),
      );
      toast.success("Ordner umbenannt.");
    }

    setFolderDialog(null);
  }

  async function deleteFolder() {
    if (!deleteFolderTarget) return;
    setMutationBusy(true);
    const moveResult = await supabase
      .from("leads")
      .update({ folder_id: "inbox" })
      .eq("folder_id", deleteFolderTarget.id);
    if (moveResult.error) {
      setMutationBusy(false);
      console.error(moveResult.error);
      toast.error("Anfragen konnten nicht verschoben werden.");
      return;
    }
    const deleteResult = await supabase.from("folders").delete().eq("id", deleteFolderTarget.id);
    setMutationBusy(false);
    if (deleteResult.error) {
      console.error(deleteResult.error);
      toast.error("Ordner konnte nicht gelöscht werden.");
      return;
    }
    setFolders((current) => current.filter((folder) => folder.id !== deleteFolderTarget.id));
    setLeads((current) =>
      current.map((lead) => (lead.folder_id === deleteFolderTarget.id ? { ...lead, folder_id: "inbox" } : lead)),
    );
    setActiveFolderId("inbox");
    setDeleteFolderTarget(null);
    toast.success("Ordner gelöscht; enthaltene Anfragen sind zurück in der Inbox.");
  }

  function openReply(lead: Lead) {
    setSelectedLeadId(lead.id);
    setReplySubject(`Re: Ihre Anfrage bei SynaptoCore — ${packageShort(lead.selected_package)}`);
    setReplyBody("");
    setReplyOpen(true);
  }

  function generateDraft() {
    if (!selectedLead) return;
    setAiDrafting(true);
    window.setTimeout(() => {
      setReplyBody(buildDraft(selectedLead));
      setAiDrafting(false);
    }, 450);
  }

  async function saveReply() {
    if (!selectedLead || !replyBody.trim()) return;
    const values: LeadUpdate = { replied_at: new Date().toISOString(), unread: false };
    if (selectedLead.folder_id === "inbox") values.folder_id = "progress";
    if (await updateLead(selectedLead.id, values, "Antwort als erledigt markiert.")) {
      setReplyOpen(false);
      setMobileLeadOpen(false);
    }
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

  if (authState === "loading") return <LoadingScreen />;
  if (authState === "signed-out") return <LoginScreen />;
  if (authState === "denied") {
    return (
      <AccessDenied
        email={session?.user.email}
        onSignOut={() => void supabase.auth.signOut()}
      />
    );
  }

  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
      <div className="grid h-full lg:grid-cols-[248px_minmax(0,1fr)]">
        <StageRail
          folders={folders}
          leads={leads}
          activeFolderId={activeFolder?.id ?? activeFolderId}
          userEmail={session?.user.email}
          onSelect={setActiveFolderId}
          onCreate={() => openFolderDialog("create")}
          onRename={(folder) => openFolderDialog("rename", folder)}
          onDelete={setDeleteFolderTarget}
          onExport={exportData}
          onSignOut={() => void supabase.auth.signOut()}
        />

        <main className="flex min-w-0 flex-col overflow-hidden">
          <header className="flex min-h-16 items-center gap-3 border-b border-border px-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-[-0.015em]">
                  {activeFolder?.name ?? "Lead Operations"}
                </h1>
                <Badge variant="secondary" className="tabular-nums">
                  {filteredLeads.length}
                </Badge>
              </div>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                {openCount} offen · {unreadCount} ungelesen
              </p>
            </div>

            <div className="relative hidden w-full max-w-sm md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name, Firma oder Nachricht suchen"
                className="h-9 pl-9"
                aria-label="Anfragen durchsuchen"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => setSearchTerm("")}
                  aria-label="Suche löschen"
                >
                  <X />
                </Button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadData(true)}
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
                <DropdownMenuLabel>{session?.user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportData}>
                  <Download /> Exportieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openFolderDialog("create")}>
                  <Plus /> Ordner erstellen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => void supabase.auth.signOut()}>
                  <LogOut /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div className="border-b border-border p-3 md:hidden">
            <div className="flex gap-2">
              <Select value={activeFolder?.id} onValueChange={(value) => value && setActiveFolderId(value)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Suchen"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,0.72fr)_minmax(440px,1.28fr)]">
            <section className="min-h-0 overflow-y-auto border-r border-border" aria-label="Anfragen">
              {dataLoading ? (
                <LeadListSkeleton />
              ) : filteredLeads.length ? (
                <div className="divide-y divide-border">
                  {filteredLeads.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      selected={lead.id === selectedLeadId}
                      onSelect={() => void selectLead(lead, window.innerWidth < 1024)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyLeadList searchTerm={searchTerm} folderName={activeFolder?.name} />
              )}
            </section>

            <section className="hidden min-h-0 overflow-y-auto lg:block" aria-label="Anfragedetails">
              {selectedLead ? (
                <LeadDetail
                  lead={selectedLead}
                  folders={folders}
                  busy={mutationBusy}
                  onReply={() => openReply(selectedLead)}
                  onMove={(folder) => void moveLead(selectedLead, folder)}
                  onDelete={() => setDeleteLeadTarget(selectedLead)}
                />
              ) : (
                <NoSelection />
              )}
            </section>
          </div>
        </main>
      </div>

      <Dialog open={mobileLeadOpen} onOpenChange={setMobileLeadOpen}>
        <DialogContent className="max-h-[92svh] max-w-[calc(100%-1rem)] overflow-y-auto p-0 sm:max-w-xl" showCloseButton>
          <DialogTitle className="sr-only">Anfragedetails</DialogTitle>
          <DialogDescription className="sr-only">Details und Aktionen für die ausgewählte Anfrage.</DialogDescription>
          {selectedLead && (
            <LeadDetail
              lead={selectedLead}
              folders={folders}
              busy={mutationBusy}
              compact
              onReply={() => openReply(selectedLead)}
              onMove={(folder) => void moveLead(selectedLead, folder)}
              onDelete={() => setDeleteLeadTarget(selectedLead)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(folderDialog)} onOpenChange={(open) => !open && setFolderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderDialog?.mode === "create" ? "Ordner erstellen" : "Ordner umbenennen"}</DialogTitle>
            <DialogDescription>
              {folderDialog?.mode === "create"
                ? "Fügen Sie eine eigene Stufe zu Ihrem Lead-Prozess hinzu."
                : "Der neue Name wird sofort für alle Anfragen übernommen."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void saveFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(null)}>Abbrechen</Button>
            <Button onClick={() => void saveFolder()} disabled={!folderName.trim() || mutationBusy}>
              {mutationBusy && <LoaderCircle className="animate-spin" />}
              {folderDialog?.mode === "create" ? "Erstellen" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReplyDialog
        open={replyOpen}
        lead={selectedLead}
        subject={replySubject}
        body={replyBody}
        aiDrafting={aiDrafting}
        busy={mutationBusy}
        onOpenChange={setReplyOpen}
        onSubjectChange={setReplySubject}
        onBodyChange={setReplyBody}
        onGenerate={generateDraft}
        onSave={() => void saveReply()}
      />

      <AlertDialog open={Boolean(deleteLeadTarget)} onOpenChange={(open) => !open && setDeleteLeadTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anfrage endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Anfrage von {deleteLeadTarget?.name} wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deleteLead()} disabled={mutationBusy}>
              {mutationBusy && <LoaderCircle className="animate-spin" />} Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteFolderTarget)} onOpenChange={(open) => !open && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ordner löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Anfragen aus «{deleteFolderTarget?.name}» werden zurück in die Inbox verschoben. Der Ordner selbst wird gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deleteFolder()} disabled={mutationBusy}>
              {mutationBusy && <LoaderCircle className="animate-spin" />} Ordner löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <BrandMark />
        <span>Arbeitsbereich wird vorbereitet …</span>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) setError("E-Mail oder Passwort ist ungültig.");
  }

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
      <section className="hidden border-r border-border bg-sidebar p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <BrandMark />
          SynaptoCore
        </div>
        <div className="max-w-sm">
          <p className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-balance">
            Jede Anfrage verdient einen klaren nächsten Schritt.
          </p>
          <p className="mt-5 max-w-[42ch] text-sm leading-6 text-muted-foreground">
            Der interne Arbeitsbereich für Triage, Kontext und Follow-up — ruhig genug für Fokus, schnell genug für den Alltag.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Lead Operations · Zürich</p>
      </section>

      <section className="grid place-items-center px-5 py-10 sm:px-10">
        <form className="w-full max-w-sm" onSubmit={signIn}>
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-sm font-semibold">SynaptoCore</span>
          </div>
          <div className="mb-7">
            <div className="mb-5 flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
              <LockKeyhole className="size-4 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em]">Interner Bereich</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Melden Sie sich mit Ihrem freigeschalteten Supabase-Konto an.
            </p>
          </div>
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              {loading ? "Anmeldung läuft …" : "Anmelden"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

function AccessDenied({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-lg border border-border bg-muted">
          <LockKeyhole className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.025em]">Kein Admin-Zugriff</h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-sm leading-6 text-muted-foreground">
          {email ?? "Dieses Konto"} ist angemeldet, aber nicht für den internen Arbeitsbereich freigeschaltet.
        </p>
        <Button variant="outline" className="mt-6" onClick={onSignOut}>
          <LogOut /> Mit anderem Konto anmelden
        </Button>
      </div>
    </main>
  );
}

function StageRail({
  folders,
  leads,
  activeFolderId,
  userEmail,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onSignOut,
}: {
  folders: Folder[];
  leads: Lead[];
  activeFolderId: string;
  userEmail?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onExport: () => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="hidden min-h-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <BrandMark />
        <div>
          <p className="text-sm font-semibold leading-none">SynaptoCore</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Lead Operations</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="Lead-Stufen">
        <div className="mb-3 flex items-center justify-between px-2">
          <p className="text-xs font-medium text-muted-foreground">Arbeitsfluss</p>
          <Button variant="ghost" size="icon-sm" onClick={onCreate} aria-label="Ordner erstellen">
            <Plus />
          </Button>
        </div>
        <div className="stage-rail relative space-y-1">
          {folders.map((folder) => {
            const Icon = stageIcons[folder.id] ?? Circle;
            const count = leads.filter((lead) => lead.folder_id === folder.id).length;
            const active = folder.id === activeFolderId;
            return (
              <div key={folder.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => onSelect(folder.id)}
                  className={cn(
                    "flex h-10 min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <span className={cn("relative z-10 grid size-6 place-items-center rounded-md bg-sidebar", active && "text-sidebar-primary")}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="truncate">{folder.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{count}</span>
                </button>
                {!folder.locked && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="absolute right-8 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        />
                      }
                    >
                      <MoreHorizontal />
                      <span className="sr-only">Ordneraktionen</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onRename(folder)}>
                        <Pencil /> Umbenennen
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(folder)}>
                        <Trash2 /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{userEmail}</span>
              <span className="block text-[11px] text-muted-foreground">Administrator</span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={onExport}>
              <Download /> Daten exportieren
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOut /> Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
      <span className="size-2 rounded-[2px] bg-current" />
    </span>
  );
}

function LeadRow({ lead, selected, onSelect }: { lead: Lead; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative block w-full px-4 py-4 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
        selected ? "bg-accent" : "hover:bg-muted/45",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 flex size-2 shrink-0">
          {lead.unread && <span className="size-2 rounded-full bg-primary" aria-label="Ungelesen" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn("truncate text-sm", lead.unread ? "font-semibold text-foreground" : "font-medium")}>
              {lead.name}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{relativeTime(lead.created_at)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.company || "Keine Firma"}</p>
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
            {lead.message || "Keine Nachricht hinterlassen."}
          </p>
          <Badge variant="outline" className={cn("mt-3 font-normal", packageTone(lead.selected_package))}>
            {packageShort(lead.selected_package)}
          </Badge>
        </div>
      </div>
    </button>
  );
}

function LeadDetail({
  lead,
  folders,
  busy,
  compact = false,
  onReply,
  onMove,
  onDelete,
}: {
  lead: Lead;
  folders: Folder[];
  busy: boolean;
  compact?: boolean;
  onReply: () => void;
  onMove: (folder: Folder) => void;
  onDelete: () => void;
}) {
  return (
    <article className={cn("mx-auto w-full max-w-3xl px-6 py-7 sm:px-8 sm:py-9", compact && "px-5 pt-12")}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("font-normal", packageTone(lead.selected_package))}>
              {packageShort(lead.selected_package)}
            </Badge>
            {lead.replied_at && (
              <Badge variant="secondary">
                <Check /> Beantwortet
              </Badge>
            )}
          </div>
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-balance">{lead.name}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{lead.company || "Keine Firma angegeben"}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={onReply}>
            <Reply /> Antworten
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
              <Ellipsis />
              <span className="sr-only">Weitere Aktionen</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Verschieben nach</DropdownMenuLabel>
              {folders
                .filter((folder) => folder.id !== lead.folder_id)
                .map((folder) => (
                  <DropdownMenuItem key={folder.id} onClick={() => onMove(folder)} disabled={busy}>
                    <FolderInput /> {folder.name}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 /> Anfrage löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator className="my-7" />

      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <ContactItem icon={Mail} label="E-Mail">
          <a href={`mailto:${lead.email}`} className="break-all text-sm text-foreground hover:text-primary hover:underline">
            {lead.email}
          </a>
        </ContactItem>
        <ContactItem icon={Phone} label="Telefon">
          {lead.phone ? (
            <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="text-sm text-foreground hover:text-primary hover:underline">
              {lead.phone}
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">Nicht angegeben</span>
          )}
        </ContactItem>
        <ContactItem icon={Building2} label="Unternehmen">
          <span className="text-sm">{lead.company || "Nicht angegeben"}</span>
        </ContactItem>
        <ContactItem icon={Clock3} label="Eingegangen">
          <span className="text-sm">
            {new Date(lead.created_at).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        </ContactItem>
      </dl>

      <Separator className="my-7" />

      <section>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <MessageSquareText className="size-4 text-muted-foreground" />
          Nachricht
        </div>
        <p className={cn("max-w-[70ch] whitespace-pre-wrap text-sm leading-7", !lead.message && "text-muted-foreground italic")}>
          {lead.message || "Keine Nachricht hinterlassen."}
        </p>
      </section>
    </article>
  );
}

function ContactItem({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2">
      <span className="mt-0.5 grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1">{children}</dd>
      </div>
    </div>
  );
}

function ReplyDialog({
  open,
  lead,
  subject,
  body,
  aiDrafting,
  busy,
  onOpenChange,
  onSubjectChange,
  onBodyChange,
  onGenerate,
  onSave,
}: {
  open: boolean;
  lead: Lead | null;
  subject: string;
  body: string;
  aiDrafting: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
}) {
  const mailto = lead
    ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Antwort vorbereiten</DialogTitle>
          <DialogDescription>
            An {lead?.name} · {lead?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="reply-subject">Betreff</Label>
            <Input id="reply-subject" value={subject} onChange={(event) => onSubjectChange(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="reply-body">Nachricht</Label>
              <Button variant="ghost" size="sm" onClick={onGenerate} disabled={aiDrafting}>
                {aiDrafting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {aiDrafting ? "Entwurf wird erstellt …" : "Entwurf erstellen"}
              </Button>
            </div>
            <Textarea
              id="reply-body"
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              placeholder="Antwort verfassen oder einen Entwurf erstellen …"
              className="min-h-64 resize-y leading-6"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" render={<a href={mailto} target="_blank" rel="noreferrer" />}>
            <Mail /> Im E-Mail-Programm öffnen
          </Button>
          <Button onClick={onSave} disabled={!body.trim() || busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
            Als beantwortet markieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyLeadList({ searchTerm, folderName }: { searchTerm: string; folderName?: string }) {
  return (
    <div className="grid min-h-full place-items-center px-6 py-16 text-center">
      <div className="max-w-xs">
        <span className="mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-border bg-muted">
          {searchTerm ? <Search className="size-4 text-muted-foreground" /> : <Inbox className="size-4 text-muted-foreground" />}
        </span>
        <h2 className="text-sm font-medium">{searchTerm ? "Keine Treffer" : `${folderName ?? "Dieser Ordner"} ist leer`}</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {searchTerm
            ? "Passen Sie den Suchbegriff an oder wechseln Sie die Stufe."
            : "Neue oder hierher verschobene Anfragen erscheinen automatisch an dieser Stelle."}
        </p>
      </div>
    </div>
  );
}

function NoSelection() {
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

function LeadListSkeleton() {
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
