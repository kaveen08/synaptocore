(function () {
  "use strict";

  var form      = document.getElementById("anfrage-form");
  var success   = document.getElementById("form-success");
  var submitBtn = form.querySelector('button[type="submit"]');
  var tierSelect = document.getElementById("f-interesse");

  /* ---------- Formular-Übermittlung ---------- */
  function showSuccess() {
    form.classList.add("is-hidden");
    setTimeout(function () {
      form.style.display = "none";
      success.classList.add("is-visible");
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400); // matches the CSS transition duration
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var action = form.getAttribute("action");

    // Keine Action-URL hinterlegt → reiner Demo-/Vorschaumodus
    if (!action) {
      showSuccess();
      return;
    }

    // Action-URL vorhanden (z.B. Formspree) → Daten per fetch senden
    submitBtn.disabled = true;
    submitBtn.textContent = "Wird gesendet…";

    fetch(action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        showSuccess();
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Anfrage senden";
        alert("Die Anfrage konnte nicht übermittelt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns direkt per E-Mail.");
      });
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
})();
