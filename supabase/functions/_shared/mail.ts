export type MailContent = {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
};

export type LeadForMail = {
  id: string;
  name: string;
  company: string;
  email: string;
  message: string;
  created_at: string;
};

export type MimeMessageInput = MailContent & {
  fromEmail: string;
  fromName: string;
  messageId: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/gu, " ").trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function encodedHeader(value: string): string {
  return `=?UTF-8?B?${
    bytesToBase64(new TextEncoder().encode(headerSafe(value)))
  }?=`;
}

export function base64UrlEncode(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function buildMimeMessage(input: MimeMessageInput): string {
  const boundary = `synaptocore-${crypto.randomUUID()}`;
  const headers = [
    `From: ${encodedHeader(input.fromName)} <${headerSafe(input.fromEmail)}>`,
    `To: ${headerSafe(input.to)}`,
    input.replyTo ? `Reply-To: ${headerSafe(input.replyTo)}` : null,
    `Subject: ${encodedHeader(input.subject)}`,
    `Message-ID: ${headerSafe(input.messageId)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);

  return [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function emailShell(content: string): string {
  return `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#f4f5f7;color:#172033;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe3ea">
            <tr><td style="padding:28px 30px">${content}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function ownerNotification(
  lead: LeadForMail,
  inbox: string,
  adminUrl: string,
): MailContent {
  const name = escapeHtml(lead.name);
  const company = escapeHtml(lead.company);
  const email = escapeHtml(lead.email);
  const message = escapeHtml(lead.message).replaceAll("\n", "<br>");
  const subject = `Neue Website-Anfrage: ${lead.company} — ${lead.name}`;

  return {
    to: inbox,
    replyTo: lead.email,
    subject,
    text: [
      "Neue Website-Anfrage",
      "",
      `Name: ${lead.name}`,
      `Firma: ${lead.company}`,
      `E-Mail: ${lead.email}`,
      "",
      "Anliegen:",
      lead.message,
      "",
      `Admin: ${adminUrl}`,
      "",
      "Antworten Sie direkt auf diese E-Mail, um den Kunden zu erreichen.",
    ].join("\n"),
    html: emailShell(`
      <p style="margin:0 0 8px;color:#5b6577;font-size:13px">Neue Website-Anfrage</p>
      <h1 style="margin:0 0 24px;font-size:24px;line-height:1.25">${company} · ${name}</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.6">
        <tr><td style="width:90px;color:#5b6577;padding:3px 0">Name</td><td>${name}</td></tr>
        <tr><td style="color:#5b6577;padding:3px 0">Firma</td><td>${company}</td></tr>
        <tr><td style="color:#5b6577;padding:3px 0">E-Mail</td><td><a href="mailto:${email}" style="color:#1d4ed8">${email}</a></td></tr>
      </table>
      <hr style="border:0;border-top:1px solid #dfe3ea;margin:24px 0">
      <p style="margin:0 0 8px;color:#5b6577;font-size:13px">Anliegen</p>
      <p style="margin:0;font-size:15px;line-height:1.7">${message}</p>
      <p style="margin:26px 0 0"><a href="${
      escapeHtml(adminUrl)
    }" style="display:inline-block;background:#172033;color:#ffffff;text-decoration:none;padding:11px 16px">In der Admin-Konsole öffnen</a></p>
      <p style="margin:20px 0 0;color:#5b6577;font-size:13px">Antworten Sie direkt auf diese E-Mail, um den Kunden zu erreichen.</p>
    `),
  };
}

export function customerConfirmation(
  lead: LeadForMail,
  inbox: string,
): MailContent {
  const name = escapeHtml(lead.name);
  const subject = "Ihre Anfrage bei SynaptoCore ist eingegangen";

  return {
    to: lead.email,
    replyTo: inbox,
    subject,
    text: [
      `Guten Tag ${lead.name}`,
      "",
      "Vielen Dank für Ihre Anfrage. Wir prüfen Ihre Angaben und melden uns innerhalb von 24 Stunden mit einer ersten Einschätzung.",
      "",
      "Freundliche Grüsse",
      "SynaptoCore · Zürich",
      "info@synaptocore.ch · +41 78 809 00 94",
    ].join("\n"),
    html: emailShell(`
      <p style="margin:0 0 22px;font-size:16px;line-height:1.7">Guten Tag ${name}</p>
      <h1 style="margin:0 0 18px;font-size:25px;line-height:1.25">Ihre Anfrage ist bei uns eingegangen.</h1>
      <p style="margin:0;font-size:16px;line-height:1.7">Vielen Dank für Ihre Anfrage. Wir prüfen Ihre Angaben und melden uns innerhalb von 24 Stunden mit einer ersten Einschätzung.</p>
      <hr style="border:0;border-top:1px solid #dfe3ea;margin:26px 0">
      <p style="margin:0;color:#5b6577;font-size:14px;line-height:1.7">Freundliche Grüsse<br><strong style="color:#172033">SynaptoCore · Zürich</strong><br><a href="mailto:${
      escapeHtml(inbox)
    }" style="color:#1d4ed8">${escapeHtml(inbox)}</a> · +41 78 809 00 94</p>
    `),
  };
}

export function retryDelayMinutes(attempt: number): number | null {
  const delays = [1, 5, 15, 60, 360];
  return delays[attempt - 1] ?? null;
}
