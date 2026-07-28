import { loadMailboxCredentials } from "../_shared/mailbox.ts";
import {
  customerConfirmation,
  type LeadForMail,
  type MailContent,
  ownerNotification,
  retryDelayMinutes,
} from "../_shared/mail.ts";
import { sendSmtpMessage } from "../_shared/smtp.ts";
import { adminClient, requireEnvironment } from "../_shared/supabase.ts";

type MailEvent = {
  id: string;
  lead_id: string;
  kind: "owner_notification" | "customer_confirmation";
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  rfc_message_id: string;
};

type Lead = LeadForMail & {
  folder_id: string;
  replied_at: string | null;
};

type BookingForMail = {
  status: "booked" | "cancelled";
  appointment_slots: { starts_at: string } | { starts_at: string }[] | null;
};

function mailContent(
  event: MailEvent,
  lead: Lead,
  inbox: string,
  adminUrl: string,
): MailContent {
  return event.kind === "owner_notification"
    ? ownerNotification(lead, inbox, adminUrl)
    : customerConfirmation(lead, inbox);
}

function appointmentStart(booking: BookingForMail | null): string | null {
  const slot = Array.isArray(booking?.appointment_slots)
    ? booking?.appointment_slots[0]
    : booking?.appointment_slots;
  return slot?.starts_at ?? null;
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(
    0,
    1_000,
  );
}

async function markDeliveryFailure(
  supabase: ReturnType<typeof adminClient>,
  event: MailEvent,
  error: unknown,
) {
  const delay = retryDelayMinutes(event.attempts);
  const nextAttempt = delay === null
    ? null
    : new Date(Date.now() + delay * 60_000).toISOString();
  const { error: updateError } = await supabase
    .from("lead_mail_events")
    .update({
      status: "failed",
      next_attempt_at: nextAttempt,
      locked_at: null,
      last_error: safeError(error),
      updated_at: new Date().toISOString(),
    })
    .eq("id", event.id);
  if (updateError) {
    console.error("Could not persist SMTP delivery failure", updateError);
  }
}

async function processMailQueue(
  supabase: ReturnType<typeof adminClient>,
  inbox: string,
  adminUrl: string,
) {
  // Load the mailbox before claiming events. If it has not been connected yet,
  // queued mail stays pending instead of consuming retry attempts.
  const credentials = await loadMailboxCredentials(supabase);
  const { data, error } = await supabase.rpc("claim_due_lead_mail_events", {
    p_limit: 10,
  });
  if (error) throw error;

  for (const rawEvent of data ?? []) {
    const event = rawEvent as MailEvent;
    try {
      const [{ data: lead, error: leadError }, { data: booking, error: bookingError }] =
        await Promise.all([
          supabase
            .from("leads")
            .select(
              "id,name,company,email,phone,message,created_at,folder_id,replied_at",
            )
            .eq("id", event.lead_id)
            .single(),
          supabase
            .from("appointment_bookings")
            .select("status,appointment_slots(starts_at)")
            .eq("lead_id", event.lead_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
      if (leadError) throw leadError;
      if (bookingError) throw bookingError;

      const leadForMail = {
        ...(lead as Lead),
        appointment_start: appointmentStart(booking as BookingForMail | null),
        appointment_status: (booking as BookingForMail | null)?.status ?? null,
      };
      const content = mailContent(event, leadForMail, inbox, adminUrl);

      await sendSmtpMessage(credentials, {
        ...content,
        fromEmail: inbox,
        fromName: event.kind === "owner_notification"
          ? "Systemio Website"
          : "Systemio",
        messageId: event.rfc_message_id,
      });

      const { error: updateError } = await supabase
        .from("lead_mail_events")
        .update({
          status: "sent",
          provider_message_id: event.rfc_message_id,
          provider_thread_id: null,
          sent_at: new Date().toISOString(),
          next_attempt_at: null,
          locked_at: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      if (updateError) throw updateError;
    } catch (sendError) {
      console.error(`SMTP delivery failed for event ${event.id}`, sendError);
      await markDeliveryFailure(supabase, event, sendError);
    }
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ ok: false }, { status: 405 });
  }
  if (
    request.headers.get("x-automation-secret") !==
      requireEnvironment("AUTOMATION_SECRET")
  ) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const supabase = adminClient();
    const inbox = "info@systemio.ch";
    const adminUrl = requireEnvironment("ADMIN_URL");

    await processMailQueue(supabase, inbox, adminUrl);
    await supabase.from("lead_submission_limits").delete().lt(
      "updated_at",
      new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString(),
    );

    return Response.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Swizzonic mailbox is not connected."
    ) {
      return Response.json({
        ok: true,
        skipped: "mailbox_not_connected",
      });
    }
    console.error("mail-worker failed", error);
    return Response.json({ ok: false, error: safeError(error) }, {
      status: 500,
    });
  }
});
