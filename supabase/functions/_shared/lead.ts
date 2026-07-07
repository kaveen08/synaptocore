export type LeadSubmission = {
  name: string;
  company: string;
  email: string;
  message: string;
  website: string;
  turnstileToken: string;
};

export type LeadValidationResult =
  | { ok: true; data: LeadSubmission }
  | {
    ok: false;
    code: "invalid_request" | "verification_failed";
    message: string;
  };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateLeadSubmission(value: unknown): LeadValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Ungültige Anfrage.",
    };
  }

  const payload = value as Record<string, unknown>;
  const data: LeadSubmission = {
    name: stringValue(payload.name),
    company: stringValue(payload.company),
    email: stringValue(payload.email).toLowerCase(),
    message: stringValue(payload.message),
    website: stringValue(payload.website),
    turnstileToken: stringValue(payload.turnstileToken),
  };

  if (!data.name || data.name.length > 160) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Bitte geben Sie einen gültigen Namen ein.",
    };
  }
  if (!data.company || data.company.length > 200) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Bitte geben Sie eine gültige Firma ein.",
    };
  }
  if (
    !EMAIL_PATTERN.test(data.email) || data.email.length > 320 ||
    /[\r\n]/u.test(data.email)
  ) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Bitte prüfen Sie die E-Mail-Adresse.",
    };
  }
  if (!data.message || data.message.length > 2_000) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Bitte beschreiben Sie Ihr Anliegen in höchstens 2.000 Zeichen.",
    };
  }
  if (data.website.length > 500) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Ungültige Anfrage.",
    };
  }
  if (
    !data.website &&
    (!data.turnstileToken || data.turnstileToken.length > 2_048)
  ) {
    return {
      ok: false,
      code: "verification_failed",
      message: "Bitte bestätigen Sie, dass Sie kein Roboter sind.",
    };
  }

  return { ok: true, data };
}
