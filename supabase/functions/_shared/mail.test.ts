import assert from "node:assert/strict";
import test from "node:test";

import { validateLeadSubmission } from "./lead.ts";
import {
  buildMimeMessage,
  customerConfirmation,
  escapeHtml,
  ownerNotification,
  retryDelayMinutes,
} from "./mail.ts";

const validPayload = {
  name: "Max Muster",
  company: "Muster AG",
  email: "MAX@MUSTER.CH",
  message: "Wir verlieren Zeit beim Übertragen von Anfragen.",
  website: "",
  turnstileToken: "verified-token",
};

const lead = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Max <Muster>",
  company: "Muster & Partner",
  email: "max@muster.ch",
  message: "CRM <script>alert(1)</script>",
  created_at: "2026-07-06T12:00:00.000Z",
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

test("allows a honeypot submission to be discarded without a Turnstile token", () => {
  assert.equal(
    validateLeadSubmission({
      ...validPayload,
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
    "synaptocore@gmail.com",
    "https://example.com/admin/",
  );
  assert.doesNotMatch(notification.html, /<script>alert/u);
  assert.match(notification.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
});

test("sets the customer as Reply-To on the owner notification", () => {
  const notification = ownerNotification(
    lead,
    "synaptocore@gmail.com",
    "https://example.com/admin/",
  );
  assert.equal(notification.to, "synaptocore@gmail.com");
  assert.equal(notification.replyTo, lead.email);
});

test("builds confirmation copy and a multipart MIME message", () => {
  const confirmation = customerConfirmation(lead, "synaptocore@gmail.com");
  const mime = buildMimeMessage({
    ...confirmation,
    fromEmail: "synaptocore@gmail.com",
    fromName: "SynaptoCore",
    messageId: "<test@synaptocore.local>",
  });
  assert.match(confirmation.text, /innerhalb von 24 Stunden/u);
  assert.match(mime, /Content-Type: multipart\/alternative/u);
  assert.match(mime, /Message-ID: <test@synaptocore\.local>/u);
});

test("uses bounded retry delays and stops after six attempts", () => {
  assert.equal(retryDelayMinutes(1), 1);
  assert.equal(retryDelayMinutes(5), 360);
  assert.equal(retryDelayMinutes(6), null);
});
