import assert from "node:assert/strict";
import test from "node:test";

import { validateLeadSubmission } from "./lead.ts";
import {
  buildMimeMessage,
  customerConfirmation,
  escapeHtml,
  formatAppointment,
  ownerNotification,
  retryDelayMinutes,
} from "./mail.ts";

const validPayload = {
  slotId: "00000000-0000-4000-8000-000000000001",
  name: "Max Muster",
  company: "Muster AG",
  email: "MAX@MUSTER.CH",
  phone: "+41 78 809 00 94",
  message: "Wir verlieren Zeit beim Übertragen von Anfragen.",
  website: "",
  turnstileToken: "verified-token",
};

const lead = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Max <Muster>",
  company: "Muster & Partner",
  email: "max@muster.ch",
  phone: "+41 78 <script>",
  message: "CRM <script>alert(1)</script>",
  created_at: "2026-07-06T12:00:00.000Z",
  appointment_start: "2026-07-14T08:00:00.000Z",
  appointment_status: "booked" as const,
};

test("normalizes and validates a lead submission", () => {
  const result = validateLeadSubmission(validPayload);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.email, "max@muster.ch");
});

test("rejects malformed email and missing Turnstile tokens", () => {
  assert.equal(
    validateLeadSubmission({ ...validPayload, email: "invalid" }).ok,
    false,
  );
  assert.equal(
    validateLeadSubmission({ ...validPayload, turnstileToken: "" }).ok,
    false,
  );
});

test("requires a valid slot and phone number for real bookings", () => {
  assert.equal(validateLeadSubmission({ ...validPayload, slotId: "" }).ok, false);
  assert.equal(validateLeadSubmission({ ...validPayload, phone: "" }).ok, false);
});

test("allows a honeypot submission to be discarded without booking fields or Turnstile", () => {
  assert.equal(
    validateLeadSubmission({
      ...validPayload,
      slotId: "",
      phone: "",
      website: "https://spam.example",
      turnstileToken: "",
    }).ok,
    true,
  );
});

test("escapes untrusted lead values in HTML email bodies", () => {
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  const notification = ownerNotification(
    lead,
    "info@systemio.ch",
    "https://example.com/admin/",
  );
  assert.doesNotMatch(notification.html, /<script>/u);
  assert.match(notification.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
});

test("sets the customer as Reply-To on the owner notification", () => {
  const notification = ownerNotification(
    lead,
    "info@systemio.ch",
    "https://example.com/admin/",
  );
  assert.equal(notification.to, "info@systemio.ch");
  assert.equal(notification.replyTo, lead.email);
});

test("builds appointment confirmation copy and a multipart MIME message", () => {
  const confirmation = customerConfirmation(lead, "info@systemio.ch");
  const mime = buildMimeMessage({
    ...confirmation,
    fromEmail: "info@systemio.ch",
    fromName: "Systemio",
    messageId: "<test@systemio.local>",
  });
  assert.match(confirmation.subject, /Termin/u);
  assert.match(confirmation.text, /reserviert/u);
  assert.match(mime, /Content-Type: multipart\/alternative/u);
  assert.match(mime, /Message-ID: <test@systemio\.local>/u);
});

test("formats appointment times for the Zurich booking flow", () => {
  assert.match(formatAppointment(lead.appointment_start) ?? "", /2026/u);
});

test("uses bounded retry delays and stops after six attempts", () => {
  assert.equal(retryDelayMinutes(1), 1);
  assert.equal(retryDelayMinutes(5), 360);
  assert.equal(retryDelayMinutes(6), null);
});
