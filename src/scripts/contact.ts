import { getSupabase } from "../lib/supabase";

const form = document.querySelector<HTMLFormElement>("#anfrage-form");
const success = document.querySelector<HTMLElement>("#form-success");
const errorBox = document.querySelector<HTMLElement>("#form-error");
const cooldownBox = document.querySelector<HTMLElement>("#form-cooldown");
const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
const tierSelect = document.querySelector<HTMLSelectElement>("#f-interesse");

const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY = "synapto-last-submit";

function inputValue(id: string): string {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(id)?.value.trim() ?? "";
}

function cooldownActive(): boolean {
  try {
    const timestamp = Number(sessionStorage.getItem(COOLDOWN_KEY) ?? 0);
    return timestamp > 0 && Date.now() - timestamp < COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markSubmitted(): void {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {
    // The submission still succeeds if sessionStorage is unavailable.
  }
}

function showSuccess(): void {
  if (!form || !success) return;
  form.classList.add("is-hidden");
  window.setTimeout(() => {
    form.style.display = "none";
    success.classList.add("is-visible");
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 400);
}

function setLoading(loading: boolean): void {
  if (!submitButton) return;
  submitButton.disabled = loading;
  submitButton.textContent = loading ? "Wird gesendet..." : "Anfrage senden";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (errorBox) errorBox.hidden = true;
  if (cooldownBox) cooldownBox.hidden = true;

  if (inputValue("#f-website")) {
    markSubmitted();
    showSuccess();
    return;
  }

  if (cooldownActive()) {
    if (cooldownBox) cooldownBox.hidden = false;
    return;
  }

  setLoading(true);

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("leads").insert({
      name: inputValue("#f-name"),
      company: inputValue("#f-firma"),
      email: inputValue("#f-email"),
      phone: inputValue("#f-telefon"),
      selected_package: tierSelect?.value ?? "",
      message: inputValue("#f-nachricht"),
      source: "website",
      folder_id: "inbox",
      unread: true,
      replied_at: null,
    });

    if (error) throw error;

    markSubmitted();
    showSuccess();
  } catch (error) {
    console.error("Die Anfrage konnte nicht in Supabase gespeichert werden:", error);
    setLoading(false);
    if (errorBox) errorBox.hidden = false;
  }
});

document.querySelectorAll<HTMLElement>(".tier-cta[data-tier]").forEach((link) => {
  link.addEventListener("click", () => {
    if (!tierSelect) return;
    tierSelect.value = link.dataset.tier ?? tierSelect.value;
    tierSelect.classList.add("is-flash");
    window.setTimeout(() => tierSelect.classList.remove("is-flash"), 1400);
  });
});

function closeLegal(): void {
  document.querySelectorAll(".legal-overlay.open").forEach((overlay) => {
    overlay.classList.remove("open");
  });
  document.body.classList.remove("modal-open");
}

document.querySelectorAll<HTMLElement>("[data-legal]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const overlay = document.querySelector<HTMLElement>(`#legal-${link.dataset.legal}`);
    if (!overlay) return;
    overlay.classList.add("open");
    document.body.classList.add("modal-open");
    overlay.querySelector<HTMLElement>(".legal-modal")?.scrollTo({ top: 0 });
  });
});

document.querySelectorAll("[data-legal-close]").forEach((button) => {
  button.addEventListener("click", closeLegal);
});

document.querySelectorAll(".legal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeLegal();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLegal();
});
