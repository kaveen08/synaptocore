const form = document.querySelector<HTMLFormElement>("#anfrage-form");
const success = document.querySelector<HTMLElement>("#form-success");
const errorBox = document.querySelector<HTMLElement>("#form-error");
const verificationBox = document.querySelector<HTMLElement>("#form-verification-error");
const cooldownBox = document.querySelector<HTMLElement>("#form-cooldown");
const rateLimitBox = document.querySelector<HTMLElement>("#form-rate-limit");
const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const publishableKey =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY = "synapto-last-submit";
const messages = [errorBox, verificationBox, cooldownBox, rateLimitBox];

declare global {
  interface Window {
    turnstile?: {
      reset: () => void;
    };
  }
}

function inputValue(selector: string): string {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value.trim() ?? "";
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
    // The request still works when Session Storage is unavailable.
  }
}

function showMessage(message: HTMLElement | null): void {
  if (!message) return;
  for (const candidate of messages) {
    if (candidate) candidate.hidden = candidate !== message;
  }
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
  for (const message of messages) {
    if (message) message.hidden = true;
  }

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

  const turnstileToken = inputValue('input[name="cf-turnstile-response"]');
  if (!turnstileToken) {
    showMessage(verificationBox);
    return;
  }

  if (!supabaseUrl || !publishableKey) {
    showMessage(errorBox);
    return;
  }

  setLoading(true);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/submit-lead`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: inputValue("#f-name"),
        company: inputValue("#f-firma"),
        email: inputValue("#f-email"),
        message: inputValue("#f-nachricht"),
        website: inputValue("#f-website"),
        turnstileToken,
      }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({ code: "submission_failed" })) as {
      ok?: boolean;
      code?: string;
    };

    if (!response.ok || !result.ok) {
      window.turnstile?.reset();
      setLoading(false);
      if (response.status === 429 || result.code === "rate_limited") {
        showMessage(rateLimitBox);
      } else if (result.code === "verification_failed") {
        showMessage(verificationBox);
      } else {
        showMessage(errorBox);
      }
      return;
    }

    markSubmitted();
    showSuccess();
  } catch (error) {
    console.error("Die Anfrage konnte nicht gespeichert werden:", error);
    window.turnstile?.reset();
    setLoading(false);
    showMessage(errorBox);
  } finally {
    window.clearTimeout(timeout);
  }
});
