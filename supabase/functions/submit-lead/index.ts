import { validateLeadSubmission } from "../_shared/lead.ts";
import { adminClient, requireEnvironment } from "../_shared/supabase.ts";

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

async function hashIp(ip: string): Promise<string> {
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
    new TextEncoder().encode(ip),
  );
  return [...new Uint8Array(signature)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
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
    const payload = validateLeadSubmission(await request.json());
    if (!payload.ok) {
      return json(request, {
        ok: false,
        code: payload.code,
        message: payload.message,
      }, 400);
    }

    // Honeypot submissions receive a normal response without creating data or sending email.
    if (payload.data.website) return json(request, { ok: true }, 201);

    const ip = clientIp(request);
    const supabase = adminClient();
    const { data: allowed, error: limitError } = await supabase.rpc(
      "record_lead_submission_attempt",
      {
        p_ip_hash: await hashIp(ip),
        p_limit: 3,
        p_window: "15 minutes",
      },
    );
    if (limitError) throw limitError;
    if (!allowed) {
      return json(request, {
        ok: false,
        code: "rate_limited",
        message:
          "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in 15 Minuten erneut.",
      }, 429);
    }

    const { error } = await supabase.rpc("create_appointment_lead", {
      p_slot_id: payload.data.slotId,
      p_name: payload.data.name,
      p_company: payload.data.company,
      p_email: payload.data.email,
      p_phone: payload.data.phone,
      p_message: payload.data.message,
    });
    if (error?.message === "slot_unavailable") {
      return json(request, {
        ok: false,
        code: "slot_unavailable",
        message:
          "Dieser Termin ist nicht mehr verfÃ¼gbar. Bitte wÃ¤hlen Sie einen anderen Termin.",
      }, 409);
    }
    if (error) throw error;

    return json(request, { ok: true }, 201);
  } catch (error) {
    console.error("submit-lead failed", error);
    return json(request, {
      ok: false,
      code: "submission_failed",
      message:
        "Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    }, 500);
  }
});
