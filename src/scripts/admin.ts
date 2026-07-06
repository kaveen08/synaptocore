import type { Database } from "../lib/database.types";
import { getSupabase } from "../lib/supabase";

type Folder = Database["public"]["Tables"]["folders"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];

const supabase = (() => {
  try {
    return getSupabase();
  } catch (error) {
    console.error(error);
    return null;
  }
})();

const authOverlay = document.querySelector<HTMLElement>("#auth-overlay")!;
const authForm = document.querySelector<HTMLFormElement>("#auth-form")!;
const authEmail = document.querySelector<HTMLInputElement>("#auth-user")!;
const authPassword = document.querySelector<HTMLInputElement>("#auth-pass")!;
const authError = document.querySelector<HTMLElement>("#auth-error")!;
const authCard = document.querySelector<HTMLElement>(".auth-card")!;
const folderList = document.querySelector<HTMLElement>("#folder-list")!;
const leadList = document.querySelector<HTMLElement>("#lead-list")!;
const viewTitle = document.querySelector<HTMLElement>("#view-title")!;
const viewCount = document.querySelector<HTMLElement>("#view-count")!;
const search = document.querySelector<HTMLInputElement>("#search")!;
const toastElement = document.querySelector<HTMLElement>("#toast")!;
const replyOverlay = document.querySelector<HTMLElement>("#reply-overlay")!;
const replyTo = document.querySelector<HTMLElement>("#reply-to")!;
const replyContext = document.querySelector<HTMLElement>("#reply-context")!;
const replySubject = document.querySelector<HTMLInputElement>("#reply-subject")!;
const replyBody = document.querySelector<HTMLTextAreaElement>("#reply-body")!;
const aiButton = document.querySelector<HTMLButtonElement>("#btn-ai")!;
const sendButton = document.querySelector<HTMLButtonElement>("#btn-send")!;
const mailtoButton = document.querySelector<HTMLAnchorElement>("#btn-mailto")!;

const state: {
  activeFolder: string;
  folders: Folder[];
  leads: Lead[];
} = {
  activeFolder: "inbox",
  folders: [],
  leads: [],
};

let replyLeadId: string | null = null;
let toastTimer: number | undefined;
let aiTimer: number | undefined;

function lock(): void {
  document.body.classList.add("locked");
  authOverlay.classList.add("open");
  authPassword.value = "";
  window.setTimeout(() => authEmail.focus(), 100);
}

function unlock(): void {
  document.body.classList.remove("locked");
  authOverlay.classList.remove("open");
}

function showAuthError(message: string): void {
  authError.textContent = message;
  authError.hidden = false;
  authPassword.value = "";
  authCard.classList.remove("shake");
  void authCard.offsetWidth;
  authCard.classList.add("shake");
}

function toast(message: string): void {
  toastElement.textContent = message;
  toastElement.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastElement.classList.remove("show"), 2800);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFolder(id: string): Folder | undefined {
  return state.folders.find((folder) => folder.id === id);
}

function getLead(id: string | null): Lead | undefined {
  return state.leads.find((lead) => lead.id === id);
}

function packageClass(selectedPackage: string): string {
  if (selectedPackage.includes("Pilot")) return "pkg-pilot";
  if (selectedPackage.includes("Core")) return "pkg-core";
  if (selectedPackage.includes("Managed")) return "pkg-managed";
  return "";
}

function packageShort(selectedPackage: string): string {
  if (selectedPackage.includes("Pilot")) return "Pilot";
  if (selectedPackage.includes("Core")) return "Core Solution";
  if (selectedPackage.includes("Managed")) return "Managed Service";
  return selectedPackage || "—";
}

function timeAgo(timestamp: string): string {
  const difference = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return new Date(timestamp).toLocaleDateString("de-CH");
}

async function loadData(): Promise<"ok" | "denied" | "error"> {
  if (!supabase) return "error";

  const [foldersResult, leadsResult] = await Promise.all([
    supabase.from("folders").select("*").order("sort_order"),
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
  ]);

  const error = foldersResult.error ?? leadsResult.error;
  if (error) {
    console.error("Supabase-Daten konnten nicht geladen werden:", error);
    toast("Daten konnten nicht geladen werden.");
    return "error";
  }

  if (!foldersResult.data?.length) {
    return "denied";
  }

  state.folders = foldersResult.data ?? [];
  state.leads = leadsResult.data ?? [];
  if (!getFolder(state.activeFolder)) state.activeFolder = state.folders[0]?.id ?? "inbox";
  render();
  return "ok";
}

function render(): void {
  renderFolders();
  renderLeads();
}

function renderFolders(): void {
  folderList.innerHTML = "";
  state.folders.forEach((folder) => {
    const count = state.leads.filter((lead) => lead.folder_id === folder.id).length;
    const button = document.createElement("button");
    button.className = `folder${folder.id === state.activeFolder ? " active" : ""}`;
    button.innerHTML =
      `<span class="f-name">${escapeHtml(folder.name)}</span>` +
      (folder.locked
        ? ""
        : `<span class="f-tools">
            <button class="f-tool" data-rename="${escapeHtml(folder.id)}" title="Umbenennen">✎</button>
            <button class="f-tool danger" data-delete-folder="${escapeHtml(folder.id)}" title="Ordner löschen">🗑</button>
          </span>`) +
      `<span class="f-count">${count}</span>`;

    button.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const renameId = target.dataset.rename;
      const deleteId = target.dataset.deleteFolder;
      if (renameId) {
        void renameFolder(renameId);
        return;
      }
      if (deleteId) {
        void deleteFolder(deleteId);
        return;
      }
      state.activeFolder = folder.id;
      render();
    });
    folderList.appendChild(button);
  });
}

function renderLeads(): void {
  const folder = getFolder(state.activeFolder);
  if (!folder) {
    viewTitle.textContent = "Inbox";
    viewCount.textContent = "0";
    leadList.innerHTML = '<div class="empty-state">Keine Ordner verfügbar.</div>';
    return;
  }

  const query = search.value.trim().toLowerCase();
  const leads = state.leads.filter((lead) => {
    if (lead.folder_id !== folder.id) return false;
    if (!query) return true;
    return [
      lead.name,
      lead.company,
      lead.email,
      lead.phone,
      lead.message,
      lead.selected_package,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  viewTitle.textContent = folder.name;
  viewCount.textContent = String(leads.length);
  leadList.innerHTML = "";

  if (!leads.length) {
    leadList.innerHTML = `<div class="empty-state"><div class="big">📭</div>${
      query ? `Keine Treffer für «${escapeHtml(query)}».` : "Keine Anfragen in diesem Ordner."
    }</div>`;
    return;
  }

  leads.forEach((lead) => {
    const card = document.createElement("article");
    card.className = `lead-card${lead.unread ? " unread" : ""}`;
    const moveTargets = state.folders.filter((candidate) => candidate.id !== lead.folder_id);

    card.innerHTML = `
      <div class="lead-top">
        <span class="lead-name">${escapeHtml(lead.name)}</span>
        <span class="lead-company">· ${escapeHtml(lead.company || "—")}</span>
        ${lead.unread ? '<span class="badge new">Neu</span>' : ""}
        ${lead.replied_at ? '<span class="badge replied">Beantwortet</span>' : ""}
        <span class="lead-time">${timeAgo(lead.created_at)}</span>
      </div>
      <div class="lead-meta">
        <a class="chip" href="mailto:${escapeHtml(lead.email)}">✉ ${escapeHtml(lead.email)}</a>
        <a class="chip" href="tel:${escapeHtml(lead.phone.replace(/\s/g, ""))}">☎ ${escapeHtml(lead.phone)}</a>
        <span class="chip ${packageClass(lead.selected_package)}">${escapeHtml(packageShort(lead.selected_package))}</span>
      </div>
      <p class="lead-msg${lead.message ? "" : " empty"}">${
        lead.message ? escapeHtml(lead.message) : "Keine Nachricht hinterlassen."
      }</p>
      <div class="lead-actions">
        <button class="btn-act reply" data-reply>Antworten</button>
        <div class="move-wrap">
          <button class="btn-act" data-move-toggle>Verschieben ▾</button>
          <div class="move-menu">
            ${moveTargets
              .map(
                (target) =>
                  `<button data-move-to="${escapeHtml(target.id)}">→ ${escapeHtml(target.name)}</button>`,
              )
              .join("")}
          </div>
        </div>
        <button class="btn-act danger" data-delete>Löschen</button>
      </div>`;

    card.addEventListener("click", () => {
      if (lead.unread) void updateLead(lead.id, { unread: false }, false);
    });
    card.querySelector<HTMLElement>("[data-reply]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openReply(lead.id);
    });
    card.querySelector<HTMLElement>("[data-move-toggle]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = card.querySelector<HTMLElement>(".move-menu");
      const wasOpen = menu?.classList.contains("open");
      closeAllMenus();
      if (!wasOpen) menu?.classList.add("open");
    });
    card.querySelectorAll<HTMLElement>("[data-move-to]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        void moveLead(lead.id, button.dataset.moveTo ?? "");
      });
    });
    card.querySelector<HTMLElement>("[data-delete]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      void deleteLead(lead.id);
    });
    leadList.appendChild(card);
  });
}

function closeAllMenus(): void {
  document.querySelectorAll(".move-menu.open").forEach((menu) => menu.classList.remove("open"));
}

async function updateLead(
  id: string,
  values: Database["public"]["Tables"]["leads"]["Update"],
  notify = true,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("leads").update(values).eq("id", id);
  if (error) {
    console.error(error);
    if (notify) toast("Änderung konnte nicht gespeichert werden.");
    return false;
  }
  await loadData();
  return true;
}

async function moveLead(leadId: string, folderId: string): Promise<void> {
  const folder = getFolder(folderId);
  if (!folder) return;
  if (await updateLead(leadId, { folder_id: folderId }, false)) {
    toast(`Anfrage nach «${folder.name}» verschoben.`);
  }
}

async function deleteLead(leadId: string): Promise<void> {
  const lead = getLead(leadId);
  if (!supabase || !lead || !confirm(`Anfrage von «${lead.name}» endgültig löschen?`)) return;
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) {
    console.error(error);
    toast("Anfrage konnte nicht gelöscht werden.");
    return;
  }
  await loadData();
  toast("Anfrage gelöscht.");
}

async function createFolder(): Promise<void> {
  if (!supabase) return;
  const name = prompt("Name des neuen Ordners:")?.trim();
  if (!name) return;
  if (state.folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) {
    toast("Ein Ordner mit diesem Namen existiert bereits.");
    return;
  }
  const sortOrder = Math.max(0, ...state.folders.map((folder) => folder.sort_order)) + 10;
  const { error } = await supabase.from("folders").insert({
    id: crypto.randomUUID(),
    name,
    sort_order: sortOrder,
    locked: false,
  });
  if (error) {
    console.error(error);
    toast("Ordner konnte nicht erstellt werden.");
    return;
  }
  await loadData();
  toast(`Ordner «${name}» erstellt.`);
}

async function renameFolder(folderId: string): Promise<void> {
  const folder = getFolder(folderId);
  if (!supabase || !folder || folder.locked) return;
  const name = prompt(`Neuer Name für «${folder.name}»:`, folder.name)?.trim();
  if (!name) return;
  const { error } = await supabase.from("folders").update({ name }).eq("id", folderId);
  if (error) {
    console.error(error);
    toast("Ordner konnte nicht umbenannt werden.");
    return;
  }
  await loadData();
  toast("Ordner umbenannt.");
}

async function deleteFolder(folderId: string): Promise<void> {
  const folder = getFolder(folderId);
  if (!supabase || !folder || folder.locked) return;
  const count = state.leads.filter((lead) => lead.folder_id === folderId).length;
  if (
    !confirm(
      `Ordner «${folder.name}» löschen?${count ? `\n\n${count} Anfrage(n) werden zurück in die Inbox verschoben.` : ""}`,
    )
  ) {
    return;
  }

  if (count) {
    const moveResult = await supabase.from("leads").update({ folder_id: "inbox" }).eq("folder_id", folderId);
    if (moveResult.error) {
      console.error(moveResult.error);
      toast("Anfragen konnten nicht verschoben werden.");
      return;
    }
  }
  const { error } = await supabase.from("folders").delete().eq("id", folderId);
  if (error) {
    console.error(error);
    toast("Ordner konnte nicht gelöscht werden.");
    return;
  }
  state.activeFolder = "inbox";
  await loadData();
  toast("Ordner gelöscht.");
}

function openReply(leadId: string): void {
  const lead = getLead(leadId);
  if (!lead) return;
  replyLeadId = leadId;
  replyTo.textContent = `${lead.name} <${lead.email}>`;
  replyContext.innerHTML =
    `<b>${escapeHtml(packageShort(lead.selected_package))}</b> · ${escapeHtml(lead.company || "—")}\n` +
    escapeHtml(lead.message || "(keine Nachricht)");
  replySubject.value = `Re: Ihre Anfrage bei SynaptoCore — ${packageShort(lead.selected_package)}`;
  replyBody.value = "";
  updateMailtoLink();
  replyOverlay.classList.add("open");
  if (lead.unread) void updateLead(lead.id, { unread: false }, false);
  window.setTimeout(() => replyBody.focus(), 100);
}

function closeReply(): void {
  window.clearInterval(aiTimer);
  aiButton.disabled = false;
  aiButton.textContent = "✨ AI Assist";
  replyOverlay.classList.remove("open");
  replyLeadId = null;
}

function updateMailtoLink(): void {
  const lead = getLead(replyLeadId);
  if (!lead) return;
  mailtoButton.href =
    `mailto:${encodeURIComponent(lead.email)}` +
    `?subject=${encodeURIComponent(replySubject.value)}` +
    `&body=${encodeURIComponent(replyBody.value)}`;
}

function buildAiDraft(lead: Lead): string {
  const packageName = packageShort(lead.selected_package);
  const quote = lead.message
    ? `Sie schreiben: «${lead.message.length > 110 ? `${lead.message.slice(0, 110)}…` : lead.message}»\n\n`
    : "";
  let core = `vielen Dank für Ihre Anfrage.\n\n${quote}Gerne melden wir uns mit einer konkreten Einschätzung. Wann erreichen wir Sie am besten für ein kurzes Erstgespräch?`;

  if (packageName === "Pilot") {
    core = `gerne bestätigen wir Ihnen den Erhalt Ihrer Anfrage für den kostenlosen Pilot.\n\n${quote}In einem kurzen Erstgespräch identifizieren wir den Kern-Prozess, der aktuell am meisten Zeit kostet. Diesen automatisieren wir und Sie testen das Resultat 7 Tage unverbindlich. Welche Zeitfenster passen Ihnen?`;
  } else if (packageName === "Core Solution") {
    core = `vielen Dank für Ihr Interesse an unserer Core Solution.\n\n${quote}Gerne zeigen wir Ihnen anhand Ihres konkreten Falls, wie wir Ihre bestehenden Tools über sichere KI-Pipelines verbinden. Wann passt Ihnen ein kurzes Gespräch?`;
  } else if (packageName === "Managed Service") {
    core = `vielen Dank für Ihre Anfrage zum Managed Service.\n\n${quote}Gerne besprechen wir Ihre bestehende Umgebung und den laufenden Betreuungsbedarf in einem kurzen Call. Wann erreichen wir Sie am besten?`;
  }

  return `Guten Tag ${lead.name}\n\nVielen Dank für Ihre Nachricht — ${core}\n\nFreundliche Grüsse\nSynaptoCore · Zürich\nsynaptocore@gmail.com · +41 78 809 00 94`;
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.hidden = true;
  if (!supabase) {
    showAuthError("Supabase ist noch nicht konfiguriert. Bitte die .env-Werte ergänzen.");
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });
  if (error) showAuthError("E-Mail oder Passwort ist ungültig.");
});

replySubject.addEventListener("input", updateMailtoLink);
replyBody.addEventListener("input", updateMailtoLink);
document.addEventListener("click", closeAllMenus);
search.addEventListener("input", renderLeads);
document.querySelector("#btn-add-folder")?.addEventListener("click", () => void createFolder());
document.querySelector("#reply-close")?.addEventListener("click", closeReply);
replyOverlay.addEventListener("click", (event) => {
  if (event.target === replyOverlay) closeReply();
});

aiButton.addEventListener("click", () => {
  const lead = getLead(replyLeadId);
  if (!lead) return;
  aiButton.disabled = true;
  aiButton.textContent = "✨ AI Assist denkt …";
  replyBody.value = "";
  const draft = buildAiDraft(lead);
  let position = 0;
  window.clearInterval(aiTimer);
  aiTimer = window.setInterval(() => {
    position = Math.min(position + 4, draft.length);
    replyBody.value = draft.slice(0, position);
    replyBody.scrollTop = replyBody.scrollHeight;
    if (position >= draft.length) {
      window.clearInterval(aiTimer);
      aiButton.disabled = false;
      aiButton.textContent = "✨ AI Assist";
      updateMailtoLink();
    }
  }, 12);
});

sendButton.addEventListener("click", async () => {
  const lead = getLead(replyLeadId);
  if (!lead || !replyBody.value.trim()) {
    toast("Bitte zuerst eine Antwort verfassen.");
    return;
  }
  const values: Database["public"]["Tables"]["leads"]["Update"] = {
    replied_at: new Date().toISOString(),
    unread: false,
  };
  if (lead.folder_id === "inbox") values.folder_id = "progress";
  if (await updateLead(lead.id, values, false)) {
    closeReply();
    toast(`Antwort an ${lead.name} gespeichert.`);
  }
});

document.querySelector("#btn-export")?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `synaptocore-leads-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  toast("Export erstellt.");
});

document.querySelector("#btn-logout")?.addEventListener("click", async () => {
  await supabase?.auth.signOut();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && replyOverlay.classList.contains("open")) closeReply();
});

async function start(): Promise<void> {
  if (!supabase) {
    lock();
    showAuthError("Supabase ist noch nicht konfiguriert. Bitte die .env-Werte ergänzen.");
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await handleAuthenticatedSession();
  } else {
    lock();
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      window.setTimeout(() => void handleAuthenticatedSession(), 0);
    } else if (event === "SIGNED_OUT") {
      state.folders = [];
      state.leads = [];
      render();
      lock();
    }
  });
}

async function handleAuthenticatedSession(): Promise<void> {
  if (!supabase) return;
  unlock();
  const result = await loadData();
  if (result === "denied") {
    await supabase.auth.signOut();
    showAuthError("Dieses Benutzerkonto hat keinen Admin-Zugriff.");
  }
}

void start();
