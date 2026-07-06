import { getSupabase } from "../lib/supabase";

const form = document.querySelector<HTMLFormElement>("#anfrage-form");
const success = document.querySelector<HTMLElement>("#form-success");
const errorBox = document.querySelector<HTMLElement>("#form-error");
const cooldownBox = document.querySelector<HTMLElement>("#form-cooldown");
const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');

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
    // Die Anfrage funktioniert auch ohne verfügbaren Session Storage.
  }
}

function showMessage(message: HTMLElement | null): void {
  if (!message) return;
  message.hidden = false;
  message.focus({ preventScroll: true });
  message.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showSuccess(): void {
  if (!form || !success) return;
  form.hidden = true;
  success.hidden = false;
  success.focus({ preventScroll: true });
  success.scrollIntoView({ behavior: "smooth", block: "center" });
}

function setLoading(loading: boolean): void {
  if (!submitButton) return;
  submitButton.disabled = loading;
  submitButton.textContent = loading ? "Anfrage wird gesendet …" : "Erstgespräch anfragen";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (errorBox) errorBox.hidden = true;
  if (cooldownBox) cooldownBox.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (inputValue("#f-website")) {
    markSubmitted();
    showSuccess();
    return;
  }

  if (cooldownActive()) {
    showMessage(cooldownBox);
    return;
  }

  setLoading(true);

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("leads").insert({
      name: inputValue("#f-name"),
      company: inputValue("#f-firma"),
      email: inputValue("#f-email"),
      phone: null,
      selected_package: "Erstgespräch",
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
    showMessage(errorBox);
  }
});
