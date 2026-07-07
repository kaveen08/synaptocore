import {
  base64UrlEncode,
  buildMimeMessage,
  type MimeMessageInput,
} from "./mail.ts";

export type GmailCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

type GmailHistoryResponse = {
  historyId?: string;
  nextPageToken?: string;
  history?: Array<{
    messagesAdded?: Array<{ message: GmailMessage }>;
  }>;
};

export async function getGmailAccessToken(
  credentials: GmailCredentials,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !result.access_token) {
    throw new Error(
      `Gmail OAuth failed: ${
        result.error_description ?? result.error ?? response.status
      }`,
    );
  }
  return result.access_token;
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me${path}`,
    {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    const error = new Error(`Gmail API ${response.status}: ${detail}`) as
      & Error
      & { status?: number };
    error.status = response.status;
    throw error;
  }
  return await response.json() as T;
}

export async function sendGmailMessage(
  accessToken: string,
  input: MimeMessageInput,
): Promise<GmailMessage> {
  const raw = base64UrlEncode(buildMimeMessage(input));
  return await gmailFetch<GmailMessage>(accessToken, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
}

export async function getGmailProfile(
  accessToken: string,
): Promise<{ historyId: string }> {
  return await gmailFetch<{ historyId: string }>(accessToken, "/profile");
}

export async function getGmailMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  const query = new URLSearchParams({
    format: "metadata",
  });
  query.append("metadataHeaders", "To");
  query.append("metadataHeaders", "Message-ID");
  return await gmailFetch<GmailMessage>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?${query}`,
  );
}

export async function listSentHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<{ historyId: string; messages: GmailMessage[] }> {
  const messages = new Map<string, GmailMessage>();
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;

  do {
    const query = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      labelId: "SENT",
      maxResults: "100",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await gmailFetch<GmailHistoryResponse>(
      accessToken,
      `/history?${query}`,
    );
    latestHistoryId = result.historyId ?? latestHistoryId;
    for (const entry of result.history ?? []) {
      for (const added of entry.messagesAdded ?? []) {
        if (added.message.labelIds?.includes("SENT")) {
          messages.set(added.message.id, added.message);
        }
      }
    }
    pageToken = result.nextPageToken;
  } while (pageToken);

  return { historyId: latestHistoryId, messages: [...messages.values()] };
}

export async function listRecentSentMessages(
  accessToken: string,
): Promise<GmailMessage[]> {
  const query = new URLSearchParams({ labelIds: "SENT", maxResults: "100" });
  const result = await gmailFetch<{ messages?: GmailMessage[] }>(
    accessToken,
    `/messages?${query}`,
  );
  return result.messages ?? [];
}

export function headerValue(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((header) =>
    header.name.toLowerCase() === name.toLowerCase()
  )?.value ?? "";
}
