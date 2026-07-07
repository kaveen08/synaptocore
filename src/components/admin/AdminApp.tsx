import { useRef, useState } from "react";
import { Toaster } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { AccessDenied } from "./auth/AccessDenied";
import { LoadingScreen } from "./auth/LoadingScreen";
import { LoginScreen } from "./auth/LoginScreen";
import { DashboardView } from "./dashboard/DashboardView";
import { DeleteFolderDialog, DeleteLeadDialog } from "./dialogs/ConfirmDialogs";
import { FolderDialog, type FolderDialogState } from "./dialogs/FolderDialog";
import { ReplyDialog } from "./dialogs/ReplyDialog";
import { useAdminData } from "./hooks/useAdminData";
import { useHashView } from "./hooks/useHashView";
import { Sidebar } from "./layout/Sidebar";
import { Topbar } from "./layout/Topbar";
import { LeadsView } from "./leads/LeadsView";
import { LeadDetail } from "./leads/LeadDetail";
import { buildDraft } from "./lib/draft";
import { packageShort } from "./lib/format";
import type { Folder, Lead, LeadUpdate } from "./lib/types";

export default function AdminApp() {
  const data = useAdminData();
  const [view, setView] = useHashView();

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [mobileLeadOpen, setMobileLeadOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null);
  const [folderName, setFolderName] = useState("");
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<Lead | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);

  const activeFolder =
    view.name === "leads"
      ? data.folders.find((folder) => folder.id === view.folderId) ?? data.folders[0]
      : undefined;
  const selectedLead = data.leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const unreadCount = data.leads.filter((lead) => lead.unread).length;
  const openCount = data.leads.filter((lead) => lead.folder_id !== "closed").length;
  const modalOpen =
    mobileLeadOpen || replyOpen || Boolean(folderDialog) || Boolean(deleteLeadTarget) || Boolean(deleteFolderTarget);

  function handleOpenLead(lead: Lead, mobile = false) {
    setSelectedLeadId(lead.id);
    if (mobile) setMobileLeadOpen(true);
    void data.markRead(lead);
  }

  function handleOpenLeadFromDashboard(lead: Lead) {
    setView({ name: "leads", folderId: lead.folder_id });
    handleOpenLead(lead, window.innerWidth < 1024);
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    if (value && view.name === "dashboard") {
      setView({ name: "leads", folderId: data.folders[0]?.id ?? "inbox" });
    }
  }

  function openFolderDialog(mode: "create" | "rename", folder?: Folder) {
    setFolderName(folder?.name ?? "");
    setFolderDialog({ mode, folder });
  }

  async function saveFolder() {
    const name = folderName.trim();
    if (!name || !folderDialog) return;
    const ok =
      folderDialog.mode === "create"
        ? await data.createFolder(name)
        : folderDialog.folder
          ? await data.renameFolder(folderDialog.folder, name)
          : false;
    if (ok) setFolderDialog(null);
  }

  async function confirmDeleteFolder() {
    if (!deleteFolderTarget) return;
    const deletedId = deleteFolderTarget.id;
    if (await data.deleteFolder(deleteFolderTarget)) {
      setDeleteFolderTarget(null);
      if (view.name === "leads" && view.folderId === deletedId) {
        setView({ name: "leads", folderId: "inbox" });
      }
    }
  }

  async function confirmDeleteLead() {
    if (!deleteLeadTarget) return;
    if (await data.deleteLead(deleteLeadTarget)) {
      setDeleteLeadTarget(null);
      setMobileLeadOpen(false);
    }
  }

  async function handleMove(lead: Lead, folder: Folder) {
    if (await data.moveLead(lead, folder)) {
      setMobileLeadOpen(false);
    }
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
    if (await data.updateLead(selectedLead.id, values, "Antwort als erledigt markiert.")) {
      setReplyOpen(false);
      setMobileLeadOpen(false);
    }
  }

  if (data.authState === "loading") return <LoadingScreen />;
  if (data.authState === "signed-out") return <LoginScreen />;
  if (data.authState === "denied") {
    return <AccessDenied email={data.session?.user.email} onSignOut={data.signOut} />;
  }

  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      <Toaster theme="light" position="bottom-right" richColors closeButton />
      <div className="grid h-full lg:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar
          folders={data.folders}
          leads={data.leads}
          view={view}
          userEmail={data.session?.user.email}
          onNavigate={setView}
          onCreate={() => openFolderDialog("create")}
          onRename={(folder) => openFolderDialog("rename", folder)}
          onDelete={setDeleteFolderTarget}
          onExport={data.exportData}
          onSignOut={data.signOut}
        />

        <main className="flex min-w-0 flex-col overflow-hidden">
          <Topbar
            title={view.name === "dashboard" ? "Übersicht" : activeFolder?.name ?? "Anfragen"}
            subtitle={`${openCount} offen · ${unreadCount} ungelesen`}
            count={
              view.name === "leads"
                ? data.leads.filter((lead) => lead.folder_id === activeFolder?.id).length
                : undefined
            }
            searchTerm={searchTerm}
            searchRef={searchRef}
            refreshing={data.refreshing}
            userEmail={data.session?.user.email}
            onSearchChange={handleSearchChange}
            onRefresh={() => void data.loadData(true)}
            onExport={data.exportData}
            onCreateFolder={() => openFolderDialog("create")}
            onNavigateDashboard={() => setView({ name: "dashboard" })}
            onSignOut={data.signOut}
          />

          {view.name === "dashboard" ? (
            <DashboardView
              leads={data.leads}
              folders={data.folders}
              mailEvents={data.mailEvents}
              busy={data.mutationBusy}
              onOpenFolder={(folder) => setView({ name: "leads", folderId: folder.id })}
              onOpenLead={handleOpenLeadFromDashboard}
              onRetryMail={(leadId) => void data.retryLeadMail(leadId)}
            />
          ) : (
            <LeadsView
              folders={data.folders}
              leads={data.leads}
              mailEvents={data.mailEvents}
              activeFolder={activeFolder}
              searchTerm={searchTerm}
              selectedLeadId={selectedLeadId}
              dataLoading={data.dataLoading}
              mutationBusy={data.mutationBusy}
              modalOpen={modalOpen}
              onSelectId={setSelectedLeadId}
              onOpenLead={handleOpenLead}
              onNavigateFolder={(folderId) => setView({ name: "leads", folderId })}
              onToggleRead={(lead) => void data.toggleRead(lead)}
              onBulkMarkRead={(ids) => void data.bulkMarkRead(ids)}
              onMove={(lead, folder) => void handleMove(lead, folder)}
              onDelete={setDeleteLeadTarget}
              onReply={openReply}
              onRetryMail={(leadId) => void data.retryLeadMail(leadId)}
              onSearchChange={handleSearchChange}
              onFocusSearch={() => searchRef.current?.focus()}
            />
          )}
        </main>
      </div>

      <Dialog open={mobileLeadOpen} onOpenChange={setMobileLeadOpen}>
        <DialogContent className="max-h-[92svh] max-w-[calc(100%-1rem)] overflow-y-auto p-0 sm:max-w-xl" showCloseButton>
          <DialogTitle className="sr-only">Anfragedetails</DialogTitle>
          <DialogDescription className="sr-only">Details und Aktionen für die ausgewählte Anfrage.</DialogDescription>
          {selectedLead && (
            <LeadDetail
              lead={selectedLead}
              mailEvents={data.mailEvents.filter((event) => event.lead_id === selectedLead.id)}
              folders={data.folders}
              busy={data.mutationBusy}
              compact
              onReply={() => openReply(selectedLead)}
              onRetryMail={() => void data.retryLeadMail(selectedLead.id)}
              onMove={(folder) => void handleMove(selectedLead, folder)}
              onDelete={() => setDeleteLeadTarget(selectedLead)}
            />
          )}
        </DialogContent>
      </Dialog>

      <FolderDialog
        state={folderDialog}
        name={folderName}
        busy={data.mutationBusy}
        onNameChange={setFolderName}
        onClose={() => setFolderDialog(null)}
        onSave={() => void saveFolder()}
      />

      <ReplyDialog
        open={replyOpen}
        lead={selectedLead}
        subject={replySubject}
        body={replyBody}
        aiDrafting={aiDrafting}
        busy={data.mutationBusy}
        onOpenChange={setReplyOpen}
        onSubjectChange={setReplySubject}
        onBodyChange={setReplyBody}
        onGenerate={generateDraft}
        onSave={() => void saveReply()}
      />

      <DeleteLeadDialog
        lead={deleteLeadTarget}
        busy={data.mutationBusy}
        onClose={() => setDeleteLeadTarget(null)}
        onConfirm={() => void confirmDeleteLead()}
      />

      <DeleteFolderDialog
        folder={deleteFolderTarget}
        busy={data.mutationBusy}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={() => void confirmDeleteFolder()}
      />
    </div>
  );
}
