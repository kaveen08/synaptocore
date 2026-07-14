type AppointmentSlot = {
  id: string;
  starts_at: string;
};

const form = document.querySelector<HTMLFormElement>("#anfrage-form");
const success = document.querySelector<HTMLElement>("#form-success");
const errorBox = document.querySelector<HTMLElement>("#form-error");
const verificationBox = document.querySelector<HTMLElement>("#form-verification-error");
const cooldownBox = document.querySelector<HTMLElement>("#form-cooldown");
const rateLimitBox = document.querySelector<HTMLElement>("#form-rate-limit");
const slotRequiredBox = document.querySelector<HTMLElement>("#form-slot-required");
const slotUnavailableBox = document.querySelector<HTMLElement>("#form-slot-unavailable");
const slotInput = document.querySelector<HTMLInputElement>("#f-slot-id");
const slotList = document.querySelector<HTMLElement>("#appointment-slot-list");
const slotLoading = document.querySelector<HTMLElement>("#appointment-loading");
const slotEmpty = document.querySelector<HTMLElement>("#appointment-empty");
const slotLoadError = document.querySelector<HTMLElement>("#appointment-load-error");
const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const publishableKey =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY = "systemio-last-submit";
const TIME_ZONE = "Europe/Zurich";
const messages = [errorBox, verificationBox, cooldownBox, rateLimitBox, slotRequiredBox, slotUnavailableBox];
const securityConfigured = submitButton?.dataset.securityConfigured === "true";

let loading = false;
let selectedSlotId = "";

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

function clearMessages(): void {
  for (const message of messages) {
    if (message) message.hidden = true;
  }
}

function showSuccess(): void {
  if (!form || !success) return;
  form.hidden = true;
  success.hidden = false;
  success.focus({ preventScroll: true });
  success.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateSubmitState(): void {
  if (!submitButton) return;
  submitButton.disabled = loading || !securityConfigured || !selectedSlotId;
  submitButton.textContent = loading ? "Termin wird gebucht ..." : "Termin buchen";
}

function setLoading(nextLoading: boolean): void {
  loading = nextLoading;
  updateSubmitState();
}

function dateKey(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function setSelectedSlot(id: string): void {
  selectedSlotId = id;
  if (slotInput) slotInput.value = id;
  slotList?.querySelectorAll<HTMLButtonElement>("[data-slot-id]").forEach((button) => {
    const selected = button.dataset.slotId === id;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("border-primary", selected);
    button.classList.toggle("bg-primary", selected);
    button.classList.toggle("text-white", selected);
    button.classList.toggle("bg-white", !selected);
    button.classList.toggle("text-ink", !selected);
  });
  updateSubmitState();
}

function clearRenderedSlots(): void {
  slotList?.querySelectorAll<HTMLElement>("[data-slot-group]").forEach((element) => element.remove());
}

function renderSlots(slots: AppointmentSlot[]): void {
  clearRenderedSlots();
  selectedSlotId = "";
  if (slotInput) slotInput.value = "";

  if (slotLoading) slotLoading.hidden = true;
  if (slotLoadError) slotLoadError.hidden = true;
  if (slotEmpty) slotEmpty.hidden = slots.length > 0;

  const groups = new Map<string, AppointmentSlot[]>();
  for (const slot of slots) {
    const key = dateKey(slot.starts_at);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }

  for (const daySlots of groups.values()) {
    const first = daySlots[0];
    const group = document.createElement("section");
    group.dataset.slotGroup = "true";
    group.className = "border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0";

    const heading = document.createElement("h3");
    heading.className = "text-sm font-semibold text-ink";
    heading.textContent = dateLabel(first.starts_at);
    group.append(heading);

    const buttonWrap = document.createElement("div");
    buttonWrap.className = "mt-3 flex flex-wrap gap-2";
    for (const slot of daySlots) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.slotId = slot.id;
      button.setAttribute("aria-pressed", "false");
      button.className =
        "min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/30";
      button.textContent = timeLabel(slot.starts_at);
      button.addEventListener("click", () => {
        clearMessages();
        setSelectedSlot(slot.id);
      });
      buttonWrap.append(button);
    }
    group.append(buttonWrap);
    slotList?.append(group);
  }

  updateSubmitState();
}

async function loadSlots(): Promise<void> {
  clearRenderedSlots();
  if (slotLoading) slotLoading.hidden = false;
  if (slotEmpty) slotEmpty.hidden = true;
  if (slotLoadError) slotLoadError.hidden = true;
  selectedSlotId = "";
  if (slotInput) slotInput.value = "";
  updateSubmitState();

  if (!supabaseUrl || !publishableKey) {
    if (slotLoading) slotLoading.hidden = true;
    if (slotLoadError) slotLoadError.hidden = false;
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/list_available_appointment_slots`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok) throw new Error(`Slot request failed: ${response.status}`);
    const slots = await response.json() as AppointmentSlot[];
    renderSlots(slots);
  } catch (error) {
    console.error("Freie Termine konnten nicht geladen werden:", error);
    if (slotLoading) slotLoading.hidden = true;
    if (slotLoadError) slotLoadError.hidden = false;
    updateSubmitState();
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (inputValue("#f-website")) {
    markSubmitted();
    showSuccess();
    return;
  }

  if (!selectedSlotId) {
    showMessage(slotRequiredBox);
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
        slotId: selectedSlotId,
        name: inputValue("#f-name"),
        company: inputValue("#f-firma"),
        email: inputValue("#f-email"),
        phone: inputValue("#f-telefon"),
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
      if (response.status === 409 || result.code === "slot_unavailable") {
        showMessage(slotUnavailableBox);
        void loadSlots();
      } else if (response.status === 429 || result.code === "rate_limited") {
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

updateSubmitState();
void loadSlots();
