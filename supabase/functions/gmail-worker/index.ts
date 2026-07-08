import {
  getGmailAccessToken,
  getGmailMessageMetadata,
  getGmailProfile,
  type GmailCredentials,
  type GmailMessage,
  headerValue,
  listRecentSentMessages,
  listSentHistory,
  sendGmailMessage,
} from "../_shared/gmail.ts";
import {
  customerConfirmation,
  type LeadForMail,
  type MailContent,
  ownerNotification,
  retryDelayMinutes,
} from "../_shared/mail.ts";
import { adminClient, requireEnvironment } from "../_shared/supabase.ts";

type MailEvent = {
  id: string;
  lead_id: string;
  kind: "owner_notification" | "customer_confirmation";
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  rfc_message_id: string;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  reply_synced_at: string | null;
};

type Lead = LeadForMail & {
  folder_id: string;
  replied_at: string | null;
};

function gmailCredentials(): GmailCredentials {
  return {
    clientId: requireEnvironment("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnvironment("GOOGLE_CLIENT_SECRET"),
    refreshToken: requireEnvironment("GOOGLE_REFRESH_TOKEN"),
  };
}

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
    console.error("Could not persist Gmail delivery failure", updateError);
  }
}

async function processMailQueue(
  supabase: ReturnType<typeof adminClient>,
  accessToken: string,
  inbox: string,
  adminUrl: string,
) {
  const { data, error } = await supabase.rpc("claim_due_lead_mail_events", {
    p_limit: 10,
  });
  if (error) throw error;

  for (const rawEvent of data ?? []) {
    const event = rawEvent as MailEvent;
    try {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id,name,company,email,message,created_at,folder_id,replied_at")
        .eq("id", event.lead_id)
        .single();
      if (leadError) throw leadError;

      const content = mailContent(event, lead as Lead, inbox, adminUrl);
      let result: GmailMessage | undefined;

      // A previous Gmail request may have succeeded before its database update
      // failed. Reconcile by deterministic Message-ID before retrying the send.
      if (event.attempts > 1) {
        for (const recent of await listRecentSentMessages(accessToken)) {
          const metadata = await getGmailMessageMetadata(
            accessToken,
            recent.id,
          );
          if (headerValue(metadata, "Message-ID") === event.rfc_message_id) {
            result = metadata;
            break;
          }
        }
      }

      result ??= await sendGmailMessage(accessToken, {
        ...content,
        fromEmail: inbox,
        fromName: event.kind === "owner_notification"
          ? "SynaptoCore Website"
          : "SynaptoCore",
        messageId: event.rfc_message_id,
      });

      const { error: updateError } = await supabase
        .from("lead_mail_events")
        .update({
          status: "sent",
          provider_message_id: result.id,
          provider_thread_id: result.threadId,
          sent_at: new Date().toISOString(),
          next_attempt_at: null,
          locked_at: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      if (updateError) throw updateError;
    } catch (sendError) {
      console.error(`Gmail delivery failed for event ${event.id}`, sendError);
      await markDeliveryFailure(supabase, event, sendError);
    }
  }
}

async function historyMessages(
  supabase: ReturnType<typeof adminClient>,
  accessToken: string,
): Promise<{ historyId: string; messages: GmailMessage[] }> {
  const { data: state, error: stateError } = await supabase
    .from("gmail_sync_state")
    .select("history_id")
    .eq("singleton", true)
    .single();
  if (stateError) throw stateError;

  if (!state.history_id) {
    const profile = await getGmailProfile(accessToken);
    return { historyId: profile.historyId, messages: [] };
  }

  try {
    return await listSentHistory(accessToken, state.history_id);
  } catch (error) {
    if (
      !(error instanceof Error && "status" in error &&
        (error as Error & { status?: number }).status === 404)
    ) {
      throw error;
    }

    const [messages, profile] = await Promise.all([
      listRecentSentMessages(accessToken),
      getGmailProfile(accessToken),
    ]);
    return { historyId: profile.historyId, messages };
  }
}

async function syncGmailReplies(
  supabase: ReturnType<typeof adminClient>,
  accessToken: string,
) {
  const batch = await historyMessages(supabase, accessToken);
  const messages = batch.messages;

  if (messages.length) {
    const { data: events, error: eventsError } = await supabase
      .from("lead_mail_events")
      .select(
        "id,lead_id,kind,status,attempts,rfc_message_id,provider_message_id,provider_thread_id,reply_synced_at",
      )
      .eq("kind", "owner_notification")
      .eq("status", "sent")
      .is("reply_synced_at", null)
      .not("provider_thread_id", "is", null);
    if (eventsError) throw eventsError;

    const byThread = new Map(
      (events ?? []).map((
        event,
      ) => [event.provider_thread_id, event as MailEvent]),
    );
    const processed = new Set<string>();

    for (const message of messages) {
      const event = byThread.get(message.threadId);
      if (
        !event || message.id === event.provider_message_id ||
        processed.has(event.id)
      ) continue;

      const [{ data: lead, error: leadError }, metadata] = await Promise.all([
        supabase.from("leads").select("id,email,folder_id,replied_at").eq(
          "id",
          event.lead_id,
        ).single(),
        getGmailMessageMetadata(accessToken, message.id),
      ]);
      if (leadError) throw leadError;

      const recipient = headerValue(metadata, "To").toLowerCase();
      if (!recipient.includes(lead.email.toLowerCase())) continue;

      const repliedAt = metadata.internalDate
        ? new Date(Number(metadata.internalDate)).toISOString()
        : new Date().toISOString();
      const leadUpdate = {
        replied_at: lead.replied_at ?? repliedAt,
        unread: false,
        ...(lead.folder_id === "inbox" ? { folder_id: "progress" } : {}),
      };
      const [{ error: leadUpdateError }, { error: eventUpdateError }] =
        await Promise.all([
          supabase.from("leads").update(leadUpdate).eq("id", lead.id),
          supabase
            .from("lead_mail_events")
            .update({
              reply_message_id: message.id,
              reply_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", event.id),
        ]);
      if (leadUpdateError) throw leadUpdateError;
      if (eventUpdateError) throw eventUpdateError;
      processed.add(event.id);
    }
  }

  const { error: stateUpdateError } = await supabase
    .from("gmail_sync_state")
    .update({
      history_id: batch.historyId,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true);
  if (stateUpdateError) throw stateUpdateError;
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
    const inbox = Deno.env.get("GMAIL_ACCOUNT")?.trim() ||
      "info@synaptocore.ch";
    const adminUrl = requireEnvironment("ADMIN_URL");
    const accessToken = await getGmailAccessToken(gmailCredentials());

    await processMailQueue(supabase, accessToken, inbox, adminUrl);
    await syncGmailReplies(supabase, accessToken);
    await supabase.from("lead_submission_limits").delete().lt(
      "updated_at",
      new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString(),
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error("gmail-worker failed", error);
    return Response.json({ ok: false, error: safeError(error) }, {
      status: 500,
    });
  }
});
