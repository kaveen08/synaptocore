(function () {
  "use strict";

  /* ==========================================================
     SYNAPTOCORE ADMIN — Login-Guard + State Management

     HINWEIS SICHERHEIT: Dies ist ein reiner Frontend-Guard.
     Das Passwort ist als SHA-256-Hash hinterlegt (nicht im
     Klartext lesbar), aber ein Frontend-Login ist grundsätzlich
     kein Ersatz für echte serverseitige Authentifizierung.
     Die Lead-Daten liegen ausschliesslich im localStorage des
     jeweiligen Browsers — im Repository selbst sind keine
     Kundendaten enthalten.

     Externe Schnittstelle für Make.com / Webhooks:

       window.receiveNewLead({
         name:      "Max Muster",            // Pflicht
         firma:     "Muster Bau AG",
         email:     "max@musterbau.ch",      // Pflicht
         telefon:   "+41 79 000 00 00",
         interesse: "1 · Der Pilot (0 CHF)", // Feldnamen identisch
         nachricht: "…",                     //  mit dem Website-Formular
         source:    "website" | "gmail"
       })
     ========================================================== */

  /* ==========================================================
     LOGIN-GUARD
     ========================================================== */
  var AUTH_USER = "admin";
  /* SHA-256-Hash des Admin-Passworts */
  var AUTH_HASH = "9682efb8266cf689d32974d71ca248dd741ebb6d5963d81145dcf15079028100";
  var AUTH_FLAG = "synapto-admin-auth";

  var $authOverlay = document.getElementById("auth-overlay");
  var $authForm    = document.getElementById("auth-form");
  var $authUser    = document.getElementById("auth-user");
  var $authPass    = document.getElementById("auth-pass");
  var $authError   = document.getElementById("auth-error");
  var $authCard    = document.querySelector(".auth-card");

  function sha256hex(str) {
    if (!(window.crypto && crypto.subtle)) {
      return Promise.reject(new Error("WebCrypto nicht verfügbar"));
    }
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
      .then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, "0");
        }).join("");
      });
  }

  function isAuthed() {
    try { return sessionStorage.getItem(AUTH_FLAG) === "1"; }
    catch (e) { return false; }
  }

  function unlock() {
    document.body.classList.remove("locked");
    $authOverlay.classList.remove("open");
  }

  function lock() {
    document.body.classList.add("locked");
    $authOverlay.classList.add("open");
    $authPass.value = "";
    $authError.hidden = true;
    setTimeout(function () { $authUser.focus(); }, 100);
  }

  function authFail(msg) {
    $authError.textContent = msg || "Zugangsdaten ungültig — bitte erneut versuchen.";
    $authError.hidden = false;
    $authPass.value = "";
    $authCard.classList.remove("shake");
    void $authCard.offsetWidth; /* Reflow, damit die Animation neu startet */
    $authCard.classList.add("shake");
  }

  $authForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var u = $authUser.value.trim();
    var p = $authPass.value;

    sha256hex(p).then(function (hash) {
      if (u === AUTH_USER && hash === AUTH_HASH) {
        try { sessionStorage.setItem(AUTH_FLAG, "1"); } catch (err) {}
        unlock();
      } else {
        authFail();
      }
    }).catch(function () {
      authFail("Ihr Browser unterstützt WebCrypto nicht (HTTPS erforderlich).");
    });
  });

  if (isAuthed()) unlock(); else lock();

  /* ==========================================================
     STATE MANAGEMENT
     ========================================================== */
  var STORAGE_KEY = "synaptocore-admin-v1";

  /* ---------- Persistenz ---------- */
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* localStorage nicht verfügbar → nur In-Memory */ }
  }

  function uid() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Ausgangszustand (erster Start): leer, produktiv ---------- */
  function seedState() {
    return {
      activeFolder: "inbox",
      folders: [
        { id: "inbox",    name: "Inbox",       locked: true },
        { id: "progress", name: "In Progress", locked: true },
        { id: "pilot",    name: "Pilot Active", locked: true },
        { id: "closed",   name: "Closed",      locked: true }
      ],
      leads: []
    };
  }

  var state = loadState() || seedState();

  /* Einmalige Bereinigung: Demo- und Test-Leads aus früheren Versionen
     werden automatisch entfernt (kommerzieller Betrieb = nur echte Daten). */
  var DEMO_EMAILS = [
    "s.keller@keller-immo.ch", "info@zgraggen-elektro.ch", "m.bianchi@bianchibau.ch",
    "p.huerlimann@ht-treuhand.ch", "info@ferrari-garten.ch", "n.roth@rothpartner.ch",
    "test@test.ch"
  ];
  state.leads = state.leads.filter(function (l) {
    return l.source !== "demo" &&
           DEMO_EMAILS.indexOf(String(l.email || "").toLowerCase()) === -1;
  });

  saveState();

  /* ---------- DOM-Referenzen ---------- */
  var $folderList = document.getElementById("folder-list");
  var $leadList   = document.getElementById("lead-list");
  var $viewTitle  = document.getElementById("view-title");
  var $viewCount  = document.getElementById("view-count");
  var $search     = document.getElementById("search");
  var $toast      = document.getElementById("toast");

  var $overlay    = document.getElementById("reply-overlay");
  var $replyTo    = document.getElementById("reply-to");
  var $replyCtx   = document.getElementById("reply-context");
  var $replySubj  = document.getElementById("reply-subject");
  var $replyBody  = document.getElementById("reply-body");
  var $btnAi      = document.getElementById("btn-ai");
  var $btnSend    = document.getElementById("btn-send");
  var $btnMailto  = document.getElementById("btn-mailto");

  var replyLeadId = null;
  var toastTimer  = null;
  var aiTimer     = null;

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getFolder(id) {
    for (var i = 0; i < state.folders.length; i++)
      if (state.folders[i].id === id) return state.folders[i];
    return null;
  }

  function getLead(id) {
    for (var i = 0; i < state.leads.length; i++)
      if (state.leads[i].id === id) return state.leads[i];
    return null;
  }

  function pkgClass(interesse) {
    var s = String(interesse || "");
    if (s.indexOf("Pilot") !== -1)   return "pkg-pilot";
    if (s.indexOf("Core") !== -1)    return "pkg-core";
    if (s.indexOf("Managed") !== -1) return "pkg-managed";
    return "";
  }

  function pkgShort(interesse) {
    var s = String(interesse || "");
    if (s.indexOf("Pilot") !== -1)   return "Pilot";
    if (s.indexOf("Core") !== -1)    return "Core Solution";
    if (s.indexOf("Managed") !== -1) return "Managed Service";
    return s || "—";
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var min  = Math.floor(diff / 60000);
    if (min < 1)   return "gerade eben";
    if (min < 60)  return "vor " + min + " Min.";
    var h = Math.floor(min / 60);
    if (h < 24)    return "vor " + h + " Std.";
    var d = Math.floor(h / 24);
    if (d < 7)     return "vor " + d + (d === 1 ? " Tag" : " Tagen");
    return new Date(ts).toLocaleDateString("de-CH");
  }

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.classList.remove("show"); }, 2600);
  }

  /* ==========================================================
     RENDERING
     ========================================================== */
  function render() {
    renderFolders();
    renderLeads();
    saveState();
  }

  function renderFolders() {
    $folderList.innerHTML = "";
    state.folders.forEach(function (f) {
      var count = state.leads.filter(function (l) { return l.folderId === f.id; }).length;

      var btn = document.createElement("button");
      btn.className = "folder" + (f.id === state.activeFolder ? " active" : "");
      btn.innerHTML =
        '<span class="f-name">' + escapeHtml(f.name) + "</span>" +
        (f.locked ? "" :
          '<span class="f-tools">' +
            '<button class="f-tool" data-rename="' + f.id + '" title="Umbenennen">✎</button>' +
            '<button class="f-tool danger" data-delete-folder="' + f.id + '" title="Ordner löschen">🗑</button>' +
          "</span>") +
        '<span class="f-count">' + count + "</span>";

      btn.addEventListener("click", function (e) {
        var t = e.target;
        if (t.hasAttribute("data-rename"))        { renameFolder(t.getAttribute("data-rename")); return; }
        if (t.hasAttribute("data-delete-folder")) { deleteFolder(t.getAttribute("data-delete-folder")); return; }
        state.activeFolder = f.id;
        render();
      });

      $folderList.appendChild(btn);
    });
  }

  function renderLeads() {
    var folder = getFolder(state.activeFolder) || state.folders[0];
    state.activeFolder = folder.id;

    var q = $search.value.trim().toLowerCase();
    var leads = state.leads
      .filter(function (l) { return l.folderId === folder.id; })
      .filter(function (l) {
        if (!q) return true;
        return [l.name, l.firma, l.email, l.telefon, l.nachricht, l.interesse]
          .join(" ").toLowerCase().indexOf(q) !== -1;
      })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });

    $viewTitle.textContent = folder.name;
    $viewCount.textContent = leads.length;
    $leadList.innerHTML = "";

    if (!leads.length) {
      $leadList.innerHTML =
        '<div class="empty-state"><div class="big">📭</div>' +
        (q ? "Keine Treffer für «" + escapeHtml(q) + "»." : "Keine Anfragen in diesem Ordner.") +
        "</div>";
      return;
    }

    leads.forEach(function (l) {
      var card = document.createElement("article");
      card.className = "lead-card" + (l.unread ? " unread" : "");

      var moveTargets = state.folders.filter(function (f) { return f.id !== l.folderId; });

      card.innerHTML =
        '<div class="lead-top">' +
          '<span class="lead-name">' + escapeHtml(l.name) + "</span>" +
          '<span class="lead-company">· ' + escapeHtml(l.firma || "—") + "</span>" +
          (l.unread ? '<span class="badge new">Neu</span>' : "") +
          (l.repliedAt ? '<span class="badge replied">Beantwortet</span>' : "") +
          '<span class="lead-time">' + timeAgo(l.createdAt) + "</span>" +
        "</div>" +
        '<div class="lead-meta">' +
          '<a class="chip" href="mailto:' + escapeHtml(l.email) + '">✉ ' + escapeHtml(l.email) + "</a>" +
          (l.telefon ? '<a class="chip" href="tel:' + escapeHtml(String(l.telefon).replace(/\s/g, "")) + '">✆ ' + escapeHtml(l.telefon) + "</a>" : "") +
          '<span class="chip ' + pkgClass(l.interesse) + '">' + escapeHtml(pkgShort(l.interesse)) + "</span>" +
        "</div>" +
        '<p class="lead-msg' + (l.nachricht ? "" : " empty") + '">' +
          (l.nachricht ? escapeHtml(l.nachricht) : "Keine Nachricht hinterlassen.") +
        "</p>" +
        '<div class="lead-actions">' +
          '<button class="btn-act reply" data-reply>Antworten</button>' +
          '<div class="move-wrap">' +
            '<button class="btn-act" data-move-toggle>Verschieben ▾</button>' +
            '<div class="move-menu">' +
              moveTargets.map(function (f) {
                return '<button data-move-to="' + f.id + '">→ ' + escapeHtml(f.name) + "</button>";
              }).join("") +
            "</div>" +
          "</div>" +
          '<button class="btn-act danger" data-delete>Löschen</button>' +
        "</div>";

      /* Karte anklicken = als gelesen markieren */
      card.addEventListener("click", function () {
        if (l.unread) { l.unread = false; render(); }
      });

      card.querySelector("[data-reply]").addEventListener("click", function (e) {
        e.stopPropagation();
        openReply(l.id);
      });

      card.querySelector("[data-move-toggle]").addEventListener("click", function (e) {
        e.stopPropagation();
        var menu = card.querySelector(".move-menu");
        var wasOpen = menu.classList.contains("open");
        closeAllMenus();
        if (!wasOpen) menu.classList.add("open");
      });

      card.querySelectorAll("[data-move-to]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          moveLead(l.id, b.getAttribute("data-move-to"));
        });
      });

      card.querySelector("[data-delete]").addEventListener("click", function (e) {
        e.stopPropagation();
        deleteLead(l.id);
      });

      $leadList.appendChild(card);
    });
  }

  function closeAllMenus() {
    document.querySelectorAll(".move-menu.open").forEach(function (m) {
      m.classList.remove("open");
    });
  }

  document.addEventListener("click", closeAllMenus);

  /* ==========================================================
     LEAD-AKTIONEN
     ========================================================== */
  function moveLead(leadId, folderId) {
    var lead = getLead(leadId);
    var folder = getFolder(folderId);
    if (!lead || !folder) return;
    lead.folderId = folderId;
    render();
    toast("Anfrage nach «" + folder.name + "» verschoben.");
  }

  function deleteLead(leadId) {
    var lead = getLead(leadId);
    if (!lead) return;
    if (!confirm("Anfrage von «" + lead.name + "» endgültig löschen?")) return;
    state.leads = state.leads.filter(function (l) { return l.id !== leadId; });
    render();
    toast("Anfrage gelöscht.");
  }

  /* ==========================================================
     ORDNER-VERWALTUNG
     ========================================================== */
  function createFolder() {
    var name = prompt("Name des neuen Ordners:");
    if (!name) return;
    name = name.trim();
    if (!name) return;
    var exists = state.folders.some(function (f) { return f.name.toLowerCase() === name.toLowerCase(); });
    if (exists) { toast("Ein Ordner mit diesem Namen existiert bereits."); return; }
    state.folders.push({ id: uid(), name: name, locked: false });
    render();
    toast("Ordner «" + name + "» erstellt.");
  }

  function renameFolder(folderId) {
    var f = getFolder(folderId);
    if (!f || f.locked) return;
    var name = prompt("Neuer Name für «" + f.name + "»:", f.name);
    if (!name) return;
    name = name.trim();
    if (!name) return;
    f.name = name;
    render();
    toast("Ordner umbenannt.");
  }

  function deleteFolder(folderId) {
    var f = getFolder(folderId);
    if (!f || f.locked) return;
    var count = state.leads.filter(function (l) { return l.folderId === folderId; }).length;
    var msg = "Ordner «" + f.name + "» löschen?" +
      (count ? "\n\n" + count + " Anfrage(n) werden zurück in die Inbox verschoben." : "");
    if (!confirm(msg)) return;
    state.leads.forEach(function (l) { if (l.folderId === folderId) l.folderId = "inbox"; });
    state.folders = state.folders.filter(function (x) { return x.id !== folderId; });
    if (state.activeFolder === folderId) state.activeFolder = "inbox";
    render();
    toast("Ordner gelöscht.");
  }

  /* ==========================================================
     REPLY-SYSTEM
     ========================================================== */
  function openReply(leadId) {
    var lead = getLead(leadId);
    if (!lead) return;
    replyLeadId = leadId;
    lead.unread = false;

    $replyTo.textContent = lead.name + " <" + lead.email + ">";
    $replyCtx.innerHTML =
      "<b>" + escapeHtml(pkgShort(lead.interesse)) + "</b> · " + escapeHtml(lead.firma || "—") + "\n" +
      escapeHtml(lead.nachricht || "(keine Nachricht)");
    $replySubj.value = "Re: Ihre Anfrage bei SynaptoCore — " + pkgShort(lead.interesse);
    $replyBody.value = "";
    updateMailtoLink();

    $overlay.classList.add("open");
    render();
    setTimeout(function () { $replyBody.focus(); }, 100);
  }

  function closeReply() {
    clearInterval(aiTimer);
    $btnAi.disabled = false;
    $btnAi.textContent = "✨ AI Assist";
    $overlay.classList.remove("open");
    replyLeadId = null;
  }

  function updateMailtoLink() {
    var lead = getLead(replyLeadId);
    if (!lead) return;
    $btnMailto.href = "mailto:" + encodeURIComponent(lead.email) +
      "?subject=" + encodeURIComponent($replySubj.value) +
      "&body=" + encodeURIComponent($replyBody.value);
  }

  $replySubj.addEventListener("input", updateMailtoLink);
  $replyBody.addEventListener("input", updateMailtoLink);

  /* ---------- AI Assist (Simulation der Claude/GPT-Logik) ---------- */
  function buildAiDraft(lead) {
    var short = pkgShort(lead.interesse);
    var quote = lead.nachricht
      ? "Sie schreiben: «" + (lead.nachricht.length > 110 ? lead.nachricht.slice(0, 110) + "…" : lead.nachricht) + "»\n\n"
      : "";

    var core = "";
    if (short === "Pilot") {
      core =
        "gerne bestätigen wir Ihnen den Erhalt Ihrer Anfrage für den kostenlosen Pilot.\n\n" +
        quote +
        "So gehen wir vor: In einem kurzen Erstgespräch (ca. 20 Minuten) identifizieren wir gemeinsam den einen Kern-Prozess, der Ihnen aktuell am meisten Zeit kostet. Diesen automatisieren wir anschliessend und Sie testen das Resultat 7 Tage lang unverbindlich in Ihrem echten Arbeitsalltag — komplett kostenfrei und ohne Verpflichtung.\n\n" +
        "Passt Ihnen diese Woche ein Termin für das Erstgespräch? Schlagen Sie gerne zwei, drei Zeitfenster vor.";
    } else if (short === "Core Solution") {
      core =
        "vielen Dank für Ihr Interesse an unserer Core Solution.\n\n" +
        quote +
        "Die Core Solution umfasst die komplette System-Einrichtung: Wir verbinden Ihre bestehenden Tools (E-Mail, CRM, Kalender) über sichere KI-Pipelines, richten die Workflows fertig ein und übergeben Ihnen das System inklusive Dokumentation und Team-Einführung — einmalig 2'450 CHF, ohne versteckte Folgekosten.\n\n" +
        "Gerne zeigen wir Ihnen in einem kurzen Gespräch anhand Ihres konkreten Falls, wie die Einrichtung bei Ihnen aussehen würde. Wann würde es Ihnen passen?";
    } else if (short === "Managed Service") {
      core =
        "vielen Dank für Ihre Anfrage zum Managed Service.\n\n" +
        quote +
        "Mit dem Managed Service übernehmen wir die laufende API-Überwachung, passen Ihre Workflows bei Software-Änderungen proaktiv an und stehen Ihnen persönlich als Support zur Seite — für 240 CHF pro Monat, jederzeit auf Monatsende kündbar. Die einmalige System-Einrichtung ist im Paket vergünstigt: 2'200 CHF statt 2'450 CHF.\n\n" +
        "Gerne besprechen wir Ihre bestehende Umgebung in einem kurzen Call. Wann erreichen wir Sie am besten?";
    } else {
      core =
        "vielen Dank für Ihre Anfrage.\n\n" +
        quote +
        "Gerne melden wir uns mit einer konkreten Einschätzung. Wann erreichen wir Sie am besten für ein kurzes Erstgespräch?";
    }

    return "Guten Tag " + lead.name + "\n\n" +
      "Vielen Dank für Ihre Nachricht — " + core + "\n\n" +
      "Freundliche Grüsse\n" +
      "SynaptoCore · Zürich\n" +
      "synaptopcore@gmail.com · +41 78 809 00 94";
  }

  $btnAi.addEventListener("click", function () {
    var lead = getLead(replyLeadId);
    if (!lead) return;

    $btnAi.disabled = true;
    $btnAi.textContent = "✨ Claude denkt …";
    $replyBody.value = "";

    setTimeout(function () {
      var draft = buildAiDraft(lead);
      var i = 0;
      clearInterval(aiTimer);
      aiTimer = setInterval(function () {
        i = Math.min(i + 4, draft.length);   /* 4 Zeichen pro Tick */
        $replyBody.value = draft.slice(0, i);
        $replyBody.scrollTop = $replyBody.scrollHeight;
        if (i >= draft.length) {
          clearInterval(aiTimer);
          $btnAi.disabled = false;
          $btnAi.textContent = "✨ AI Assist";
          updateMailtoLink();
        }
      }, 12);
    }, 900); /* simulierte "Denkzeit" */
  });

  /* ---------- Senden (simuliert) ---------- */
  $btnSend.addEventListener("click", function () {
    var lead = getLead(replyLeadId);
    if (!lead) return;
    if (!$replyBody.value.trim()) { toast("Bitte zuerst eine Antwort verfassen."); return; }

    lead.repliedAt = Date.now();
    lead.unread = false;
    /* Workflow-Automatik: beantwortete Inbox-Leads wandern nach "In Progress" */
    var movedNote = "";
    if (lead.folderId === "inbox") {
      lead.folderId = "progress";
      movedNote = " — Lead nach «In Progress» verschoben";
    }
    closeReply();
    render();
    toast("Antwort an " + lead.name + " gespeichert" + movedNote + ".");
  });

  document.getElementById("reply-close").addEventListener("click", closeReply);
  $overlay.addEventListener("click", function (e) { if (e.target === $overlay) closeReply(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $overlay.classList.contains("open")) closeReply();
  });

  /* ==========================================================
     EXTERNE SCHNITTSTELLE (Make.com-Webhook / Website-Formular)
     ========================================================== */
  window.receiveNewLead = function (data) {
    data = data || {};
    if (!data.name || !data.email) {
      console.warn("receiveNewLead: 'name' und 'email' sind Pflichtfelder.", data);
      return null;
    }
    var lead = {
      id: uid(),
      folderId: "inbox",
      unread: true,
      repliedAt: null,
      createdAt: Date.now(),
      source: data.source || "webhook",
      name: String(data.name),
      firma: String(data.firma || ""),
      email: String(data.email),
      telefon: String(data.telefon || ""),
      interesse: String(data.interesse || ""),
      nachricht: String(data.nachricht || "")
    };
    state.leads.push(lead);
    render();
    toast("Neuer Lead: " + lead.name + " (" + (pkgShort(lead.interesse)) + ")");
    return lead.id;
  };

  /* Namespace für spätere Erweiterungen */
  window.SynaptoAdmin = {
    receiveNewLead: window.receiveNewLead,
    getState: function () { return JSON.parse(JSON.stringify(state)); }
  };

  /* ==========================================================
     TOOLBAR
     ========================================================== */
  document.getElementById("btn-add-folder").addEventListener("click", createFolder);
  $search.addEventListener("input", renderLeads);

  document.getElementById("btn-export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "synaptocore-leads-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Export erstellt.");
  });

  document.getElementById("btn-logout").addEventListener("click", function () {
    try { sessionStorage.removeItem(AUTH_FLAG); } catch (e) {}
    lock();
  });

  /* ---------- Start ---------- */
  render();
  console.log("%cSynaptoCore Admin bereit.", "color:#3b82f6;font-weight:bold",
    "\nWebhook-Einstieg: receiveNewLead({name, firma, email, telefon, interesse, nachricht})");
})();
