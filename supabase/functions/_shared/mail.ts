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
  phone?: string | null;
  message: string;
  created_at: string;
  appointment_start?: string | null;
  appointment_status?: "booked" | "cancelled" | null;
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
  const boundary = `systemio-${crypto.randomUUID()}`;
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

export function formatAppointment(value?: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(new Date(value));
}

export function ownerNotification(
  lead: LeadForMail,
  inbox: string,
  adminUrl: string,
): MailContent {
  const name = escapeHtml(lead.name);
  const company = escapeHtml(lead.company);
  const email = escapeHtml(lead.email);
  const phone = lead.phone ? escapeHtml(lead.phone) : "";
  const message = escapeHtml(lead.message).replaceAll("\n", "<br>");
  const appointment = formatAppointment(lead.appointment_start);
  const subject = appointment
    ? `Neue Terminbuchung: ${lead.company} - ${lead.name}`
    : `Neue Website-Anfrage: ${lead.company} - ${lead.name}`;
  const detailLines = [
    `Name: ${lead.name}`,
    `Firma: ${lead.company}`,
    `E-Mail: ${lead.email}`,
    lead.phone ? `Telefon: ${lead.phone}` : null,
    appointment ? `Termin: ${appointment}` : null,
  ].filter((line): line is string => Boolean(line));

  return {
    to: inbox,
    replyTo: lead.email,
    subject,
    text: [
      appointment ? "Neue Terminbuchung" : "Neue Website-Anfrage",
      "",
      ...detailLines,
      "",
      "Anliegen:",
      lead.message,
      "",
      `Admin: ${adminUrl}`,
      "",
      "Antworten Sie direkt auf diese E-Mail, um den Kunden zu erreichen.",
    ].join("\n"),
    html: emailShell(`
      <p style="margin:0 0 8px;color:#5b6577;font-size:13px">${appointment ? "Neue Terminbuchung" : "Neue Website-Anfrage"}</p>
      <h1 style="margin:0 0 24px;font-size:24px;line-height:1.25">${company} · ${name}</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.6">
        <tr><td style="width:90px;color:#5b6577;padding:3px 0">Name</td><td>${name}</td></tr>
        <tr><td style="color:#5b6577;padding:3px 0">Firma</td><td>${company}</td></tr>
        <tr><td style="color:#5b6577;padding:3px 0">E-Mail</td><td><a href="mailto:${email}" style="color:#1d4ed8">${email}</a></td></tr>
        ${phone ? `<tr><td style="color:#5b6577;padding:3px 0">Telefon</td><td>${phone}</td></tr>` : ""}
        ${appointment ? `<tr><td style="color:#5b6577;padding:3px 0">Termin</td><td>${escapeHtml(appointment)}</td></tr>` : ""}
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
  const appointment = formatAppointment(lead.appointment_start);
  const subject = appointment
    ? "Ihr Termin bei Systemio ist reserviert"
    : "Ihre Anfrage bei Systemio ist eingegangen";
  const appointmentText = appointment
    ? `Ihr Erstgespräch ist für ${appointment} reserviert. Falls der Termin nicht passt, antworten Sie bitte direkt auf diese E-Mail.`
    : "Vielen Dank für Ihre Anfrage. Wir prüfen Ihre Angaben und melden uns innerhalb von 24 Stunden mit einer ersten Einschätzung.";

  return {
    to: lead.email,
    replyTo: inbox,
    subject,
    text: [
      `Guten Tag ${lead.name}`,
      "",
      appointmentText,
      "",
      "Freundliche Grüsse",
      "Systemio · Zürich",
      "info@systemio.ch · +41 78 809 00 94",
    ].join("\n"),
    html: emailShell(`
      <p style="margin:0 0 22px;font-size:16px;line-height:1.7">Guten Tag ${name}</p>
      <h1 style="margin:0 0 18px;font-size:25px;line-height:1.25">${appointment ? "Ihr Termin ist reserviert." : "Ihre Anfrage ist bei uns eingegangen."}</h1>
      <p style="margin:0;font-size:16px;line-height:1.7">${escapeHtml(appointmentText)}</p>
      <hr style="border:0;border-top:1px solid #dfe3ea;margin:26px 0">
      <p style="margin:0;color:#5b6577;font-size:14px;line-height:1.7">Freundliche Grüsse<br><strong style="color:#172033">Systemio · Zürich</strong><br><a href="mailto:${
      escapeHtml(inbox)
    }" style="color:#1d4ed8">${escapeHtml(inbox)}</a> · +41 78 809 00 94</p>
    `),
  };
}

export function retryDelayMinutes(attempt: number): number | null {
  const delays = [1, 5, 15, 60, 360];
  return delays[attempt - 1] ?? null;
}
