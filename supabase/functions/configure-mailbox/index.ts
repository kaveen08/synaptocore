import { createClient } from "npm:@supabase/supabase-js@2.110.0";

import { encryptMailboxPassword } from "../_shared/mailbox.ts";
import {
  SmtpError,
  testSmtpCredentials,
} from "../_shared/smtp.ts";
import { adminClient, requireEnvironment } from "../_shared/supabase.ts";

const MAILBOX_USERNAME = "info@systemio.ch";
const SMTP_HOST = "smtp.mail-ch.ch";
const SMTP_PORT = 465;

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
    requireEnvironment("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    },
  );
}

async function isAdmin(
  supabase: NonNullable<ReturnType<typeof userClient>>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("folders")
    .select("id")
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
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

  const userSupabase = userClient(request);
  if (!userSupabase) {
    return json(request, { ok: false, code: "not_authenticated" }, 401);
  }

  try {
    if (!await isAdmin(userSupabase)) {
      return json(request, { ok: false, code: "not_authorized" }, 403);
    }

    const payload = await request.json() as Record<string, unknown>;
    const serviceSupabase = adminClient();

    if (payload.action === "status") {
      const { data, error } = await serviceSupabase
        .from("mailbox_connections")
        .select("connected_at")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return json(request, {
        ok: true,
        connected: Boolean(data),
        connectedAt: data?.connected_at ?? null,
      });
    }

    const password = typeof payload.password === "string"
      ? payload.password
      : "";
    if (!password || password.length > 512) {
      return json(request, { ok: false, code: "invalid_password" }, 400);
    }

    await testSmtpCredentials({
      host: SMTP_HOST,
      port: SMTP_PORT,
      username: MAILBOX_USERNAME,
      password,
    });
    const encrypted = await encryptMailboxPassword(password);
    const timestamp = new Date().toISOString();
    const { error } = await serviceSupabase
      .from("mailbox_connections")
      .upsert({
        singleton: true,
        provider: "swizzonic",
        host: SMTP_HOST,
        port: SMTP_PORT,
        username: MAILBOX_USERNAME,
        encrypted_password: encrypted.encryptedPassword,
        password_iv: encrypted.passwordIv,
        connected_at: timestamp,
        updated_at: timestamp,
      });
    if (error) throw error;

    return json(request, {
      ok: true,
      connected: true,
      connectedAt: timestamp,
    });
  } catch (error) {
    console.error("configure-mailbox failed", error);
    const isAuthFailure = error instanceof SmtpError &&
      error.responseCode === 535;
    const isSmtpFailure = error instanceof SmtpError;
    return json(
      request,
      {
        ok: false,
        code: isAuthFailure
          ? "mailbox_auth_failed"
          : isSmtpFailure
          ? "mailbox_connection_failed"
          : "configuration_failed",
        message: isAuthFailure
          ? "Swizzonic hat die Anmeldung abgelehnt. Bitte prüfen Sie das Postfach-Passwort."
          : isSmtpFailure
          ? "Die sichere Verbindung zu Swizzonic konnte nicht hergestellt werden."
          : "Das Postfach konnte nicht verbunden werden.",
      },
      isAuthFailure ? 401 : 500,
    );
  }
});
