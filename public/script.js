const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/nkn98sdyvqhedzivdbhkbc6m1m5qo0lh";

/* Make.com-Konfiguration: Ersetzen Sie die URL oben durch Ihre Live-Webhook-URL. */

(function () {
  "use strict";

  var form      = document.getElementById("anfrage-form");
  var success   = document.getElementById("form-success");
  var errorBox  = document.getElementById("form-error");
  var cooldownBox = document.getElementById("form-cooldown");
  var submitBtn = form.querySelector('button[type="submit"]');
  var tierSelect = document.getElementById("f-interesse");

  /* ---------- Rate-Limiting (Spam-Schutz) ---------- */
  var COOLDOWN_MS  = 60 * 1000; /* max. 1 Anfrage pro Minute */
  var COOLDOWN_KEY = "synapto-last-submit";

  function cooldownActive() {
    try {
      var ts = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
      return ts > 0 && (Date.now() - ts) < COOLDOWN_MS;
    } catch (e) { return false; }
  }

  function markSubmitted() {
    try { sessionStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e) {}
  }

  /* ---------- Formular-Übermittlung (Make.com-Webhook) ---------- */
  function showSuccess() {
    form.classList.add("is-hidden");
    setTimeout(function () {
      form.style.display = "none";
      success.classList.add("is-visible");
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400); // matches the CSS transition duration
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? "Wird gesendet..." : "Anfrage senden";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    cooldownBox.hidden = true;

    /* Honeypot-Guard: echte Besucher sehen das Feld nie — ist es gefüllt,
       war ein Bot am Werk. Erfolgsmeldung zeigen, aber nichts senden. */
    var honeypot = document.getElementById("f-website");
    if (honeypot && honeypot.value) {
      markSubmitted();
      showSuccess();
      return;
    }

    /* Cooldown-Guard: blockt erneute Anfragen innerhalb von 60 Sekunden,
       ohne den Webhook aufzurufen — schont das Make.com-Kontingent. */
    if (cooldownActive()) {
      cooldownBox.hidden = false;
      return;
    }

    setLoading(true);

    var payload = {
      name:             document.getElementById("f-name").value.trim(),
      company:          document.getElementById("f-firma").value.trim(),
      email:            document.getElementById("f-email").value.trim(),
      phone:            document.getElementById("f-telefon").value.trim(),
      selected_package: tierSelect.value,
      message:          document.getElementById("f-nachricht").value.trim()
    };

    try {
      var response = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.status === 200) {
        markSubmitted();
        showSuccess();
        return;
      }

      throw new Error("HTTP " + response.status);
    } catch (error) {
      console.error("Die Anfrage konnte nicht übermittelt werden:", error);
      setLoading(false);
      errorBox.hidden = false;
    }
  });

  /* ---------- Pricing → Formular-Routing ---------- */
  // "Jetzt anfragen" scrollt via Anker (#kontakt) smooth zum Formular;
  // hier wird zusätzlich die passende Stufe im Dropdown vorausgewählt.
  var tierLinks = document.querySelectorAll(".tier-cta[data-tier]");
  Array.prototype.forEach.call(tierLinks, function (link) {
    link.addEventListener("click", function () {
      tierSelect.value = link.getAttribute("data-tier");
      tierSelect.classList.add("is-flash");
      setTimeout(function () {
        tierSelect.classList.remove("is-flash");
      }, 1400);
    });
  });

  /* ---------- Rechtliches: AGB & Datenschutz (Modale) ---------- */
  function openLegal(id) {
    var overlay = document.getElementById("legal-" + id);
    if (!overlay) return;
    overlay.classList.add("open");
    document.body.classList.add("modal-open");
    overlay.querySelector(".legal-modal").scrollTop = 0;
  }

  function closeLegal() {
    document.querySelectorAll(".legal-overlay.open").forEach(function (o) {
      o.classList.remove("open");
    });
    document.body.classList.remove("modal-open");
  }

  document.querySelectorAll("[data-legal]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      openLegal(link.getAttribute("data-legal"));
    });
  });

  document.querySelectorAll("[data-legal-close]").forEach(function (btn) {
    btn.addEventListener("click", closeLegal);
  });

  document.querySelectorAll(".legal-overlay").forEach(function (o) {
    o.addEventListener("click", function (e) { if (e.target === o) closeLegal(); });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLegal();
  });
})();
