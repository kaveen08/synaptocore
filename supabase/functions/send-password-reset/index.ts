import { passwordRecoveryNotice } from "../_shared/mail.ts";
import { loadMailboxCredentials } from "../_shared/mailbox.ts";
import { sendSmtpMessage, SmtpError } from "../_shared/smtp.ts";
import { adminClient, requireEnvironment } from "../_shared/supabase.ts";

const INBOX = "info@systemio.ch";
const DEFAULT_ADMIN_URL = "https://systemio.vercel.app/admin/";
const MAX_EMAIL_LENGTH = 254;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "*";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const permitted = !allowed.length || allowed.includes(origin);

  return {
    "Access-Control-Allow-Origin": permitted ? origin : "null",
    "Access-Control-Allow-Headers":
      "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return !origin || !allowed.length || allowed.includes(origin);
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
  );
}

async function hashValue(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnvironment("RATE_LIMIT_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The recovery link must return to the deployed workspace, not to a domain that
 * is not serving `/admin/` yet. `redirect_to` also has to be on the Supabase
 * redirect allowlist, otherwise Auth silently falls back to the site URL.
 */
function adminUrl(): string {
  const configured = Deno.env.get("ADMIN_URL")?.trim();
  if (!configured) return DEFAULT_ADMIN_URL;
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return DEFAULT_ADMIN_URL;
    }
    return parsed.toString();
  } catch {
    return DEFAULT_ADMIN_URL;
  }
}

function parseEmail(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    !/^[^<>\r\n\s@]+@[^<>\r\n\s@]+\.[^<>\r\n\s@]+$/u.test(email)
  ) {
    return null;
  }
  return email;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, { ok: false, code: "method_not_allowed" }, 405);
  }
  if (!originAllowed(request)) {
    return json(request, { ok: false, code: "origin_denied" }, 403);
  }

  try {
    const email = parseEmail(await request.json());
    if (!email) {
      return json(request, {
        ok: false,
        code: "invalid_email",
        message: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      }, 400);
    }

    const supabase = adminClient();
    const [ipKey, emailKey] = await Promise.all([
      hashValue(`reset-ip:${clientIp(request)}`),
      hashValue(`reset-email:${email.toLowerCase()}`),
    ]);

    for (const [limitKey, limit] of [[ipKey, 5], [emailKey, 3]] as const) {
      const { data: allowed, error } = await supabase.rpc(
        "record_admin_reset_attempt",
        { p_limit_key: limitKey, p_limit: limit },
      );
      if (error) throw error;
      if (allowed === false) {
        return json(request, {
          ok: false,
          code: "rate_limited",
          message:
            "Zu viele Anfragen. Bitte versuchen Sie es in 15 Minuten erneut.",
        }, 429);
      }
    }

    // Only allowlisted admins may receive a link, and it is always sent to the
    // stored address rather than to whatever was typed into the form.
    const { data: recipient, error: lookupError } = await supabase.rpc(
      "admin_recovery_email",
      { p_email: email },
    );
    if (lookupError) throw lookupError;
    if (!recipient) {
      return json(request, { ok: true, sent: false });
    }

    const { data: link, error: linkError } = await supabase.auth.admin
      .generateLink({
        type: "recovery",
        email: recipient,
        options: { redirectTo: adminUrl() },
      });
    if (linkError) throw linkError;

    const actionLink = link?.properties?.action_link;
    if (!actionLink) throw new Error("Auth returned no recovery link.");

    const credentials = await loadMailboxCredentials(supabase);
    await sendSmtpMessage(credentials, {
      ...passwordRecoveryNotice(recipient, actionLink),
      fromEmail: INBOX,
      fromName: "Systemio",
      messageId: `<password-reset-${crypto.randomUUID()}@systemio.local>`,
    });

    return json(request, { ok: true, sent: true });
  } catch (error) {
    console.error("send-password-reset failed", error);
    const message = (error instanceof Error ? error.message : String(error))
      .slice(0, 500);
    const mailboxMissing = message === "Swizzonic mailbox is not connected.";
    const mailboxAuthFailed = error instanceof SmtpError &&
      error.responseCode === 535;
    return json(
      request,
      {
        ok: false,
        code: mailboxMissing
          ? "mailbox_not_connected"
          : mailboxAuthFailed
          ? "mailbox_auth_failed"
          : "send_failed",
        message: mailboxMissing
          ? "Das Postfach info@systemio.ch ist nicht verbunden. Der Link kann erst danach versendet werden."
          : mailboxAuthFailed
          ? "Swizzonic hat die Anmeldung abgelehnt. Bitte verbinden Sie das Postfach erneut."
          : "Der Passwort-Link konnte nicht versendet werden.",
      },
      mailboxMissing || mailboxAuthFailed ? 503 : 500,
    );
  }
});
