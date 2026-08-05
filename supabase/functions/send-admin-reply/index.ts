import { createClient } from "npm:@supabase/supabase-js@2.110.0";

import { loadMailboxCredentials } from "../_shared/mailbox.ts";
import { escapeHtml } from "../_shared/mail.ts";
import { sendSmtpMessage, SmtpError } from "../_shared/smtp.ts";
import { adminClient, publishableKey, requireEnvironment } from "../_shared/supabase.ts";

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 10_000;

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

function userClient(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  return createClient(
    requireEnvironment("SUPABASE_URL"),
    publishableKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    },
  );
}

function parsePayload(value: unknown):
  | { ok: true; leadId: string; subject: string; body: string }
  | { ok: false } {
  if (!value || typeof value !== "object") return { ok: false };
  const payload = value as Record<string, unknown>;
  const leadId = typeof payload.leadId === "string"
    ? payload.leadId.trim()
    : "";
  const subject = typeof payload.subject === "string"
    ? payload.subject.trim()
    : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
      .test(leadId) ||
    !subject ||
    subject.length > MAX_SUBJECT_LENGTH ||
    !body ||
    body.length > MAX_BODY_LENGTH
  ) {
    return { ok: false };
  }

  return { ok: true, leadId, subject, body };
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
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

  const supabase = userClient(request);
  if (!supabase) {
    return json(request, { ok: false, code: "not_authenticated" }, 401);
  }

  try {
    const payload = parsePayload(await request.json());
    if (!payload.ok) {
      return json(request, { ok: false, code: "invalid_payload" }, 400);
    }

    // This query is intentionally made as the signed-in user. The existing
    // leads RLS policy returns a row only for allowlisted Systemio admins.
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id,email,folder_id")
      .eq("id", payload.leadId)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) {
      return json(request, { ok: false, code: "not_authorized" }, 403);
    }

    const inbox = "info@systemio.ch";
    const credentials = await loadMailboxCredentials(adminClient());
    const messageId =
      `<admin-reply-${lead.id}-${crypto.randomUUID()}@systemio.local>`;
    await sendSmtpMessage(credentials, {
      to: lead.email,
      replyTo: inbox,
      subject: payload.subject,
      text: payload.body,
      html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#172033">${
        escapeHtml(payload.body)
      }</div>`,
      fromEmail: inbox,
      fromName: "Systemio",
      messageId,
    });

    const repliedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        replied_at: repliedAt,
        unread: false,
        ...(lead.folder_id === "inbox" ? { folder_id: "progress" } : {}),
      })
      .eq("id", lead.id);
    if (updateError) throw updateError;

    return json(request, {
      ok: true,
      messageId,
      repliedAt,
    });
  } catch (error) {
    console.error("send-admin-reply failed", error);
    const message = safeError(error);
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
          ? "Bitte verbinden Sie zuerst das Swizzonic-Postfach info@systemio.ch."
          : mailboxAuthFailed
          ? "Swizzonic hat die Anmeldung abgelehnt. Bitte verbinden Sie das Postfach erneut."
          : "Die E-Mail konnte nicht gesendet werden.",
      },
      mailboxMissing || mailboxAuthFailed ? 503 : 500,
    );
  }
});
